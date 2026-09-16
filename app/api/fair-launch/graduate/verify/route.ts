import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { Raydium } from "@raydium-io/raydium-sdk-v2";

const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet" ? "devnet" : "mainnet";
const RPC = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || (CLUSTER === "devnet" ? "https://api.devnet.solana.com" : "https://api.mainnet-beta.solana.com");
const STATE_LEN = 114;
const STATE_VERSION = 3;
const STATUS_MIGRATED = 3;
const WSOL = "So11111111111111111111111111111111111111112";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_ACCOUNT_LEN = 165;
const MAINNET_CPMM = new PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C");
const DEVNET_CPMM = new PublicKey("DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpY");
const CPMM_CREATE_POOL_DISCRIMINATOR = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);

type ConfirmedTransaction = NonNullable<Awaited<ReturnType<Connection["getTransaction"]>>>;
type ParsedTransaction = NonNullable<Awaited<ReturnType<Connection["getParsedTransaction"]>>>;
type CompiledInstruction = { accountKeyIndexes: readonly number[]; programIdIndex: number; data: Uint8Array };

type PoolInstructionCheck = {
  index: number;
  wsolUserVault: PublicKey;
  tokenUserVault: PublicKey;
  amountA: bigint;
  amountB: bigint;
  mintA: PublicKey;
  mintB: PublicKey;
};

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

function accountKeys(transaction: ConfirmedTransaction): PublicKey[] {
  const staticKeys = transaction.transaction.message.getAccountKeys().staticAccountKeys;
  const loaded = transaction.meta?.loadedAddresses;
  return [...staticKeys, ...(loaded?.writable ?? []), ...(loaded?.readonly ?? [])];
}

function exactMigrationInstruction(
  instruction: CompiledInstruction,
  keys: readonly PublicKey[],
  programId: PublicKey,
  state: PublicKey,
  mint: PublicKey,
  developer: PublicKey,
): boolean {
  if (!keys[instruction.programIdIndex]?.equals(programId)) return false;
  if (instruction.data.length !== 1 || instruction.data[0] !== 4) return false;
  if (instruction.accountKeyIndexes.length !== 7) return false;
  const ixKeys = instruction.accountKeyIndexes.map((index) => keys[index]);
  if (ixKeys.some((account) => !account)) return false;
  return ixKeys[0].equals(state)
    && ixKeys[1].equals(mint)
    && ixKeys[2].equals(developer)
    && ixKeys[3].equals(fairLaunchVaultAta(mint, programId))
    && ixKeys[4].equals(getAssociatedTokenAddressSync(mint, developer))
    && ixKeys[5].equals(new PublicKey("11111111111111111111111111111111"))
    && ixKeys[6].equals(new PublicKey(TOKEN_PROGRAM));
}

function fairLaunchVaultAta(mint: PublicKey, programId: PublicKey): PublicKey {
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), mint.toBuffer()], programId);
  return vault;
}

function getAssociatedTokenAddressSync(mint: PublicKey, owner: PublicKey): PublicKey {
  const ASSOCIATED_TOKEN_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), new PublicKey(TOKEN_PROGRAM).toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM,
  );
  return ata;
}

function findMigrationIndex(transaction: ConfirmedTransaction, programId: PublicKey, state: PublicKey, mint: PublicKey, developer: PublicKey): number {
  const keys = accountKeys(transaction);
  const matches = transaction.transaction.message.compiledInstructions
    .map((instruction, index) => ({ instruction, index }))
    .filter(({ instruction }) => exactMigrationInstruction(instruction, keys, programId, state, mint, developer));
  if (matches.length !== 1) throw new Error("Submitted transaction must contain exactly one expected Fair Launch migration instruction");
  return matches[0].index;
}

function instructionTouches(instruction: CompiledInstruction, keys: readonly PublicKey[], programId: PublicKey, requiredAccounts: PublicKey[]): boolean {
  if (!keys[instruction.programIdIndex]?.equals(programId)) return false;
  const accounts = new Set(instruction.accountKeyIndexes.map((index) => keys[index]?.toBase58()));
  return requiredAccounts.every((account) => accounts.has(account.toBase58()));
}

