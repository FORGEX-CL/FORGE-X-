export const FORGE_X_FAIR_LAUNCH = Object.freeze({
  supply: 1_000_000_000n,
  decimals: 9,
  developerFirstBuyRequired: true,
  mintAuthorityRevoked: true,
  freezeAuthorityRevoked: true,
  metadataAuthorityRevokedAfterFinalization: true,
  network: "devnet" as const,
});

export function validateFairLaunchConfig(input: { supply?: bigint; decimals?: number }) {
  if (input.supply !== undefined && input.supply !== FORGE_X_FAIR_LAUNCH.supply) throw new Error("FORGE X Fair Launch supply is fixed at 1,000,000,000");
  if (input.decimals !== undefined && input.decimals !== FORGE_X_FAIR_LAUNCH.decimals) throw new Error("FORGE X Fair Launch uses 9 decimals");
  return FORGE_X_FAIR_LAUNCH;
}
