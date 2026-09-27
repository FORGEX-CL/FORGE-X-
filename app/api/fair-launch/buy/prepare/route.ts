import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { buildFairLaunchBuyWithAta } from "@/lib/fair-launch-program";
import { FORGE_X_FAIR_LAUNCH } from "@/lib/fair-launch-rules";

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

    const connection = new Connection(RPC, "confirmed");
    const latest = await connection.getLatestBlockhash("confirmed");
    const transaction = new Transaction().add(...buildFairLaunchBuyWithAta(mint, developer, grossLamports, feeReceiver));
    transaction.feePayer = developer;
    transaction.recentBlockhash = latest.blockhash;

    return NextResponse.json({
      transaction: transaction.serialize({ requireAllSignatures: false }).toString("base64"),
      mint: mint.toBase58(), developer: developer.toBase58(), grossLamports: grossLamports.toString(), lastValidBlockHeight: latest.lastValidBlockHeight,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to prepare developer buy" }, { status: 400 });
  }
}
