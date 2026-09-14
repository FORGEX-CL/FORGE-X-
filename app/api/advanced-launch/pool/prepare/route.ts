import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { prepareRaydiumCpmmPool } from "@/lib/raydium-cpmm-builder";

const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet" ? "devnet" : "mainnet-beta";
const RPC = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || (CLUSTER === "devnet" ? "https://api.devnet.solana.com" : "https://api.mainnet-beta.solana.com");

function parsePublicKey(value: unknown, field: string): PublicKey {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  try { return new PublicKey(value); } catch { throw new Error(`${field} is invalid`); }
}

function parsePositiveInteger(value: unknown, field: string): bigint {
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error(`${field} must be a positive integer string`);
  try {
    const parsed = BigInt(value);
    if (parsed <= 0n) throw new Error();
    return parsed;
  } catch { throw new Error(`${field} must be a positive integer string`); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const wallet = parsePublicKey(body.wallet, "wallet");
    const mint = parsePublicKey(body.mint, "mint");
    const tokenBaseUnits = parsePositiveInteger(body.tokenBaseUnits, "tokenBaseUnits");
    const solLamports = parsePositiveInteger(body.solLamports, "solLamports");

    const connection = new Connection(RPC, "confirmed");
    const prepared = await prepareRaydiumCpmmPool({ connection, wallet, mint, tokenBaseUnits, solLamports });
    const latest = await connection.getLatestBlockhash("confirmed");

    return NextResponse.json({
      transaction: Buffer.from(prepared.transaction.serialize()).toString("base64"),
      poolId: prepared.poolId.toBase58(),
      programId: prepared.programId.toBase58(),
      mint: prepared.mint.toBase58(),
      tokenBaseUnits: prepared.tokenBaseUnits.toString(),
      solLamports: prepared.solLamports.toString(),
      lastValidBlockHeight: latest.lastValidBlockHeight,
      cluster: CLUSTER,
      requiresWalletSignature: true,
      simulated: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare Raydium CPMM pool";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
