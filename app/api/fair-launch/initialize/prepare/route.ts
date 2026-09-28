import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddress, getMint } from "@solana/spl-token";
import { buildInitializeFairLaunch, buildSeedFairLaunchVault } from "@/lib/fair-launch-program";
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
    try { body = JSON.parse(rawBody); } catch { throw new Error("Invalid request body"); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid request body");
    const input = body as Record<string, unknown>;
    const mint = key(input.mint, "mint");
    const developer = key(input.developer, "developer");
    const feeReceiverValue = process.env.FORGE_X_FEE_RECEIVER || process.env.NEXT_PUBLIC_FORGE_X_FEE_RECEIVER;
    const feeReceiver = key(feeReceiverValue, "FORGE_X_FEE_RECEIVER");
    if (!process.env.NEXT_PUBLIC_FORGE_X_PROGRAM_ID) throw new Error("FORGE X Fair Launch program ID is not configured");

    const connection = new Connection(RPC, "confirmed");
    const mintInfo = await getMint(connection, mint, "confirmed");
    if (mintInfo.decimals !== FORGE_X_FAIR_LAUNCH.decimals) throw new Error("Mint decimals do not match Fair Launch rules");
    if (mintInfo.supply !== FORGE_X_FAIR_LAUNCH.supply * 10n ** 9n) throw new Error("Mint supply does not match Fair Launch rules");
    if (mintInfo.mintAuthority !== null || mintInfo.freezeAuthority !== null) throw new Error("Mint authorities must already be revoked");

    const developerAtaAddress = await getAssociatedTokenAddress(mint, developer);
    const developerAta = await getAccount(connection, developerAtaAddress, "confirmed");
    if (!developerAta.owner.equals(developer)) throw new Error("Developer token account owner does not match developer");
    if (!developerAta.mint.equals(mint)) throw new Error("Developer token account mint does not match Fair Launch mint");
    if (developerAta.amount !== mintInfo.supply) throw new Error("Developer token account does not contain the complete Fair Launch supply");

    const latest = await connection.getLatestBlockhash("confirmed");
    const transaction = new Transaction().add(
      buildInitializeFairLaunch(mint, developer, FORGE_X_FAIR_LAUNCH.graduation.targetSolLamports, feeReceiver),
      ...buildSeedFairLaunchVault(mint, developer),
    );
    transaction.feePayer = developer;
    transaction.recentBlockhash = latest.blockhash;

    return NextResponse.json({ transaction: transaction.serialize({ requireAllSignatures: false }).toString("base64"), mint: mint.toBase58(), developer: developer.toBase58(), feeReceiver: feeReceiver.toBase58(), lastValidBlockHeight: latest.lastValidBlockHeight }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to prepare Fair Launch initialization" }, { status: 400 });
  }
}
