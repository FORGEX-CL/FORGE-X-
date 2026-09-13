import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { CREATE_CPMM_POOL_PROGRAM, DEVNET_PROGRAM_ID, Raydium } from "@raydium-io/raydium-sdk-v2";

const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet" ? "devnet" : "mainnet";
const RPC = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || (CLUSTER === "devnet" ? "https://api.devnet.solana.com" : "https://api.mainnet-beta.solana.com");
const STATE_LEN = 114;
const STATE_VERSION = 3;
const STATUS_MIGRATED = 3;
const WSOL = "So11111111111111111111111111111111111111112";

const MAINNET_CPMM = new PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C");
const DEVNET_CPMM = new PublicKey("DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpY");

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
    if (!stateInfo || stateInfo.data.length !== STATE_LEN || !stateInfo.owner.equals(programId)) throw new Error("Fair Launch state is missing, has an invalid layout, or is owned by the wrong program");
    const data = stateInfo.data;
    if (data[0] !== STATE_VERSION) throw new Error("Unsupported Fair Launch state version");
    const stateDeveloper = new PublicKey(data.subarray(1, 33));
    if (!stateDeveloper.equals(developer)) throw new Error("Developer does not match Fair Launch state");
    if (data[33] !== STATUS_MIGRATED) throw new Error("Fair Launch has not been migrated yet");

    const expectedCpmmProgram = CLUSTER === "devnet" ? DEVNET_CPMM : MAINNET_CPMM;
    const raydium = await Raydium.load({ connection, owner: PublicKey.default, disableLoadToken: true });
    const rpcPool = await raydium.cpmm.getPoolInfoFromRpc(poolId.toBase58());
    const info = rpcPool.poolInfo;
    if (!info || info.programId !== expectedCpmmProgram.toBase58()) throw new Error("Pool is not an expected Raydium CPMM pool on this network");

    const poolAccount = await connection.getAccountInfo(poolId, "confirmed");
    if (!poolAccount || !poolAccount.owner.equals(expectedCpmmProgram)) throw new Error("Pool account is not owned by the expected Raydium CPMM program");

    const mintA = typeof info.mintA === "string" ? info.mintA : info.mintA?.address;
    const mintB = typeof info.mintB === "string" ? info.mintB : info.mintB?.address;
    if (!mintA || !mintB) throw new Error("Raydium CPMM pool mint information is incomplete");
    if (![mintA, mintB].includes(WSOL)) throw new Error("Migrated pool must contain WSOL");
    if (mintA !== mint.toBase58() && mintB !== mint.toBase58()) throw new Error("Migrated pool does not contain the Fair Launch mint");

    return NextResponse.json({
      verified: true,
      cluster: CLUSTER,
      mint: mint.toBase58(),
      developer: developer.toBase58(),
      fairLaunchState: state.toBase58(),
      fairLaunchStatus: "MIGRATED",
      poolId: poolId.toBase58(),
      poolProgramId: poolAccount.owner.toBase58(),
      poolMints: [mintA, mintB],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify graduation";
    return NextResponse.json({ verified: false, error: message }, { status: 400 });
  }
}
