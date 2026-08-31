export const FORGE_X_SUPPLY = 1_000_000_000n;
export const FORGE_X_DECIMALS = 9;

export type FairLaunchConfig = {
  virtualSolReserve: bigint;
  virtualTokenReserve: bigint;
  graduationSol: bigint;
  developerMinBuy: bigint;
  launchFeeLamports: bigint;
  tradeFeeBps: bigint;
};

export const DEFAULT_FAIR_LAUNCH: FairLaunchConfig = {
  virtualSolReserve: 30_000_000_000n,
  virtualTokenReserve: FORGE_X_SUPPLY * 1_000_000_000n,
  graduationSol: 85_000_000_000n,
  developerMinBuy: 500_000_000n,
  launchFeeLamports: 20_000_000n,
  tradeFeeBps: 50n,
};

function assertPositive(value: bigint, label: string) {
  if (value <= 0n) throw new Error(`${label} must be greater than zero`);
}

export function quoteBuy(solIn: bigint, virtualSolReserve: bigint, virtualTokenReserve: bigint) {
  assertPositive(solIn, "solIn"); assertPositive(virtualSolReserve, "virtualSolReserve"); assertPositive(virtualTokenReserve, "virtualTokenReserve");
  const tokenOut = (virtualTokenReserve * solIn) / (virtualSolReserve + solIn);
  if (tokenOut <= 0n || tokenOut >= virtualTokenReserve) throw new Error("Invalid curve quote");
  return tokenOut;
}

export function quoteSell(tokenIn: bigint, virtualSolReserve: bigint, virtualTokenReserve: bigint) {
  assertPositive(tokenIn, "tokenIn"); assertPositive(virtualSolReserve, "virtualSolReserve"); assertPositive(virtualTokenReserve, "virtualTokenReserve");
  if (tokenIn >= virtualTokenReserve) throw new Error("Sell exceeds curve reserve");
  return (virtualSolReserve * tokenIn) / (virtualTokenReserve + tokenIn);
}

export function applyTradeFee(amount: bigint, feeBps: bigint) {
  if (amount < 0n || feeBps < 0n || feeBps > 10_000n) throw new Error("Invalid fee");
  return (amount * feeBps) / 10_000n;
}

export function canOpenPublicTrading(developerBuy: bigint, config = DEFAULT_FAIR_LAUNCH) {
  return developerBuy >= config.developerMinBuy;
}

export function hasGraduated(realSolRaised: bigint, config = DEFAULT_FAIR_LAUNCH) {
  return realSolRaised >= config.graduationSol;
}

export function fairLaunchRules() {
  return { supply: FORGE_X_SUPPLY, decimals: FORGE_X_DECIMALS, fixedSupply: true, developerFirstBuyRequired: true, mintAuthority: null, freezeAuthority: null, metadataUpdateAuthorityAfterFinalization: null } as const;
}
