import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { prepareRaydiumCpmmGraduation } from "@/lib/raydium-graduation-builder";

const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet" ? "devnet" : "mainnet";
const RPC = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || (CLUSTER === "devnet" ? "https://api.devnet.solana.com" : "https://api.mainnet-beta.solana.com");

function parsePublicKey(value: unknown, field: string): PublicKey {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  try { return new PublicKey(value); } catch { throw new Error(`${field} is invalid`); }
}

function parseLamports(value: unknown, field: string): bigint {
  if (typeof value !== "string" && typeof value !== "number") throw new Error(`${field} is required`);
  try {
    const parsed = BigInt(String(value));
    if (parsed <= 0n) throw new Error();
    return parsed;
  } catch {
    throw new Error(`${field} must be a positive integer lamport amount`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const developer = parsePublicKey(body.developer, "developer");
    const mint = parsePublicKey(body.mint, "mint");
    const solLamports = parseLamports(body.solLamports, "solLamports");
    const tokenBaseUnits = parseLamports(body.tokenBaseUnits, "tokenBaseUnits");

    const connection = new Connection(RPC, "confirmed");
    const prepared = await prepareRaydiumCpmmGraduation({
      connection,
      developer,
      mint,
      solLamports,
      tokenBaseUnits,
    });

    return NextResponse.json({
      transaction: Buffer.from(prepared.transaction.serialize()).toString("base64"),
      poolId: prepared.poolId.toBase58(),
      fairLaunchProgramId: prepared.programId.toBase58(),
      fairLaunchVault: prepared.vault.toBase58(),
      developerTokenAccount: prepared.developerTokenAccount.toBase58(),
      solLamports: prepared.solLamports.toString(),
      tokenBaseUnits: prepared.tokenBaseUnits.toString(),
      cluster: CLUSTER,
      atomic: true,
      instructions: ["Fair Launch PDA migration", "Raydium CPMM pool creation"],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare graduation transaction";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
