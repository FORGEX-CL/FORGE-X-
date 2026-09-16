import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { prepareRaydiumCpmmPool } from "@/lib/raydium-cpmm-builder";
import { SOLANA_CLUSTER, SOLANA_RPC_URL } from "@/lib/solana-client-config";

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

    const connection = new Connection(SOLANA_RPC_URL, "confirmed");
    const prepared = await prepareRaydiumCpmmPool({ connection, wallet, mint, tokenBaseUnits, solLamports });

    return NextResponse.json({
      transaction: Buffer.from(prepared.transaction.serialize()).toString("base64"),
      poolId: prepared.poolId.toBase58(),
      programId: prepared.programId.toBase58(),
      mint: prepared.mint.toBase58(),
      tokenBaseUnits: prepared.tokenBaseUnits.toString(),
      solLamports: prepared.solLamports.toString(),
      cluster: SOLANA_CLUSTER,
      requiresWalletSignature: true,
      simulated: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare Raydium CPMM pool";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
