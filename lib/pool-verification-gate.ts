import { Connection, PublicKey } from "@solana/web3.js";

export type PoolVerification = {
  poolAddress: string;
  exists: boolean;
  ownerProgram: string | null;
  lamports: number;
};

export async function verifyPoolOnChain(
  connection: Connection,
  poolAddress: string,
  expectedProgramId: string,
): Promise<PoolVerification> {
  const pool = new PublicKey(poolAddress);
  const expected = new PublicKey(expectedProgramId);
  const account = await connection.getAccountInfo(pool, "confirmed");

  if (!account) {
    return { poolAddress: pool.toBase58(), exists: false, ownerProgram: null, lamports: 0 };
  }

  if (!account.owner.equals(expected)) {
    throw new Error("Pool account exists but is owned by an unexpected program");
  }

  return {
    poolAddress: pool.toBase58(),
    exists: true,
    ownerProgram: account.owner.toBase58(),
    lamports: account.lamports,
  };
}

export function requireVerifiedPool(result: PoolVerification): string {
  if (!result.exists || !result.ownerProgram) {
    throw new Error("Pool is not confirmed on-chain");
  }
  return result.poolAddress;
}
