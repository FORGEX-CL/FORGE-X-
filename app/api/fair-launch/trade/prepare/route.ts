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
    const trader = key(input.trader, "trader");
    const side = input.side === "sell" ? "sell" : input.side === "buy" ? "buy" : null;
    if (!side) throw new Error("side must be buy or sell");
    const amount = BigInt(String(input.amount || "0"));
    if (amount <= 0n) throw new Error("Trade amount must be positive");
    const feeReceiverValue = process.env.FORGE_X_FEE_RECEIVER || process.env.NEXT_PUBLIC_FORGE_X_FEE_RECEIVER;
    const feeReceiver = key(feeReceiverValue, "FORGE_X_FEE_RECEIVER");

    const connection = new Connection(RPC, "confirmed");
    const latest = await connection.getLatestBlockhash("confirmed");
    const instructions = side === "buy" ? buildFairLaunchBuyWithAta(mint, trader, amount, feeReceiver) : [buildFairLaunchSell(mint, trader, amount, feeReceiver)];
    const transaction = new Transaction().add(...instructions);
    transaction.feePayer = trader;
    transaction.recentBlockhash = latest.blockhash;

    return NextResponse.json({ transaction: transaction.serialize({ requireAllSignatures: false }).toString("base64"), mint: mint.toBase58(), trader: trader.toBase58(), side, amount: amount.toString(), lastValidBlockHeight: latest.lastValidBlockHeight });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to prepare trade" }, { status: 400 });
  }
}
