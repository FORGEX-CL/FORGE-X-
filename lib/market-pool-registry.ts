export type MarketPool = {
  mint: string;
  poolAddress: string;
  tokenReserve: bigint;
  solReserveLamports: bigint;
  verified: boolean;
  updatedAt: number;
};

export function createMarketPoolRegistry() {
  const pools = new Map<string, MarketPool>();

  return {
    upsert(pool: MarketPool) {
      if (!pool.mint || !pool.poolAddress) throw new Error("Mint and pool address are required");
      if (pool.tokenReserve < 0n || pool.solReserveLamports < 0n) throw new Error("Pool reserves cannot be negative");
      pools.set(pool.mint, { ...pool, updatedAt: Date.now() });
    },
    get(mint: string) { return pools.get(mint); },
    list() { return [...pools.values()].sort((a, b) => b.updatedAt - a.updatedAt); },
  };
}
