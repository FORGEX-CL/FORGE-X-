import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

const RPC = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = process.env.NEXT_PUBLIC_FORGE_X_PROGRAM_ID;
const STATE_SEED = Buffer.from("launch");
const STATE_LEN = 114;
const STATE_VERSION = 3;
const STATUS: Record<number, string> = { 0: "WAITING_FOR_DEV_BUY", 1: "LIVE", 2: "GRADUATED", 3: "MIGRATED" };

function configuredFeeReceiver(): PublicKey | null {
  const value = process.env.FORGE_X_FEE_RECEIVER || process.env.NEXT_PUBLIC_FORGE_X_FEE_RECEIVER;
  if (!value?.trim()) return null;
  try { return new PublicKey(value); } catch { throw new Error("Configured FORGE_X_FEE_RECEIVER is invalid"); }
}

export async function GET(request: NextRequest) {
  try {
    if (!PROGRAM_ID) throw new Error("FORGE X program ID is not configured");
    const mint = new PublicKey(new URL(request.url).searchParams.get("mint") || "");
    const programId = new PublicKey(PROGRAM_ID);
    const [state] = PublicKey.findProgramAddressSync([STATE_SEED, mint.toBuffer()], programId);
    const connection = new Connection(RPC, "confirmed");
    const account = await connection.getAccountInfo(state, "confirmed");
    if (!account || !account.owner.equals(programId) || account.data.length !== STATE_LEN) throw new Error("Fair Launch state account was not found or has an invalid layout");
    const data = account.data;
    if (data[0] !== STATE_VERSION) throw new Error("Fair Launch state version is unsupported");
    const feeReceiver = new PublicKey(data.subarray(82, 114));
    const configured = configuredFeeReceiver();
    return NextResponse.json({
      state: state.toBase58(),
      mint: mint.toBase58(),
      version: data[0],
      developer: new PublicKey(data.subarray(1, 33)).toBase58(),
      status: STATUS[data[33]] || "UNKNOWN",
      developerBuyLamports: data.readBigUInt64LE(34).toString(),
      realSolRaisedLamports: data.readBigUInt64LE(42).toString(),
      virtualSolReserveLamports: data.readBigUInt64LE(50).toString(),
      virtualTokenReserveBaseUnits: data.readBigUInt64LE(58).toString(),
      graduationSolLamports: data.readBigUInt64LE(66).toString(),
      createdAt: data.readBigInt64LE(74).toString(),
      feeReceiver: feeReceiver.toBase58(),
      feeReceiverConfigured: configured?.toBase58() ?? null,
      feeReceiverMatchesConfigured: configured ? feeReceiver.equals(configured) : null,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to read Fair Launch state" }, { status: 400 });
  }
}
