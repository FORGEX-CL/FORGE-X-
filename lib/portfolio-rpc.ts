import { Connection, PublicKey } from "@solana/web3.js";
import type { PortfolioSnapshot, TokenBalance } from "./portfolio-snapshot";

export async function fetchPortfolioSnapshot(connection: Connection, ownerAddress: string): Promise<PortfolioSnapshot> {
  const owner = new PublicKey(ownerAddress);
  const [lamports, accounts] = await Promise.all([
    connection.getBalance(owner, "confirmed"),
    connection.getParsedTokenAccountsByOwner(owner, { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") }, "confirmed"),
  ]);

  const tokens: TokenBalance[] = accounts.value
    .map(({ account }) => account.data.parsed.info)
    .filter((info) => BigInt(info.tokenAmount.amount) > 0n)
    .map((info) => ({
      mint: info.mint,
      rawAmount: BigInt(info.tokenAmount.amount),
      decimals: Number(info.tokenAmount.decimals),
    }));

  return {
    owner: owner.toBase58(),
    solLamports: BigInt(lamports),
    tokens,
    capturedAt: Date.now(),
  };
}
