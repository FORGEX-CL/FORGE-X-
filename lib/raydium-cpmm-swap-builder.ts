import { AddressLookupTableAccount, Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import BN from "bn.js";
import {
  ApiV3PoolInfoStandardItemCpmm,
  CpmmKeys,
  CpmmParsedRpcData,
  CREATE_CPMM_POOL_PROGRAM,
  CurveCalculator,
  DEVNET_PROGRAM_ID,
  FeeOn,
  getPdaObservationId,
  getPdaPoolAuthority,
  Raydium,
  TxVersion,
} from "@raydium-io/raydium-sdk-v2";
import { SOLANA_CLUSTER } from "@/lib/solana-client-config";

const CPMM_SWAP_BASE_INPUT_DISCRIMINATOR = Buffer.from([143, 190, 90, 218, 196, 30, 51, 222]);
const CPMM_SWAP_DATA_LENGTH = 24;

export type PrepareRaydiumCpmmSwapInput = {
  connection: Connection;
  trader: PublicKey;
  poolId: PublicKey;
  inputMint: PublicKey;
  inputAmount: bigint;
  slippage: number;
};

export type PreparedRaydiumCpmmSwap = {
  transaction: VersionedTransaction;
  poolId: PublicKey;
  inputMint: PublicKey;
  outputMint: PublicKey;
  inputAmount: bigint;
  outputAmount: bigint;
  minimumOutputAmount: bigint;
  tradeFee: bigint;
  programId: PublicKey;
  lastValidBlockHeight: number;
};

function cluster(): "mainnet" | "devnet" {
  return SOLANA_CLUSTER === "mainnet-beta" ? "mainnet" : "devnet";
}

function positiveSlippage(value: number) {
  if (!Number.isFinite(value) || value < 0.0001 || value > 0.05) {
    throw new Error("Slippage must be between 0.01% and 5%");
  }
  return value;
}

async function resolveTransactionAccountKeys(
  connection: Connection,
  transaction: VersionedTransaction,
): Promise<PublicKey[]> {
  if (transaction.message.version !== 0) {
    throw new Error("Raydium CPMM swap must use a V0 transaction");
  }

  const lookupAccounts: AddressLookupTableAccount[] = [];
  for (const lookup of transaction.message.addressTableLookups) {
    const result = await connection.getAddressLookupTable(lookup.accountKey, "confirmed");
    if (!result.value) {
      throw new Error(`Address lookup table is unavailable: ${lookup.accountKey.toBase58()}`);
    }
    lookupAccounts.push(result.value);
  }

  const accountKeys = transaction.message.getAccountKeys({ addressLookupTableAccounts: lookupAccounts });
  const resolved = [...accountKeys.staticAccountKeys];
  if (accountKeys.accountKeysFromLookups) {
    resolved.push(...accountKeys.accountKeysFromLookups.writable);
    resolved.push(...accountKeys.accountKeysFromLookups.readonly);
  }
  return resolved;
}

function readU64(data: Buffer, offset: number): bigint {
  return data.readBigUInt64LE(offset);
}

async function auditSerializedSwap(
  connection: Connection,
  transaction: VersionedTransaction,
  expectedProgram: PublicKey,
  trader: PublicKey,
  poolId: PublicKey,
  inputMint: PublicKey,
  outputMint: PublicKey,
  inputAmount: bigint,
  minimumOutputAmount: bigint,
  poolInfo: ApiV3PoolInfoStandardItemCpmm,
  poolKeys: CpmmKeys,
): Promise<void> {
  const accountKeys = await resolveTransactionAccountKeys(connection, transaction);
  const matchingInstructions = transaction.message.compiledInstructions.filter(
    (instruction) => accountKeys[instruction.programIdIndex]?.equals(expectedProgram),
  );

  if (matchingInstructions.length !== 1) {
    throw new Error("Serialized swap must contain exactly one Raydium CPMM instruction");
  }

  const instruction = matchingInstructions[0];
  if (instruction.data.length !== CPMM_SWAP_DATA_LENGTH) {
    throw new Error("Serialized Raydium CPMM swap has unexpected instruction data length");
  }

  const data = Buffer.from(instruction.data);
  if (!data.subarray(0, CPMM_SWAP_BASE_INPUT_DISCRIMINATOR.length).equals(CPMM_SWAP_BASE_INPUT_DISCRIMINATOR)) {
    throw new Error("Serialized Raydium instruction is not swap_base_input");
  }

  const encodedInputAmount = readU64(data, 8);
  const encodedMinimumOutput = readU64(data, 16);
  if (encodedInputAmount !== inputAmount || encodedMinimumOutput !== minimumOutputAmount) {
    throw new Error("Serialized swap amounts do not match the server quote");
  }

  const keys = instruction.accountKeyIndexes.map((index) => accountKeys[index]);
  if (keys.some((key) => !key)) {
    throw new Error("Serialized swap contains an unresolved account key");
  }
  if (keys.length !== 13) {
    throw new Error("Serialized Raydium CPMM swap has unexpected account count");
  }

  const mintA = new PublicKey(poolInfo.mintA.address);
  const mintB = new PublicKey(poolInfo.mintB.address);
  const inputVault = inputMint.equals(mintA) ? new PublicKey(poolKeys.vault.A) : new PublicKey(poolKeys.vault.B);
  const outputVault = inputMint.equals(mintA) ? new PublicKey(poolKeys.vault.B) : new PublicKey(poolKeys.vault.A);
  const inputTokenProgram = new PublicKey(inputMint.equals(mintA) ? poolInfo.mintA.programId : poolInfo.mintB.programId);
  const outputTokenProgram = new PublicKey(outputMint.equals(mintA) ? poolInfo.mintA.programId : poolInfo.mintB.programId);

  const expected = [
    trader,
    getPdaPoolAuthority(expectedProgram).publicKey,
    new PublicKey(poolKeys.config.id),
    poolId,
    undefined,
    undefined,
    inputVault,
    outputVault,
    inputTokenProgram,
    outputTokenProgram,
    inputMint,
    outputMint,
    getPdaObservationId(expectedProgram, poolId).publicKey,
  ];

  for (const index of [0, 1, 2, 3, 6, 7, 8, 9, 10, 11, 12]) {
    if (!keys[index].equals(expected[index]!)) {
      throw new Error(`Serialized Raydium CPMM swap account ${index} does not match the verified pool wiring`);
    }
  }

  if (keys[4].equals(inputVault) || keys[4].equals(outputVault) || keys[5].equals(inputVault) || keys[5].equals(outputVault)) {
    throw new Error("Serialized swap user accounts must not be pool vaults");
  }
  if (keys[4].equals(keys[5])) {
    throw new Error("Serialized swap input and output accounts must be different");
  }
}

export async function prepareRaydiumCpmmSwap(input: PrepareRaydiumCpmmSwapInput): Promise<PreparedRaydiumCpmmSwap> {
  if (input.inputAmount <= 0n) throw new Error("Swap amount must be positive");
  if (input.inputAmount > 0xffffffffffffffffn) throw new Error("Swap amount exceeds u64");
  const slippage = positiveSlippage(input.slippage);
  const network = cluster();
  const expectedProgram = network === "devnet" ? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM : CREATE_CPMM_POOL_PROGRAM;

  const raydium = await Raydium.load({
    owner: input.trader,
    connection: input.connection,
    cluster: network,
  });

  const { poolInfo, poolKeys, rpcData }: {
    poolInfo: ApiV3PoolInfoStandardItemCpmm;
    poolKeys: CpmmKeys;
    rpcData: CpmmParsedRpcData;
  } = await raydium.cpmm.getPoolInfoFromRpc(input.poolId.toBase58());

  if (poolInfo.programId !== expectedProgram.toBase58() || poolKeys.programId !== expectedProgram.toBase58()) {
    throw new Error("Pool is not a verified Raydium CPMM pool");
  }

  const account = await input.connection.getAccountInfo(input.poolId, "confirmed");
  if (!account || !account.owner.equals(expectedProgram)) {
    throw new Error("Pool account failed on-chain program ownership verification");
  }

  const mintA = new PublicKey(poolInfo.mintA.address);
  const mintB = new PublicKey(poolInfo.mintB.address);
  if (!input.inputMint.equals(mintA) && !input.inputMint.equals(mintB)) {
    throw new Error("Input mint does not belong to the selected pool");
  }

  if (!new PublicKey(poolKeys.mintA).equals(mintA) || !new PublicKey(poolKeys.mintB).equals(mintB)) {
    throw new Error("Raydium pool metadata and live pool keys disagree");
  }

  const baseIn = input.inputMint.equals(mintA);
  const outputMint = baseIn ? mintB : mintA;
  const inputReserve = baseIn ? rpcData.baseReserve : rpcData.quoteReserve;
  const outputReserve = baseIn ? rpcData.quoteReserve : rpcData.baseReserve;
  const config = rpcData.configInfo;
  const zero = new BN(0);
  const swapResult = CurveCalculator.swapBaseInput(
    new BN(input.inputAmount.toString()),
    inputReserve,
    outputReserve,
    config?.tradeFeeRate ?? zero,
    config?.creatorFeeRate ?? zero,
    config?.protocolFeeRate ?? zero,
    config?.fundFeeRate ?? zero,
    rpcData.feeOn === FeeOn.BothToken || rpcData.feeOn === FeeOn.OnlyTokenB,
  );

  const outputAmount = BigInt(swapResult.outputAmount.toString());
  const tradeFee = BigInt(swapResult.tradeFee.toString());
  if (outputAmount <= 0n) throw new Error("Swap output is zero");

  const minimumOutputAmount = BigInt(
    new BN(outputAmount.toString()).mul(new BN(Math.round((1 - slippage) * 1_000_000))).div(new BN(1_000_000)).toString(),
  );

  const { transaction } = await raydium.cpmm.swap({
    poolInfo,
    poolKeys,
    inputAmount: new BN(input.inputAmount.toString()),
    swapResult,
    slippage,
    baseIn,
    txVersion: TxVersion.V0,
  });

  const latest = await input.connection.getLatestBlockhash("confirmed");
  transaction.message.recentBlockhash = latest.blockhash;

  await auditSerializedSwap(
    input.connection,
    transaction,
    expectedProgram,
    input.trader,
    input.poolId,
    input.inputMint,
    outputMint,
    input.inputAmount,
    minimumOutputAmount,
    poolInfo,
    poolKeys,
  );

  return {
    transaction,
    poolId: input.poolId,
    inputMint: input.inputMint,
    outputMint,
    inputAmount: input.inputAmount,
    outputAmount,
    minimumOutputAmount,
    tradeFee,
    programId: expectedProgram,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  };
}
