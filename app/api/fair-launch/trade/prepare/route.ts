import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { buildFairLaunchBuyWithAta, buildFairLaunchSell } from "@/lib/fair-launch-program";

const RPC = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

function key(value: unknown, field: string): PublicKey {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  try { return new PublicKey(value); } catch { throw new Error(`${field} is invalid`); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mint = key(body.mint, "mint");
    const trader = key(body.trader, "trader");
    const side = body.side === "sell" ? "sell" : body.side === "buy" ? "buy" : null;
    if (!side) throw new Error("side must be buy or sell");
    const amount = BigInt(String(body.amount || "0"));
    if (amount <= 0n) throw new Error("Trade amount must be positive");
    const feeReceiverValue = process.env.FORGE_X_FEE_RECEIVER || process.env.NEXT_PUBLIC_FORGE_X_FEE_RECEIVER;
    const feeReceiver = key(feeReceiverValue, "FORGE_X_FEE_RECEIVER");

    const connection = new Connection(RPC, "confirmed");
    const latest = await connection.getLatestBlockhash("confirmed");
    const instructions = side === "buy"
      ? buildFairLaunchBuyWithAta(mint, trader, amount, feeReceiver)
      : [buildFairLaunchSell(mint, trader, amount, feeReceiver)];
    const transaction = new Transaction({ feePayer: trader, recentBlockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight }).add(...instructions);

    return NextResponse.json({
      transaction: transaction.serialize({ requireAllSignatures: false }).toString("base64"),
      mint: mint.toBase58(),
      trader: trader.toBase58(),
      side,
      amount: amount.toString(),
      lastValidBlockHeight: latest.lastValidBlockHeight,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to prepare trade" }, { status: 400 });
  }
}
