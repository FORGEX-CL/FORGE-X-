export const FORGE_X_FAIR_LAUNCH = Object.freeze({
  supply: 1_000_000_000n,
  decimals: 9,
  developerFirstBuyRequired: true,
  mintAuthorityRevoked: true,
  freezeAuthorityRevoked: true,
  metadataAuthorityRevoked: true,
  tradingFeeBps: 50,
  graduation: {
    // Protocol-level threshold placeholder; must be configured before Mainnet.
    enabled: true,
  },
});

export function tokenBaseUnits(tokens: bigint): bigint {
  if (tokens < 0n) throw new Error("Token amount cannot be negative");
  return tokens * 10n ** BigInt(FORGE_X_FAIR_LAUNCH.decimals);
}

export function assertFairLaunchSupply(supply: bigint): void {
  if (supply !== FORGE_X_FAIR_LAUNCH.supply) {
    throw new Error("FORGE X Fair Launch supply must be exactly 1,000,000,000 tokens");
  }
}

export function calculateTradingFee(lamports: bigint): bigint {
  if (lamports < 0n) throw new Error("Amount cannot be negative");
  return (lamports * BigInt(FORGE_X_FAIR_LAUNCH.tradingFeeBps)) / 10_000n;
}
