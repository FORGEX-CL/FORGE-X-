import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { ComputeBudgetProgram, Connection, PublicKey, TransactionInstruction, VersionedTransaction } from "@solana/web3.js";
import BN from "bn.js";
import { Raydium, CREATE_CPMM_POOL_FEE_ACC, CREATE_CPMM_POOL_PROGRAM, DEVNET_PROGRAM_ID, TxVersion, getCpmmPdaAmmConfigId } from "@raydium-io/raydium-sdk-v2";
import { buildMigrateFairLaunchToDeveloper, fairLaunchStatePda, fairLaunchVaultAta } from "./fair-launch-program";

const STATE_VERSION = 2;
const STATUS_GRADUATED = 2;
const STATE_LEN = 82;

export type GraduationTransactionInput = {
  connection: Connection;
  developer: PublicKey;
  mint: PublicKey;
  solLamports: bigint;
  tokenBaseUnits: bigint;
  startTime?: bigint;
};

export type PreparedGraduationTransaction = {
  transaction: VersionedTransaction;
  poolId: PublicKey;
  vault: PublicKey;
  developerTokenAccount: PublicKey;
  programId: PublicKey;
  solLamports: bigint;
  tokenBaseUnits: bigint;
};

function readU64(data: Buffer, offset: number): bigint {
  return data.readBigUInt64LE(offset);
}

function assertOnChainGraduationState(
  accountData: Buffer,
  expectedDeveloper: PublicKey,
  expectedSol: bigint,
  expectedTokens: bigint,
): void {
  if (accountData.length < STATE_LEN || accountData[0] !== STATE_VERSION) {
    throw new Error("Invalid Fair Launch state account");
  }
  const developer = new PublicKey(accountData.subarray(1, 33));
  const status = accountData[33];
  const realSolRaised = readU64(accountData, 42);
  const virtualTokenReserve = readU64(accountData, 58);
  if (!developer.equals(expectedDeveloper)) throw new Error("Graduation developer does not match launch state");
  if (status !== STATUS_GRADUATED) throw new Error("Fair Launch has not reached graduation state");
  if (realSolRaised !== expectedSol) throw new Error("Graduation SOL amount does not match on-chain state");
  if (virtualTokenReserve !== expectedTokens) throw new Error("Graduation token reserve does not match on-chain state");
}

export async function prepareRaydiumCpmmGraduation(
  input: GraduationTransactionInput,
): Promise<PreparedGraduationTransaction> {
  if (input.solLamports <= 0n || input.tokenBaseUnits <= 0n) throw new Error("Graduation liquidity must be positive");
  if (input.mint.equals(PublicKey.default)) throw new Error("Invalid graduation mint");

  const programId = process.env.NEXT_PUBLIC_FORGE_X_PROGRAM_ID
    ? new PublicKey(process.env.NEXT_PUBLIC_FORGE_X_PROGRAM_ID)
    : null;
  if (!programId) throw new Error("FORGE X Fair Launch program ID is not configured");

  const state = fairLaunchStatePda(input.mint, programId);
  const vault = fairLaunchVaultAta(input.mint, programId);
  const stateInfo = await input.connection.getAccountInfo(state, "confirmed");
  if (!stateInfo) throw new Error("Fair Launch state account was not found");
  assertOnChainGraduationState(stateInfo.data, input.developer, input.solLamports, input.tokenBaseUnits);

  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet" ? "devnet" : "mainnet";
  const raydium = await Raydium.load({
    owner: input.developer,
    connection: input.connection,
    cluster,
  });

  const tokenInfo = await raydium.token.getTokenInfo(input.mint.toBase58());
  const nativeInfo = await raydium.token.getTokenInfo("So11111111111111111111111111111111111111112");
  const feeConfigs = await raydium.api.getCpmmConfigs();
  if (!feeConfigs.length) throw new Error("No Raydium CPMM fee configuration is available");

  const cpmmProgramId = cluster === "devnet" ? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM : CREATE_CPMM_POOL_PROGRAM;
  const poolFeeAccount = cluster === "devnet" ? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC : CREATE_CPMM_POOL_FEE_ACC;
  const feeConfig = cluster === "devnet"
    ? { ...feeConfigs[0], id: getCpmmPdaAmmConfigId(cpmmProgramId, feeConfigs[0].index).publicKey.toBase58() }
    : feeConfigs[0];

  const developerTokenAccount = getAssociatedTokenAddressSync(
    input.mint,
    input.developer,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const developerTokenInfo = await input.connection.getAccountInfo(developerTokenAccount, "confirmed");
  if (!developerTokenInfo) {
    throw new Error("Developer token account must exist before atomic graduation; the Fair Launch first buy normally creates it");
  }

  const { builder, extInfo } = await raydium.cpmm.createPool({
    programId: cpmmProgramId,
    poolFeeAccount,
    mintA: tokenInfo,
    mintB: nativeInfo,
    mintAAmount: new BN(input.tokenBaseUnits.toString()),
    mintBAmount: new BN(input.solLamports.toString()),
    startTime: new BN((input.startTime ?? BigInt(Math.floor(Date.now() / 1000))).toString()),
    feeConfig,
    associatedOnly: true,
    ownerInfo: { useSOLBalance: true, feePayer: input.developer },
    txVersion: TxVersion.V0,
  });

  const migrationInstruction = buildMigrateFairLaunchToDeveloper(input.mint, input.developer, programId);
  const instructions = builder.AllTxData.instructions;
  const firstNonCompute = instructions.findIndex((ix: TransactionInstruction) => !ix.programId.equals(ComputeBudgetProgram.programId));
  instructions.splice(firstNonCompute < 0 ? instructions.length : firstNonCompute, 0, migrationInstruction);

  const rebuilt = await builder.versionBuild({
    txVersion: TxVersion.V0,
    extInfo,
    lookupTableAddress: builder.AllTxData.lookupTableAddress,
  });

  return {
    transaction: rebuilt.transaction,
    poolId: extInfo.address.poolId,
    vault,
    developerTokenAccount,
    programId,
    solLamports: input.solLamports,
    tokenBaseUnits: input.tokenBaseUnits,
  };
}
