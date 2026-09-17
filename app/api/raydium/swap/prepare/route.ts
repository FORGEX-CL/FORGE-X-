import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { prepareRaydiumCpmmSwap } from "@/lib/raydium-cpmm-swap-builder";
import { SOLANA_CLUSTER, SOLANA_RPC_URL } from "@/lib/solana-client-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function key(value: unknown, field: string): PublicKey {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  try { return new PublicKey(value); } catch { throw new Error(`${field} is invalid`); }
}

function amount(value: unknown) {
  try {
    const parsed = BigInt(String(value ?? "0"));
    if (parsed <= 0n) throw new Error();
    return parsed;
  } catch {
    throw new Error("amount must be a positive integer in base units");
  }
}

function slippage(value: unknown) {
  const parsed = Number(value ?? 0.005);
  if (!Number.isFinite(parsed) || parsed < 0.0001 || parsed > 0.05) {
    throw new Error("slippage must be between 0.01% and 5%");
  }
  return parsed;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const trader = key(body.trader, "trader");
    const poolId = key(body.poolId, "poolId");
    const inputMint = key(body.inputMint, "inputMint");
    const inputAmount = amount(body.amount);
    const prepared = await prepareRaydiumCpmmSwap({
      connection: new Connection(SOLANA_RPC_URL, "confirmed"),
      trader,
      poolId,
      inputMint,
      inputAmount,
      slippage: slippage(body.slippage),
    });

    return NextResponse.json({
      transaction: Buffer.from(prepared.transaction.serialize()).toString("base64"),
      recentBlockhash: prepared.transaction.message.recentBlockhash,
      lastValidBlockHeight: prepared.lastValidBlockHeight,
      poolId: prepared.poolId.toBase58(),
      inputMint: prepared.inputMint.toBase58(),
      outputMint: prepared.outputMint.toBase58(),
      inputAmount: prepared.inputAmount.toString(),
      outputAmount: prepared.outputAmount.toString(),
      minimumOutputAmount: prepared.minimumOutputAmount.toString(),
      tradeFee: prepared.tradeFee.toString(),
      programId: prepared.programId.toBase58(),
      cluster: SOLANA_CLUSTER,
    }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to prepare Raydium swap" },
      { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
