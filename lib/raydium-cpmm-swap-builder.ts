import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import BN from "bn.js";
import {
  CREATE_CPMM_POOL_PROGRAM,
  CurveCalculator,
  DEVNET_PROGRAM_ID,
  FeeOn,
  Raydium,
  TxVersion,
} from "@raydium-io/raydium-sdk-v2";

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
};

function cluster() {
  return process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta" ? "mainnet" : "devnet";
}

function positiveSlippage(value: number) {
  if (!Number.isFinite(value) || value < 0.0001 || value > 0.05) {
    throw new Error("Slippage must be between 0.01% and 5%");
  }
  return value;
}

export async function prepareRaydiumCpmmSwap(input: PrepareRaydiumCpmmSwapInput): Promise<PreparedRaydiumCpmmSwap> {
  if (input.inputAmount <= 0n) throw new Error("Swap amount must be positive");
  const slippage = positiveSlippage(input.slippage);
  const network = cluster();
  const expectedProgram = network === "devnet" ? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM : CREATE_CPMM_POOL_PROGRAM;

  const raydium = await Raydium.load({
    owner: input.trader,
    connection: input.connection,
    cluster: network,
  });

  let poolInfo: Awaited<ReturnType<typeof raydium.cpmm.getPoolInfoFromRpc>>["poolInfo"];
  let poolKeys: Awaited<ReturnType<typeof raydium.cpmm.getPoolInfoFromRpc>>["poolKeys"] | undefined;
  let rpcData: Awaited<ReturnType<typeof raydium.cpmm.getPoolInfoFromRpc>>["rpcData"];

  if (network === "mainnet") {
    const response = await raydium.api.fetchPoolById({ ids: input.poolId.toBase58() });
    const candidate = response[0];
    if (!candidate || candidate.programId !== expectedProgram.toBase58()) {
      throw new Error("Pool is not a verified Raydium CPMM pool");
    }
    poolInfo = candidate as typeof poolInfo;
    rpcData = await raydium.cpmm.getRpcPoolInfo(input.poolId.toBase58(), true);
  } else {
    const rpcPool = await raydium.cpmm.getPoolInfoFromRpc(input.poolId.toBase58());
    if (rpcPool.poolInfo.programId !== expectedProgram.toBase58()) {
      throw new Error("Pool is not a verified Raydium Devnet CPMM pool");
    }
    poolInfo = rpcPool.poolInfo;
    poolKeys = rpcPool.poolKeys;
    rpcData = rpcPool.rpcData;
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
  };
}
