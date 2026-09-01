import { Connection, PublicKey } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";

export type LaunchVerification = {
  mint: string;
  supply: bigint;
  decimals: number;
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
  valid: boolean;
};

export async function verifyFairLaunchMint(connection: Connection, mintAddress: string, expectedSupply: bigint): Promise<LaunchVerification> {
  const mint = new PublicKey(mintAddress);
  const state = await getMint(connection, mint, "confirmed");
  const mintAuthorityRevoked = state.mintAuthority === null;
  const freezeAuthorityRevoked = state.freezeAuthority === null;
  const valid = state.supply === expectedSupply * (10n ** BigInt(state.decimals))
    && state.decimals === 9
    && mintAuthorityRevoked
    && freezeAuthorityRevoked;

  return {
    mint: mint.toBase58(),
    supply: state.supply,
    decimals: state.decimals,
    mintAuthorityRevoked,
    freezeAuthorityRevoked,
    valid,
  };
}