function findPoolInstruction(transaction: ConfirmedTransaction, cpmmProgram: PublicKey, poolId: PublicKey, mint: PublicKey, developer: PublicKey, solLamports: bigint, tokenBaseUnits: bigint): PoolInstructionCheck {
  const keys = accountKeys(transaction);
  const matches = transaction.transaction.message.compiledInstructions
    .map((instruction, index) => ({ instruction, index }))
    .filter(({ instruction }) => instructionTouches(instruction, keys, cpmmProgram, [poolId]));
  if (matches.length !== 1) throw new Error("Submitted transaction must contain exactly one expected Raydium pool instruction");

  const { instruction, index } = matches[0];
  const data = Buffer.from(instruction.data);
  if (data.length !== 32 || !data.subarray(0, 8).equals(CPMM_CREATE_POOL_DISCRIMINATOR)) throw new Error("Submitted transaction contains an unexpected Raydium CPMM instruction");

  const ixKeys = instruction.accountKeyIndexes.map((accountIndex) => keys[accountIndex]);
  const creator = ixKeys[0];
  const pool = ixKeys[3];
  const mintA = ixKeys[4];
  const mintB = ixKeys[5];
  const userVaultA = ixKeys[7];
  const userVaultB = ixKeys[8];
  if (!creator || !pool || !mintA || !mintB || !userVaultA || !userVaultB) throw new Error("Raydium pool instruction has incomplete account wiring");
  if (!creator.equals(developer)) throw new Error("Raydium pool creator does not match the graduation developer");
  if (!pool.equals(poolId)) throw new Error("Raydium pool instruction is not bound to the submitted pool ID");
  if (!mintA.equals(mint) && !mintB.equals(mint)) throw new Error("Raydium pool instruction does not contain the Fair Launch mint");
  if (!mintA.equals(new PublicKey(WSOL)) && !mintB.equals(new PublicKey(WSOL))) throw new Error("Raydium graduation pool must contain canonical WSOL");

  const tokenIsA = mintA.equals(mint);
  const tokenUserVault = tokenIsA ? userVaultA : userVaultB;
  const wsolUserVault = tokenIsA ? userVaultB : userVaultA;
  const amountA = data.readBigUInt64LE(8);
  const amountB = data.readBigUInt64LE(16);
  const expectedA = tokenIsA ? tokenBaseUnits : solLamports;
  const expectedB = tokenIsA ? solLamports : tokenBaseUnits;
  if (amountA !== expectedA || amountB !== expectedB) throw new Error("Raydium pool amounts do not match the verified graduation amounts");
  return { index, wsolUserVault, tokenUserVault, amountA, amountB, mintA, mintB };
}

