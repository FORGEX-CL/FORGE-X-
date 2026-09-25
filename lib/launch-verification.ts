import { Connection, PublicKey } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { fetchDigitalAsset, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { publicKey } from "@metaplex-foundation/umi";

export type LaunchVerification = {
  mint: string;
  supply: bigint;
  decimals: number;
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
  metadataAuthorityRevoked: boolean;
  metadataImmutable: boolean;
  metadataUri: string;
  name: string;
  symbol: string;
  valid: boolean;
};

export async function verifyFairLaunchMint(
  connection: Connection,
  mintAddress: string,
  expectedSupply: bigint,
): Promise<LaunchVerification> {
  const mint = new PublicKey(mintAddress);
  const state = await getMint(connection, mint, "confirmed");
  const mintAuthorityRevoked = state.mintAuthority === null;
  const freezeAuthorityRevoked = state.freezeAuthority === null;

  const umi = createUmi(connection.rpcEndpoint, "confirmed").use(mplTokenMetadata());
  const asset = await fetchDigitalAsset(umi, publicKey(mintAddress));
  const metadataAuthorityRevoked = asset.metadata.updateAuthority === publicKey(PublicKey.default.toBase58());
  const metadataImmutable = asset.metadata.isMutable === false;
  const metadataUri = asset.metadata.uri;

  const valid = state.supply === expectedSupply * (10n ** BigInt(state.decimals))
    && state.decimals === 9
    && mintAuthorityRevoked
    && freezeAuthorityRevoked
    && metadataAuthorityRevoked
    && metadataImmutable;

  return {
    mint: mint.toBase58(),
    supply: state.supply,
    decimals: state.decimals,
    mintAuthorityRevoked,
    freezeAuthorityRevoked,
    metadataAuthorityRevoked,
    metadataImmutable,
    metadataUri,
    name: asset.metadata.name,
    symbol: asset.metadata.symbol,
    valid,
  };
}
