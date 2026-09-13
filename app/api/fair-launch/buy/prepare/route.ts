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
    const body = await request.json();
    const mint = key(body.mint, "mint");
    const developer = key(body.developer, "developer");
    const feeReceiverValue = process.env.FORGE_X_FEE_RECEIVER || process.env.NEXT_PUBLIC_FORGE_X_FEE_RECEIVER;
    const feeReceiver = key(feeReceiverValue, "FORGE_X_FEE_RECEIVER");
    const grossLamports = BigInt(String(body.grossLamports || FORGE_X_FAIR_LAUNCH.developerMinimumBuyLamports));
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
