import { Connection, PublicKey, TransactionInstruction, VersionedTransaction } from "@solana/web3.js";
import BN from "bn.js";
import {
  CREATE_CPMM_POOL_FEE_ACC,
  CREATE_CPMM_POOL_PROGRAM,
  DEVNET_PROGRAM_ID,
  Raydium,
  TxVersion,
  getCpmmPdaAmmConfigId,
} from "@raydium-io/raydium-sdk-v2";

const WSOL = new PublicKey("So11111111111111111111111111111111111111112");
const CPMM_CREATE_POOL_DISCRIMINATOR = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);

export type CpmmPoolInputs = {
  owner: PublicKey;
  mintA: PublicKey;
  mintB: PublicKey;
  amountA: bigint;
  amountB: bigint;
};

export type PreparedRaydiumCpmmPool = {
  transaction: VersionedTransaction;
  poolId: PublicKey;
  programId: PublicKey;
  mint: PublicKey;
  tokenBaseUnits: bigint;
  solLamports: bigint;
};

export function validateCpmmPoolInputs(input: CpmmPoolInputs): void {
  if (input.mintA.equals(input.mintB)) throw new Error("Pool mints must be different");
  if (input.amountA <= 0n || input.amountB <= 0n) throw new Error("Initial pool amounts must be positive");
}

function readU64(data: Buffer, offset: number): bigint {
  if (data.length < offset + 8) throw new Error("Raydium CPMM instruction is truncated");
  return data.readBigUInt64LE(offset);
}

function auditCreatePoolInstruction(
  instructions: TransactionInstruction[],
  programId: PublicKey,
  poolId: PublicKey,
  wallet: PublicKey,
  mint: PublicKey,
  tokenBaseUnits: bigint,
  solLamports: bigint,
): void {
  const matches = instructions.filter((ix) => ix.programId.equals(programId) && ix.keys.some((key) => key.pubkey.equals(poolId)));
  if (matches.length !== 1) throw new Error("Prepared transaction must contain exactly one Raydium CPMM pool-creation instruction");

  const ix = matches[0];
  const data = Buffer.from(ix.data);
  if (data.length !== 32 || !data.subarray(0, 8).equals(CPMM_CREATE_POOL_DISCRIMINATOR)) {
    throw new Error("Prepared transaction contains an unexpected Raydium CPMM instruction");
  }
  if (!ix.keys[0]?.pubkey.equals(wallet) || !ix.keys[0].isSigner) throw new Error("Raydium CPMM creator is not the connected wallet");
  if (!ix.keys[3]?.pubkey.equals(poolId)) throw new Error("Raydium CPMM pool ID is not bound to the prepared transaction");

  const mintA = ix.keys[4]?.pubkey;
  const mintB = ix.keys[5]?.pubkey;
  if (!mintA || !mintB) throw new Error("Raydium CPMM instruction is missing mint accounts");
  if (!(mintA.equals(mint) || mintB.equals(mint))) throw new Error("Prepared pool does not contain the requested token mint");
  if (!(mintA.equals(WSOL) || mintB.equals(WSOL))) throw new Error("FORGE X liquidity pools must use canonical WSOL");

  const tokenIsA = mintA.equals(mint);
  const tokenUserVault = tokenIsA ? ix.keys[7] : ix.keys[8];
  if (!tokenUserVault?.isWritable) throw new Error("Token liquidity account must be writable");

  const amountA = readU64(data, 8);
  const amountB = readU64(data, 16);
  const expectedA = tokenIsA ? tokenBaseUnits : solLamports;
  const expectedB = tokenIsA ? solLamports : tokenBaseUnits;
  if (amountA !== expectedA || amountB !== expectedB) throw new Error("Raydium CPMM liquidity amounts do not match the requested values");
}

export async function prepareRaydiumCpmmPool(input: {
  connection: Connection;
  wallet: PublicKey;
  mint: PublicKey;
  tokenBaseUnits: bigint;
  solLamports: bigint;
  startTime?: bigint;
}): Promise<PreparedRaydiumCpmmPool> {
  validateCpmmPoolInputs({ owner: input.wallet, mintA: input.mint, mintB: WSOL, amountA: input.tokenBaseUnits, amountB: input.solLamports });

  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet" ? "devnet" : "mainnet";
  const raydium = await Raydium.load({ owner: input.wallet, connection: input.connection, cluster });
  const [tokenInfo, nativeInfo, feeConfigs] = await Promise.all([
    raydium.token.getTokenInfo(input.mint.toBase58()),
    raydium.token.getTokenInfo(WSOL.toBase58()),
    raydium.api.getCpmmConfigs(),
  ]);
  if (!feeConfigs.length) throw new Error("No Raydium CPMM fee configuration is available");

  const programId = cluster === "devnet" ? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM : CREATE_CPMM_POOL_PROGRAM;
  const poolFeeAccount = cluster === "devnet" ? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC : CREATE_CPMM_POOL_FEE_ACC;
  const feeConfig = cluster === "devnet"
    ? { ...feeConfigs[0], id: getCpmmPdaAmmConfigId(programId, feeConfigs[0].index).publicKey.toBase58() }
    : feeConfigs[0];

  const { builder, extInfo } = await raydium.cpmm.createPool({
    programId,
    poolFeeAccount,
    mintA: tokenInfo,
    mintB: nativeInfo,
    mintAAmount: new BN(input.tokenBaseUnits.toString()),
    mintBAmount: new BN(input.solLamports.toString()),
    startTime: new BN((input.startTime ?? BigInt(Math.floor(Date.now() / 1000))).toString()),
    feeConfig,
    associatedOnly: true,
    ownerInfo: { useSOLBalance: true, feePayer: input.wallet },
    txVersion: TxVersion.V0,
  });

  auditCreatePoolInstruction(builder.AllTxData.instructions, programId, extInfo.address.poolId, input.wallet, input.mint, input.tokenBaseUnits, input.solLamports);

  const rebuilt = await builder.versionBuild({
    txVersion: TxVersion.V0,
    extInfo,
    lookupTableAddress: builder.AllTxData.lookupTableAddress,
  });
  if (!(rebuilt.transaction instanceof VersionedTransaction)) throw new Error("Raydium CPMM did not produce a versioned transaction");

  const simulation = await input.connection.simulateTransaction(rebuilt.transaction, { sigVerify: false, replaceRecentBlockhash: true });
  if (simulation.value.err) {
    const logs = simulation.value.logs?.filter(Boolean).slice(-8).join(" | ");
    throw new Error(`Pool creation simulation failed${logs ? `: ${logs}` : ""}`);
  }

  return {
    transaction: rebuilt.transaction,
    poolId: extInfo.address.poolId,
    programId,
    mint: input.mint,
    tokenBaseUnits: input.tokenBaseUnits,
    solLamports: input.solLamports,
  };
}
