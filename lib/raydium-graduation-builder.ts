import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { ComputeBudgetProgram, Connection, PublicKey, TransactionInstruction, VersionedTransaction } from "@solana/web3.js";
import BN from "bn.js";
import { Raydium, CREATE_CPMM_POOL_FEE_ACC, CREATE_CPMM_POOL_PROGRAM, DEVNET_PROGRAM_ID, TxVersion, getCpmmPdaAmmConfigId } from "@raydium-io/raydium-sdk-v2";
import { buildMigrateFairLaunchToDeveloper, fairLaunchStatePda, fairLaunchVaultAta } from "./fair-launch-program";

const STATE_VERSION = 3;
const STATUS_GRADUATED = 2;
const STATE_LEN = 114;
const SPL_TOKEN_ACCOUNT_LEN = 165;
const SPL_TOKEN_MINT_OFFSET = 0;
const SPL_TOKEN_OWNER_OFFSET = 32;
const SPL_TOKEN_AMOUNT_OFFSET = 64;
const CPMM_CREATE_POOL_DISCRIMINATOR = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);

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

function assertOnChainGraduationState(accountData: Buffer, stateOwner: PublicKey, expectedProgram: PublicKey, expectedDeveloper: PublicKey, expectedSol: bigint, expectedTokens: bigint): void {
  if (!stateOwner.equals(expectedProgram)) throw new Error("Fair Launch state is owned by the wrong program");
  if (accountData.length !== STATE_LEN || accountData[0] !== STATE_VERSION) throw new Error("Invalid Fair Launch state account");
  const developer = new PublicKey(accountData.subarray(1, 33));
  const status = accountData[33];
  const realSolRaised = readU64(accountData, 42);
  const virtualTokenReserve = readU64(accountData, 58);
  if (!developer.equals(expectedDeveloper)) throw new Error("Graduation developer does not match launch state");
  if (status !== STATUS_GRADUATED) throw new Error("Fair Launch has not reached graduation state");
  if (realSolRaised !== expectedSol) throw new Error("Graduation SOL amount does not match on-chain state");
  if (virtualTokenReserve !== expectedTokens) throw new Error("Graduation token reserve does not match on-chain state");
}

function readTokenAccountAmount(accountData: Buffer): bigint {
  if (accountData.length !== SPL_TOKEN_ACCOUNT_LEN) throw new Error("Token account is invalid");
  return readU64(accountData, SPL_TOKEN_AMOUNT_OFFSET);
}

function assertTokenAccount(accountData: Buffer, expectedMint: PublicKey, expectedOwner: PublicKey, label: string): void {
  if (accountData.length !== SPL_TOKEN_ACCOUNT_LEN) throw new Error(`${label} is not a valid SPL token account`);
  const accountMint = new PublicKey(accountData.subarray(SPL_TOKEN_MINT_OFFSET, SPL_TOKEN_MINT_OFFSET + 32));
  const accountOwner = new PublicKey(accountData.subarray(SPL_TOKEN_OWNER_OFFSET, SPL_TOKEN_OWNER_OFFSET + 32));
  if (!accountMint.equals(expectedMint)) throw new Error(`${label} is for the wrong mint`);
  if (!accountOwner.equals(expectedOwner)) throw new Error(`${label} is controlled by the wrong owner`);
}

function assertRaydiumCreatePoolInstruction(
  transaction: VersionedTransaction,
  cpmmProgramId: PublicKey,
  poolId: PublicKey,
  developer: PublicKey,
  developerTokenAccount: PublicKey,
  mint: PublicKey,
  tokenBaseUnits: bigint,
  solLamports: bigint,
): void {
  const instructions = transaction.message.compiledInstructions;
  const matching = instructions.filter((ix) => {
    const programId = transaction.message.staticAccountKeys[ix.programIdIndex];
    if (!programId || !programId.equals(cpmmProgramId)) return false;
    const keys = ix.accountKeyIndexes.map((index) => transaction.message.staticAccountKeys[index]);
    return keys.some((key) => key?.equals(poolId));
  });

  if (matching.length !== 1) throw new Error("Graduation transaction must contain exactly one Raydium CPMM pool-creation instruction");

  const instruction = matching[0];
  const keys = instruction.accountKeyIndexes.map((index) => transaction.message.staticAccountKeys[index]);
  const data = Buffer.from(instruction.data);
  if (data.length !== 32 || !data.subarray(0, 8).equals(CPMM_CREATE_POOL_DISCRIMINATOR)) {
    throw new Error("Graduation transaction contains an unexpected Raydium CPMM instruction");
  }
  if (!keys[0]?.equals(developer) || !keys[0]) throw new Error("Raydium pool creator is not the graduation developer");
  if (!keys[3]?.equals(poolId)) throw new Error("Raydium pool ID is not bound to the verified graduation pool");

  const mintA = keys[4];
  const mintB = keys[5];
  const userVaultA = keys[7];
  const userVaultB = keys[8];
  if (!mintA || !mintB || !userVaultA || !userVaultB) throw new Error("Raydium CPMM pool instruction is missing required accounts");
  if (!(mintA.equals(mint) || mintB.equals(mint))) throw new Error("Raydium pool instruction does not contain the graduation mint");

  const tokenIsA = mintA.equals(mint);
  const tokenUserVault = tokenIsA ? userVaultA : userVaultB;
  if (!tokenUserVault.equals(developerTokenAccount)) throw new Error("Raydium CPMM is not sourcing the graduation token from the developer ATA");

  const amountA = readU64(data, 8);
  const amountB = readU64(data, 16);
  const expectedA = tokenIsA ? tokenBaseUnits : solLamports;
  const expectedB = tokenIsA ? solLamports : tokenBaseUnits;
  if (amountA !== expectedA || amountB !== expectedB) throw new Error("Raydium CPMM liquidity amounts do not match the verified graduation amounts");
}

