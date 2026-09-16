import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import bs58 from "bs58";

const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet" ? "devnet" : "mainnet";
const RPC = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || (CLUSTER === "devnet" ? "https://api.devnet.solana.com" : "https://api.mainnet-beta.solana.com");
const WSOL = new PublicKey("So11111111111111111111111111111111111111112");
const MAINNET_CPMM = new PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C");
const DEVNET_CPMM = new PublicKey("DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpY");
const CPMM_CREATE_POOL_DISCRIMINATOR = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);

type ConfirmedTransaction = NonNullable<Awaited<ReturnType<Connection["getTransaction"]>>>;

function key(value: string | null, field: string): PublicKey {
  if (!value?.trim()) throw new Error(`${field} is required`);
  try { return new PublicKey(value); } catch { throw new Error(`${field} is invalid`); }
}

function amount(value: string | null, field: string): bigint {
  if (!value || !/^\d+$/.test(value)) throw new Error(`${field} must be a positive integer string`);
  const parsed = BigInt(value);
  if (parsed <= 0n) throw new Error(`${field} must be positive`);
  return parsed;
}

function accountKeys(transaction: ConfirmedTransaction): PublicKey[] {
  const staticKeys = transaction.transaction.message.getAccountKeys().staticAccountKeys;
  const loaded = transaction.meta?.loadedAddresses;
  return [...staticKeys, ...(loaded?.writable ?? []), ...(loaded?.readonly ?? [])];
}

function findCreatePoolInstruction(
  transaction: ConfirmedTransaction,
  programId: PublicKey,
  poolId: PublicKey,
  wallet: PublicKey,
  mint: PublicKey,
  tokenBaseUnits: bigint,
  solLamports: bigint,
): void {
  const keys = accountKeys(transaction);
  const matches = transaction.transaction.message.compiledInstructions
    .map((instruction, index) => ({ instruction, index }))
    .filter(({ instruction }) => {
      if (!keys[instruction.programIdIndex]?.equals(programId)) return false;
      return instruction.accountKeyIndexes.some((index) => keys[index]?.equals(poolId));
    });

  if (matches.length !== 1) throw new Error("Submitted transaction must contain exactly one Raydium CPMM pool-creation instruction");
  const { instruction } = matches[0];
  const data = Buffer.from(bs58.decode(instruction.data));
  if (data.length !== 32 || !data.subarray(0, 8).equals(CPMM_CREATE_POOL_DISCRIMINATOR)) throw new Error("Submitted transaction contains an unexpected Raydium CPMM instruction");

  const ixKeys = instruction.accountKeyIndexes.map((index) => keys[index]);
  const creator = ixKeys[0];
  const pool = ixKeys[3];
  const mintA = ixKeys[4];
  const mintB = ixKeys[5];
  if (!creator || !pool || !mintA || !mintB) throw new Error("Raydium CPMM instruction has incomplete account wiring");
  if (!creator.equals(wallet) || !transaction.transaction.message.getAccountKeys().staticAccountKeys[0]?.equals(wallet)) throw new Error("Pool creation is not bound to the connected wallet");
  if (!instruction.accountKeyIndexes.includes(0)) throw new Error("Pool creator must be the transaction fee payer");
  if (!pool.equals(poolId)) throw new Error("Pool creation instruction is not bound to the submitted pool ID");
  if (!mintA.equals(mint) && !mintB.equals(mint)) throw new Error("Pool creation instruction does not contain the requested token mint");
  if (!mintA.equals(WSOL) && !mintB.equals(WSOL)) throw new Error("FORGE X advanced liquidity must use canonical WSOL");

  const amountA = data.readBigUInt64LE(8);
  const amountB = data.readBigUInt64LE(16);
  const tokenIsA = mintA.equals(mint);
  const expectedA = tokenIsA ? tokenBaseUnits : solLamports;
  const expectedB = tokenIsA ? solLamports : tokenBaseUnits;
  if (amountA !== expectedA || amountB !== expectedB) throw new Error("Confirmed pool creation amounts do not match the requested liquidity");
}

export async function GET(request: NextRequest) {
  try {
    const wallet = key(request.nextUrl.searchParams.get("wallet"), "wallet");
    const mint = key(request.nextUrl.searchParams.get("mint"), "mint");
    const poolId = key(request.nextUrl.searchParams.get("poolId"), "poolId");
    const signature = request.nextUrl.searchParams.get("signature");
    if (!signature || !/^[1-9A-HJ-NP-Za-km-z]{32,100}$/.test(signature)) throw new Error("signature is required and invalid");
    const tokenBaseUnits = amount(request.nextUrl.searchParams.get("tokenBaseUnits"), "tokenBaseUnits");
    const solLamports = amount(request.nextUrl.searchParams.get("solLamports"), "solLamports");

    const expectedCpmmProgram = CLUSTER === "devnet" ? DEVNET_CPMM : MAINNET_CPMM;
    const connection = new Connection(RPC, "confirmed");
    const transaction = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (!transaction || transaction.meta?.err) throw new Error("Pool transaction was not found or failed");
    findCreatePoolInstruction(transaction, expectedCpmmProgram, poolId, wallet, mint, tokenBaseUnits, solLamports);

    const poolAccount = await connection.getAccountInfo(poolId, "confirmed");
    if (!poolAccount || !poolAccount.owner.equals(expectedCpmmProgram)) throw new Error("Pool account is not owned by the expected Raydium CPMM program");

    const raydium = await Raydium.load({ connection, owner: wallet, disableLoadToken: true, cluster: CLUSTER });
    const rpcPool = await raydium.cpmm.getPoolInfoFromRpc(poolId.toBase58());
    const info = rpcPool.poolInfo;
    if (!info || info.programId !== expectedCpmmProgram.toBase58()) throw new Error("Pool is not an expected Raydium CPMM pool on this network");

    const mintA = typeof info.mintA === "string" ? info.mintA : info.mintA?.address;
    const mintB = typeof info.mintB === "string" ? info.mintB : info.mintB?.address;
    if (!mintA || !mintB) throw new Error("Raydium CPMM pool mint information is incomplete");
    if (!((mintA === mint.toBase58() && mintB === WSOL.toBase58()) || (mintB === mint.toBase58() && mintA === WSOL.toBase58()))) {
      throw new Error("Verified pool mints do not exactly match the requested token and canonical WSOL");
    }

    const tokenVaultAmount = BigInt(String(mintA === mint.toBase58() ? rpcPool.rpcData.vaultAAmount : rpcPool.rpcData.vaultBAmount));
    const wsolVaultAmount = BigInt(String(mintA === WSOL.toBase58() ? rpcPool.rpcData.vaultAAmount : rpcPool.rpcData.vaultBAmount));
    if (tokenVaultAmount < tokenBaseUnits || wsolVaultAmount < solLamports) throw new Error("Verified pool vault balances are below the requested initial liquidity");

    return NextResponse.json({
      verified: true,
      cluster: CLUSTER,
      wallet: wallet.toBase58(),
      mint: mint.toBase58(),
      poolId: poolId.toBase58(),
      signature,
      programId: expectedCpmmProgram.toBase58(),
      poolMints: [mintA, mintB],
      liquidity: { tokenBaseUnits: tokenVaultAmount.toString(), solLamports: wsolVaultAmount.toString() },
      initialLiquidity: { tokenBaseUnits: tokenBaseUnits.toString(), solLamports: solLamports.toString() },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify Advanced Launch pool";
    return NextResponse.json({ verified: false, error: message }, { status: 400 });
  }
}
