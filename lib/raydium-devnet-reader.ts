import { Connection, PublicKey } from "@solana/web3.js";

export type DevnetPoolCheck = {
  poolAddress: string;
  exists: boolean;
  ownerProgram?: string;
  lamports?: number;
};

/**
 * Devnet-safe pool verification. Raydium's SDK demo recommends RPC pool
 * inspection on Devnet because the public pool API is mainnet-oriented.
 */
export async function verifyDevnetPool(
  connection: Connection,
  poolAddress: string,
  expectedProgramId?: string,
): Promise<DevnetPoolCheck> {
  const pool = new PublicKey(poolAddress);
  const account = await connection.getAccountInfo(pool, "confirmed");

  if (!account) return { poolAddress: pool.toBase58(), exists: false };

  const ownerProgram = account.owner.toBase58();
  if (expectedProgramId && ownerProgram !== expectedProgramId) {
    throw new Error("Pool account is owned by an unexpected program");
  }

  return {
    poolAddress: pool.toBase58(),
    exists: true,
    ownerProgram,
    lamports: account.lamports,
  };
}
