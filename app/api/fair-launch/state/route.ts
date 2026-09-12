import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

const RPC = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = process.env.NEXT_PUBLIC_FORGE_X_PROGRAM_ID;
const STATE_SEED = Buffer.from("launch");
const STATUS: Record<number, string> = { 0: "WAITING_FOR_DEV_BUY", 1: "LIVE", 2: "GRADUATED", 3: "MIGRATED" };

export async function GET(request: NextRequest) {
  try {
    if (!PROGRAM_ID) throw new Error("FORGE X program ID is not configured");
    const mint = new PublicKey(new URL(request.url).searchParams.get("mint") || "");
    const programId = new PublicKey(PROGRAM_ID);
    const [state] = PublicKey.findProgramAddressSync([STATE_SEED, mint.toBuffer()], programId);
    const connection = new Connection(RPC, "confirmed");
    const account = await connection.getAccountInfo(state, "confirmed");
    if (!account || !account.owner.equals(programId) || account.data.length < 82) throw new Error("Fair Launch state account was not found or is invalid");
    const data = account.data;
    return NextResponse.json({
      state: state.toBase58(),
      mint: mint.toBase58(),
      developer: new PublicKey(data.subarray(1, 33)).toBase58(),
      status: STATUS[data[33]] || "UNKNOWN",
      developerBuyLamports: data.readBigUInt64LE(34).toString(),
      realSolRaisedLamports: data.readBigUInt64LE(42).toString(),
      virtualSolReserveLamports: data.readBigUInt64LE(50).toString(),
      virtualTokenReserveBaseUnits: data.readBigUInt64LE(58).toString(),
      graduationSolLamports: data.readBigUInt64LE(66).toString(),
      createdAt: data.readBigInt64LE(74).toString(),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to read Fair Launch state" }, { status: 400 });
  }
}
