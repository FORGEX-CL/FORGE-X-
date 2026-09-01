import { PublicKey, Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import BN from "bn.js";
import { Raydium, DEVNET_PROGRAM_ID, TxVersion } from "@raydium-io/raydium-sdk-v2";

export type WalletSigner = {
  publicKey: PublicKey;
  signAllTransactions: <T extends Transaction | VersionedTransaction>(transactions: T[]) => Promise<T[]>;
};

export type CreateDevnetCpmmPoolInput = {
  connection: Connection;
  wallet: WalletSigner;
  mintA: PublicKey;
  mintB: PublicKey;
  amountA: bigint;
  amountB: bigint;
  startTime?: bigint;
};

export async function createDevnetCpmmPool(input: CreateDevnetCpmmPoolInput) {
  if (input.mintA.equals(input.mintB)) throw new Error("Pool mints must be different");
  if (input.amountA <= 0n || input.amountB <= 0n) throw new Error("Initial pool amounts must be positive");

  const raydium = await Raydium.load({
    owner: input.wallet.publicKey,
    connection: input.connection,
    cluster: "devnet",
    signAllTransactions: input.wallet.signAllTransactions,
  });

  const [mintA, mintB] = await Promise.all([
    raydium.token.getTokenInfo(input.mintA.toBase58()),
    raydium.token.getTokenInfo(input.mintB.toBase58()),
  ]);

  const feeConfigs = await raydium.api.getCpmmConfigs();
  if (!feeConfigs.length) throw new Error("No Raydium Devnet CPMM fee configuration available");

  const feeConfig = { ...feeConfigs[0], id: new PublicKey(feeConfigs[0].id) };

  const { execute, extInfo } = await raydium.cpmm.createPool({
    programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
    poolFeeAccount: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC,
    mintA,
    mintB,
    mintAAmount: new BN(input.amountA.toString()),
    mintBAmount: new BN(input.amountB.toString()),
    startTime: new BN((input.startTime ?? BigInt(Math.floor(Date.now() / 1000))).toString()),
    feeConfig,
    associatedOnly: true,
    ownerInfo: { useSOLBalance: true, feePayer: input.wallet.publicKey },
    txVersion: TxVersion.V0,
  });

  const result = await execute({ sendAndConfirm: true });
  return { txId: result.txId, poolId: extInfo.address?.poolId?.toBase58?.() ?? extInfo.poolId?.toBase58?.() ?? null };
}
