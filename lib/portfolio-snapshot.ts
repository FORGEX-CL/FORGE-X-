export type TokenBalance = {
  mint: string;
  rawAmount: bigint;
  decimals: number;
};

export type PortfolioSnapshot = {
  owner: string;
  solLamports: bigint;
  tokens: TokenBalance[];
  capturedAt: number;
};

export function createPortfolioSnapshot(owner: string, solLamports: bigint, tokens: TokenBalance[]): PortfolioSnapshot {
  if (!owner) throw new Error("Wallet address is required");
  if (solLamports < 0n) throw new Error("SOL balance cannot be negative");
  for (const token of tokens) {
    if (!token.mint) throw new Error("Token mint is required");
    if (token.rawAmount < 0n) throw new Error("Token balance cannot be negative");
    if (!Number.isInteger(token.decimals) || token.decimals < 0 || token.decimals > 18) throw new Error("Invalid token decimals");
  }
  return { owner, solLamports, tokens: [...tokens], capturedAt: Date.now() };
}
