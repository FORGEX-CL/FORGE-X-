import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { CREATE_CPMM_POOL_PROGRAM, Raydium } from "@raydium-io/raydium-sdk-v2";

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

function positiveAmount(value: unknown, field: string): string {
  const amount = value && typeof value === "object" && "toString" in value
    ? String(value.toString())
    : String(value ?? "0");
  if (!/^\d+$/.test(amount) || BigInt(amount) <= 0n) throw new Error(`${field} must be positive`);
  return amount;
}

function instructionTouches(
  instruction: { accountKeyIndexes: readonly number[]; programIdIndex: number; data: string },
  accountKeys: readonly PublicKey[],
  programId: PublicKey,
  requiredAccounts: PublicKey[],
): boolean {
  if (!accountKeys[instruction.programIdIndex]?.equals(programId)) return false;
  const accounts = new Set(instruction.accountKeyIndexes.map((index) => accountKeys[index]?.toBase58()));
  return requiredAccounts.every((account) => accounts.has(account.toBase58()));
}

function hasMigrationInstruction(
  transaction: NonNullable<Awaited<ReturnType<Connection["getTransaction"]>>>,
  forgeProgram: PublicKey,
  state: PublicKey,
  mint: PublicKey,
  developer: PublicKey,
): boolean {
  const message = transaction.transaction.message;
  const accountKeys = message.getAccountKeys().staticAccountKeys;
  return message.compiledInstructions.some((instruction) =>
    instruction.data === "5" && instructionTouches(instruction, accountKeys, forgeProgram, [state, mint, developer]),
  );
}

function hasPoolInstruction(
  transaction: NonNullable<Awaited<ReturnType<Connection["getTransaction"]>>>,
  cpmmProgram: PublicKey,
  poolId: PublicKey,
): boolean {
  const message = transaction.transaction.message;
  const accountKeys = message.getAccountKeys().staticAccountKeys;
  return message.compiledInstructions.some((instruction) =>
    instructionTouches(instruction, accountKeys, cpmmProgram, [poolId]),
  );
}

export async function GET(request: NextRequest) {
  try {
    const mint = key(request.nextUrl.searchParams.get("mint"), "mint");
    const developer = key(request.nextUrl.searchParams.get("developer"), "developer");
    const poolId = key(request.nextUrl.searchParams.get("poolId"), "poolId");
    const signature = request.nextUrl.searchParams.get("signature");
    if (!signature || !/^[1-9A-HJ-NP-Za-km-z]{32,100}$/.test(signature)) throw new Error("signature is required and invalid");

    const programIdValue = process.env.NEXT_PUBLIC_FORGE_X_PROGRAM_ID;
    if (!programIdValue) throw new Error("FORGE X Fair Launch program ID is not configured");
    const programId = new PublicKey(programIdValue);
    const connection = new Connection(RPC, "confirmed");
    const [state] = PublicKey.findProgramAddressSync([Buffer.from("launch"), mint.toBuffer()], programId);

    const transaction = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (!transaction || transaction.meta?.err) throw new Error("Graduation transaction was not found or failed");
    if (!hasMigrationInstruction(transaction, programId, state, mint, developer)) throw new Error("Submitted transaction does not contain the expected Fair Launch migration instruction");

    const stateInfo = await connection.getAccountInfo(state, "confirmed");
    if (!stateInfo || stateInfo.data.length !== STATE_LEN || !stateInfo.owner.equals(programId)) throw new Error("Fair Launch state is missing, has an invalid layout, or is owned by the wrong program");
    const data = stateInfo.data;
    if (data[0] !== STATE_VERSION) throw new Error("Unsupported Fair Launch state version");
    const stateDeveloper = new PublicKey(data.subarray(1, 33));
    if (!stateDeveloper.equals(developer)) throw new Error("Developer does not match Fair Launch state");
    if (data[33] !== STATUS_MIGRATED) throw new Error("Fair Launch has not been migrated yet");

    const expectedCpmmProgram = CLUSTER === "devnet" ? DEVNET_CPMM : MAINNET_CPMM;
    if (!hasPoolInstruction(transaction, expectedCpmmProgram, poolId)) throw new Error("Submitted transaction does not contain the expected Raydium pool instruction");

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

    const vaultAAmount = positiveAmount(rpcPool.rpcData.vaultAAmount, "Raydium vault A balance");
    const vaultBAmount = positiveAmount(rpcPool.rpcData.vaultBAmount, "Raydium vault B balance");
    const tokenVaultAmount = mintA === mint.toBase58() ? vaultAAmount : vaultBAmount;
    const wsolVaultAmount = mintA === WSOL ? vaultAAmount : vaultBAmount;
    if (BigInt(tokenVaultAmount) <= 0n || BigInt(wsolVaultAmount) <= 0n) throw new Error("Migrated pool does not contain positive token and WSOL liquidity");

    return NextResponse.json({
      verified: true,
      cluster: CLUSTER,
      mint: mint.toBase58(),
      developer: developer.toBase58(),
      signature,
      fairLaunchState: state.toBase58(),
      fairLaunchStatus: "MIGRATED",
      poolId: poolId.toBase58(),
      poolProgramId: poolAccount.owner.toBase58(),
      poolMints: [mintA, mintB],
      liquidity: { tokenBaseUnits: tokenVaultAmount, wsolLamports: wsolVaultAmount },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify graduation";
    return NextResponse.json({ verified: false, error: message }, { status: 400 });
  }
}