export async function prepareRaydiumCpmmGraduation(input: GraduationTransactionInput): Promise<PreparedGraduationTransaction> {
  if (input.solLamports <= 0n || input.tokenBaseUnits <= 0n) throw new Error("Graduation liquidity must be positive");
  if (input.mint.equals(PublicKey.default)) throw new Error("Invalid graduation mint");

  const programId = process.env.NEXT_PUBLIC_FORGE_X_PROGRAM_ID ? new PublicKey(process.env.NEXT_PUBLIC_FORGE_X_PROGRAM_ID) : null;
  if (!programId) throw new Error("FORGE X Fair Launch program ID is not configured");

  const state = fairLaunchStatePda(input.mint, programId);
  const vault = fairLaunchVaultAta(input.mint, programId);
  const stateInfo = await input.connection.getAccountInfo(state, "confirmed");
  if (!stateInfo) throw new Error("Fair Launch state account was not found");
  assertOnChainGraduationState(stateInfo.data, stateInfo.owner, programId, input.developer, input.solLamports, input.tokenBaseUnits);

  const vaultInfo = await input.connection.getAccountInfo(vault, "confirmed");
  if (!vaultInfo || !vaultInfo.owner.equals(TOKEN_PROGRAM_ID)) throw new Error("Fair Launch token vault is missing or owned by the wrong token program");
  assertTokenAccount(vaultInfo.data, input.mint, state, "Fair Launch token vault");
  const actualVaultAmount = readTokenAccountAmount(vaultInfo.data);
  if (actualVaultAmount !== input.tokenBaseUnits) throw new Error("Graduation token amount does not match the actual Fair Launch vault balance");

  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet" ? "devnet" : "mainnet";
  const raydium = await Raydium.load({ owner: input.developer, connection: input.connection, cluster });
  const tokenInfo = await raydium.token.getTokenInfo(input.mint.toBase58());
  const nativeInfo = await raydium.token.getTokenInfo("So11111111111111111111111111111111111111112");
  const feeConfigs = await raydium.api.getCpmmConfigs();
  if (!feeConfigs.length) throw new Error("No Raydium CPMM fee configuration is available");

  const cpmmProgramId = cluster === "devnet" ? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM : CREATE_CPMM_POOL_PROGRAM;
  const poolFeeAccount = cluster === "devnet" ? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC : CREATE_CPMM_POOL_FEE_ACC;
  const feeConfig = cluster === "devnet"
    ? { ...feeConfigs[0], id: getCpmmPdaAmmConfigId(cpmmProgramId, feeConfigs[0].index).publicKey.toBase58() }
    : feeConfigs[0];

  const developerTokenAccount = getAssociatedTokenAddressSync(input.mint, input.developer, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const developerTokenInfo = await input.connection.getAccountInfo(developerTokenAccount, "confirmed");
  if (!developerTokenInfo || !developerTokenInfo.owner.equals(TOKEN_PROGRAM_ID)) {
    throw new Error("Developer token account must exist before atomic graduation; the Fair Launch first buy normally creates it");
  }
  assertTokenAccount(developerTokenInfo.data, input.mint, input.developer, "Developer token account");

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

  const rebuilt = await builder.versionBuild({ txVersion: TxVersion.V0, extInfo, lookupTableAddress: builder.AllTxData.lookupTableAddress });
  if (!(rebuilt.transaction instanceof VersionedTransaction)) throw new Error("Raydium CPMM graduation did not produce a versioned transaction");

  assertRaydiumCreatePoolInstruction(
    rebuilt.transaction,
    cpmmProgramId,
    extInfo.address.poolId,
    input.developer,
    developerTokenAccount,
    input.mint,
    input.tokenBaseUnits,
    input.solLamports,
  );

  const simulation = await input.connection.simulateTransaction(rebuilt.transaction, {
    sigVerify: false,
    replaceRecentBlockhash: true,
  });
  if (simulation.value.err) {
    const logs = simulation.value.logs?.filter(Boolean).slice(-8).join(" | ");
    throw new Error(`Graduation transaction simulation failed${logs ? `: ${logs}` : ""}`);
  }

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
