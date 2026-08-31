export const FORGE_X_SUPPLY = 1_000_000_000n;
export const FORGE_X_SCALE = 1_000_000n;

export type FairLaunchConfig = {
  virtualSol: bigint;
  virtualTokens: bigint;
  graduationSol: bigint;
  developerBuyLamports: bigint;
};

export function validateFairLaunch(config: FairLaunchConfig) {
  if (config.virtualSol <= 0n || config.virtualTokens <= 0n) throw new Error("Bonding-curve virtual reserves must be positive");
  if (config.graduationSol <= 0n) throw new Error("Graduation target must be positive");
  if (config.developerBuyLamports <= 0n) throw new Error("Developer first buy is required");
  return true;
}

// Constant-product reference curve used by the application layer.
// This is intentionally pure math: no funds move here. On-chain settlement
// must enforce the same invariants in the launch program before Mainnet use.
export function quoteBuy(solIn: bigint, virtualSol: bigint, virtualTokens: bigint) {
  if (solIn <= 0n || virtualSol <= 0n || virtualTokens <= 0n) throw new Error("Invalid curve inputs");
  const k = virtualSol * virtualTokens;
  const newSol = virtualSol + solIn;
  const newTokens = k / newSol;
  return virtualTokens - newTokens;
}

export function currentPrice(virtualSol: bigint, virtualTokens: bigint) {
  if (virtualSol <= 0n || virtualTokens <= 0n) throw new Error("Invalid reserves");
  return { numerator: virtualSol, denominator: virtualTokens };
}
