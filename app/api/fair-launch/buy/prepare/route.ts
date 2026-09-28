import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { buildFairLaunchBuyWithAta } from "@/lib/fair-launch-program";
import { FORGE_X_FAIR_LAUNCH } from "@/lib/fair-launch-rules";
import { fairLaunchStatePda, FORGE_X_FAIR_LAUNCH_PROGRAM_ID } from "@/lib/fair-launch-program";

const RPC = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

function key(value: unknown, field: string): PublicKey {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  try { return new PublicKey(value); } catch { throw new Error(`${field} is invalid`); }
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > 16_384) throw new Error("Request body is too large");
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 16_384) throw new Error("Request body is too large");
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new Error("Invalid request body");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid request body");
    const input = body as Record<string, unknown>;
    const mint = key(input.mint, "mint");
    const developer = key(input.developer, "developer");
    const feeReceiverValue = process.env.FORGE_X_FEE_RECEIVER || process.env.NEXT_PUBLIC_FORGE_X_FEE_RECEIVER;
    const feeReceiver = key(feeReceiverValue, "FORGE_X_FEE_RECEIVER");
    const grossLamports = BigInt(String(input.grossLamports || FORGE_X_FAIR_LAUNCH.developerMinimumBuyLamports));
    if (grossLamports < FORGE_X_FAIR_LAUNCH.developerMinimumBuyLamports) throw new Error("Developer first buy must be at least 0.05 SOL");

    const programId = FORGE_X_FAIR_LAUNCH_PROGRAM_ID;
    if (!programId) throw new Error("FORGE X Fair Launch program ID is not configured");
    const connection = new Connection(RPC, "confirmed");
    const stateAddress = fairLaunchStatePda(mint, programId);
    const stateInfo = await connection.getAccountInfo(stateAddress, "confirmed");
    if (!stateInfo || !stateInfo.owner.equals(programId) || stateInfo.data.length !== 114) throw new Error("Fair Launch state is not initialized correctly");
    const state = Buffer.from(stateInfo.data);
    if (state[0] !== 3 || !new PublicKey(state.subarray(1, 33)).equals(developer)) throw new Error("Developer does not match Fair Launch state");
    if (state[33] !== 0) throw new Error("Fair Launch is no longer waiting for the developer buy");
    if (!new PublicKey(state.subarray(82, 114)).equals(feeReceiver)) throw new Error("Fee receiver does not match Fair Launch state");
    const latest = await connection.getLatestBlockhash("confirmed");
    const transaction = new Transaction().add(...buildFairLaunchBuyWithAta(mint, developer, grossLamports, feeReceiver));
    transaction.feePayer = developer;
    transaction.recentBlockhash = latest.blockhash;

    const simulation = await connection.simulateTransaction(transaction, { commitment: "confirmed", sigVerify: false, replaceRecentBlockhash: true });
    if (simulation.value.err) throw new Error("Developer buy simulation failed");
    return NextResponse.json({
      transaction: transaction.serialize({ requireAllSignatures: false }).toString("base64"),
      mint: mint.toBase58(), developer: developer.toBase58(), grossLamports: grossLamports.toString(), lastValidBlockHeight: latest.lastValidBlockHeight,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to prepare developer buy" }, { status: 400 });
  }
}
