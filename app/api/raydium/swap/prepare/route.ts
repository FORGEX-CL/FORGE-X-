import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { prepareRaydiumCpmmSwap } from "@/lib/raydium-cpmm-swap-builder";

const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta" ? "mainnet-beta" : "devnet";
const DEFAULT_RPC = CLUSTER === "devnet" ? "https://api.devnet.solana.com" : "";
const RPC = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || DEFAULT_RPC;

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
    if (!RPC) throw new Error("A dedicated mainnet SOLANA_RPC_URL is required for Raydium trading");
    const body = await request.json();
    const trader = key(body.trader, "trader");
    const poolId = key(body.poolId, "poolId");
    const inputMint = key(body.inputMint, "inputMint");
    const inputAmount = amount(body.amount);
    const prepared = await prepareRaydiumCpmmSwap({
      connection: new Connection(RPC, "confirmed"),
      trader,
      poolId,
      inputMint,
      inputAmount,
      slippage: slippage(body.slippage),
    });

    return NextResponse.json({
      transaction: Buffer.from(prepared.transaction.serialize()).toString("base64"),
      recentBlockhash: prepared.transaction.message.recentBlockhash,
      poolId: prepared.poolId.toBase58(),
      inputMint: prepared.inputMint.toBase58(),
      outputMint: prepared.outputMint.toBase58(),
      inputAmount: prepared.inputAmount.toString(),
      outputAmount: prepared.outputAmount.toString(),
      minimumOutputAmount: prepared.minimumOutputAmount.toString(),
      tradeFee: prepared.tradeFee.toString(),
      programId: prepared.programId.toBase58(),
      cluster: CLUSTER,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to prepare Raydium swap" }, { status: 400 });
  }
}
