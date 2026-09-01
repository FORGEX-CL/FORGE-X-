import { PublicKey } from "@solana/web3.js";

export type CpmmPoolPlan = {
  mintA: string;
  mintB: string;
  amountA: bigint;
  amountB: bigint;
  requiresWalletSignature: true;
  devnet: true;
};

export function prepareRaydiumCpmmPlan(mintA: string, mintB: string, amountA: bigint, amountB: bigint): CpmmPoolPlan {
  new PublicKey(mintA);
  new PublicKey(mintB);
  if (amountA <= 0n || amountB <= 0n) throw new Error("Pool amounts must be positive");
  return { mintA, mintB, amountA, amountB, requiresWalletSignature: true, devnet: true };
}
