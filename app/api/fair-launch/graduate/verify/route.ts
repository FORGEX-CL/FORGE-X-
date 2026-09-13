import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet" ? "devnet" : "mainnet";
const RPC = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || (CLUSTER === "devnet" ? "https://api.devnet.solana.com" : "https://api.mainnet-beta.solana.com");
const STATE_LEN = 82;
const STATE_VERSION = 2;
const STATUS_MIGRATED = 3;

const MAINNET_CPMM = new PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C");
const DEVNET_CPMM = new PublicKey("DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb");

function key(value: unknown, field: string): PublicKey {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  try { return new PublicKey(value); } catch { throw new Error(`${field} is invalid`); }
}

export async function GET(request: NextRequest) {
  try {
    const mint = key(request.nextUrl.searchParams.get("mint"), "mint");
    const developer = key(request.nextUrl.searchParams.get("developer"), "developer");
    const poolId = key(request.nextUrl.searchParams.get("poolId"), "poolId");
    const programIdValue = process.env.NEXT_PUBLIC_FORGE_X_PROGRAM_ID;
    if (!programIdValue) throw new Error("FORGE X Fair Launch program ID is not configured");
    const programId = new PublicKey(programIdValue);
    const connection = new Connection(RPC, "confirmed");

    const [state] = PublicKey.findProgramAddressSync([Buffer.from("launch"), mint.toBuffer()], programId);
    const stateInfo = await connection.getAccountInfo(state, "confirmed");
    if (!stateInfo || stateInfo.data.length < STATE_LEN || !stateInfo.owner.equals(programId)) throw new Error("Fair Launch state is missing or owned by the wrong program");
    const data = stateInfo.data;
    if (data[0] !== STATE_VERSION) throw new Error("Unsupported Fair Launch state version");
    const stateDeveloper = new PublicKey(data.subarray(1, 33));
    if (!stateDeveloper.equals(developer)) throw new Error("Developer does not match Fair Launch state");
    if (data[33] !== STATUS_MIGRATED) throw new Error("Fair Launch has not been migrated yet");

    const poolInfo = await connection.getAccountInfo(poolId, "confirmed");
    if (!poolInfo) throw new Error("Raydium CPMM pool account was not found");
    const expectedCpmmProgram = CLUSTER === "devnet" ? DEVNET_CPMM : MAINNET_CPMM;
    if (!poolInfo.owner.equals(expectedCpmmProgram)) throw new Error("Pool account is not owned by the expected Raydium CPMM program");

    return NextResponse.json({
      verified: true,
      cluster: CLUSTER,
      mint: mint.toBase58(),
      developer: developer.toBase58(),
      fairLaunchState: state.toBase58(),
      fairLaunchStatus: "MIGRATED",
      poolId: poolId.toBase58(),
      poolProgramId: poolInfo.owner.toBase58(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify graduation";
    return NextResponse.json({ verified: false, error: message }, { status: 400 });
  }
}
