import { PublicKey } from "@solana/web3.js";

export type CpmmPoolInputs = {
  owner: PublicKey;
  mintA: PublicKey;
  mintB: PublicKey;
  amountA: bigint;
  amountB: bigint;
};

export function validateCpmmPoolInputs(input: CpmmPoolInputs): void {
  if (input.mintA.equals(input.mintB)) throw new Error("Pool mints must be different");
  if (input.amountA <= 0n || input.amountB <= 0n) throw new Error("Initial pool amounts must be positive");
}

/**
 * Returns the normalized inputs needed by the Raydium SDK V2 CPMM builder.
 * The actual Raydium transaction is intentionally built at runtime with the
 * current Devnet program/config IDs and the connected wallet as signer.
 */
export function prepareCpmmPoolInputs(input: CpmmPoolInputs) {
  validateCpmmPoolInputs(input);
  return {
    owner: input.owner,
    mintA: input.mintA,
    mintB: input.mintB,
    mintAAmount: input.amountA,
    mintBAmount: input.amountB,
    requiresWalletSignature: true as const,
    cluster: "devnet" as const,
  };
}