async function assertDeveloperFundedWsol(parsed: ParsedTransaction, developer: PublicKey, wsolUserVault: PublicKey, expectedSolLamports: bigint, connection: Connection): Promise<void> {
  const instructions = parsed.transaction.message.instructions;
  const fundingIndex = instructions.findIndex((instruction) => {
    if (!("parsed" in instruction) || instruction.program !== "system" || instruction.parsed?.type !== "createAccountWithSeed") return false;
    const info = instruction.parsed.info as { source?: string; base?: string; newAccount?: string; seed?: string; lamports?: number; space?: number; owner?: string };
    return info.source === developer.toBase58() && info.base === developer.toBase58() && info.newAccount === wsolUserVault.toBase58();
  });
  if (fundingIndex < 0) throw new Error("Submitted graduation does not prove developer-funded WSOL account creation");

  const funding = instructions[fundingIndex];
  if (!("parsed" in funding) || funding.program !== "system") throw new Error("Invalid WSOL funding instruction");
  const info = funding.parsed.info as { source?: string; base?: string; newAccount?: string; seed?: string; lamports?: number; space?: number; owner?: string };
  if (info.source !== developer.toBase58() || info.base !== developer.toBase58() || info.newAccount !== wsolUserVault.toBase58()) throw new Error("WSOL account creation is not controlled by the graduation developer");
  if (typeof info.seed !== "string" || info.seed.length > 32) throw new Error("WSOL account creation has an invalid seed");
  if (info.space !== TOKEN_ACCOUNT_LEN || info.owner !== TOKEN_PROGRAM) throw new Error("Developer-funded WSOL account has invalid SPL Token account parameters");
  if (!(await PublicKey.createWithSeed(developer, info.seed, new PublicKey(TOKEN_PROGRAM))).equals(wsolUserVault)) throw new Error("WSOL funding account is not the canonical developer-derived account");

  const rent = await connection.getMinimumBalanceForRentExemption(TOKEN_ACCOUNT_LEN, "confirmed");
  const createdLamports = BigInt(String(info.lamports ?? 0));
  const expectedCreatedLamports = expectedSolLamports + BigInt(rent);
  if (createdLamports !== expectedCreatedLamports) throw new Error("Developer-funded WSOL account does not contain exactly the graduation SOL plus required rent");

  const initializeIndex = instructions.findIndex((instruction, index) => {
    if (index <= fundingIndex || !("parsed" in instruction) || instruction.program !== "spl-token" || instruction.parsed?.type !== "initializeAccount") return false;
    const parsedInfo = instruction.parsed.info as { account?: string; mint?: string; owner?: string };
    return parsedInfo.account === wsolUserVault.toBase58() && parsedInfo.mint === WSOL && parsedInfo.owner === developer.toBase58();
  });
  if (initializeIndex < 0) throw new Error("Developer-funded WSOL source is not initialized for the canonical WSOL mint");
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
    const parsedTransaction = await connection.getParsedTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (!parsedTransaction || parsedTransaction.meta?.err) throw new Error("Unable to parse the confirmed graduation transaction");

    const migrationIndex = findMigrationIndex(transaction, programId, state, mint, developer);

    const stateInfo = await connection.getAccountInfo(state, "confirmed");
    if (!stateInfo || stateInfo.data.length !== STATE_LEN || !stateInfo.owner.equals(programId)) throw new Error("Fair Launch state is missing, has an invalid layout, or is owned by the wrong program");
    const data = stateInfo.data;
    if (data[0] !== STATE_VERSION) throw new Error("Unsupported Fair Launch state version");
    const stateDeveloper = new PublicKey(data.subarray(1, 33));
    if (!stateDeveloper.equals(developer)) throw new Error("Developer does not match Fair Launch state");
    if (data[33] !== STATUS_MIGRATED) throw new Error("Fair Launch has not been migrated yet");

    const expectedCpmmProgram = CLUSTER === "devnet" ? DEVNET_CPMM : MAINNET_CPMM;
    const realSolRaised = data.readBigUInt64LE(42);
    const tokenBaseUnits = data.readBigUInt64LE(58);
    const poolCheck = findPoolInstruction(transaction, expectedCpmmProgram, poolId, mint, developer, realSolRaised, tokenBaseUnits);
    if (migrationIndex >= poolCheck.index) throw new Error("Fair Launch migration must occur before Raydium pool creation");
    await assertDeveloperFundedWsol(parsedTransaction, developer, poolCheck.wsolUserVault, realSolRaised, connection);

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

    return NextResponse.json({ verified: true, cluster: CLUSTER, mint: mint.toBase58(), developer: developer.toBase58(), signature, fairLaunchState: state.toBase58(), fairLaunchStatus: "MIGRATED", poolId: poolId.toBase58(), poolProgramId: poolAccount.owner.toBase58(), poolMints: [mintA, mintB], liquidity: { tokenBaseUnits: tokenVaultAmount, wsolLamports: wsolVaultAmount } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify graduation";
    return NextResponse.json({ verified: false, error: message }, { status: 400 });
  }
}
