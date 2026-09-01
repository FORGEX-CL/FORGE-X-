import { Connection, PublicKey } from "@solana/web3.js";
import { FORGE_X_DECIMALS, FORGE_X_SUPPLY } from "./fair-launch";

export type ValidatedLaunchMint = Readonly<{
  mint: string;
  decimals: number;
  supply: bigint;
  mintAuthority: string | null;
  freezeAuthority: string | null;
}>;

/**
 * Reads the mint account from the selected Solana cluster and verifies the
 * fixed-supply Fair Launch invariants before a launch can proceed.
 */
export async function validateFairLaunchMint(connection: Connection, mintAddress: string): Promise<ValidatedLaunchMint> {
  const mint = new PublicKey(mintAddress);
  const info = await connection.getParsedAccountInfo(mint, "confirmed");
  if (!info.value) throw new Error("Fair Launch mint account was not found");

  const parsed = (info.value.data as any)?.parsed;
  if (parsed?.type !== "mint") throw new Error("Address is not an SPL mint account");

  const data = parsed.info;
  const decimals = Number(data.decimals);
  const supply = BigInt(data.supply);
  const mintAuthority = data.mintAuthority ?? null;
  const freezeAuthority = data.freezeAuthority ?? null;

  if (decimals !== FORGE_X_DECIMALS) throw new Error("Fair Launch mint must use 9 decimals");
  if (supply !== FORGE_X_SUPPLY * 10n ** BigInt(FORGE_X_DECIMALS)) {
    throw new Error("Fair Launch mint must contain exactly 1,000,000,000 tokens");
  }
  if (mintAuthority !== null) throw new Error("Mint authority must be revoked before Fair Launch goes live");
  if (freezeAuthority !== null) throw new Error("Freeze authority must be revoked before Fair Launch goes live");

  return Object.freeze({ mint: mint.toBase58(), decimals, supply, mintAuthority, freezeAuthority });
}
