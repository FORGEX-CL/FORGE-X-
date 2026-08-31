import { DEFAULT_FAIR_LAUNCH, FairLaunchConfig, applyTradeFee, canOpenPublicTrading, hasGraduated, quoteBuy, quoteSell } from "./fair-launch";

export type FairLaunchState = {
  developerBuyLamports: bigint;
  realSolRaised: bigint;
  virtualSolReserve: bigint;
  virtualTokenReserve: bigint;
  publicTradingOpen: boolean;
  graduated: boolean;
};

export function initialFairLaunchState(config: FairLaunchConfig = DEFAULT_FAIR_LAUNCH): FairLaunchState {
  return { developerBuyLamports: 0n, realSolRaised: 0n, virtualSolReserve: config.virtualSolReserve, virtualTokenReserve: config.virtualTokenReserve, publicTradingOpen: false, graduated: false };
}

export function applyBuy(state: FairLaunchState, grossSolIn: bigint, config: FairLaunchConfig = DEFAULT_FAIR_LAUNCH) {
  if (grossSolIn <= 0n) throw new Error("Buy amount must be positive");
  if (state.graduated) throw new Error("Launch has already graduated");
  const fee = applyTradeFee(grossSolIn, config.tradeFeeBps);
  const net = grossSolIn - fee;
  const tokensOut = quoteBuy(net, state.virtualSolReserve, state.virtualTokenReserve);
  const next: FairLaunchState = {
    ...state,
    developerBuyLamports: state.developerBuyLamports + (state.publicTradingOpen ? 0n : grossSolIn),
    realSolRaised: state.realSolRaised + net,
    virtualSolReserve: state.virtualSolReserve + net,
    virtualTokenReserve: state.virtualTokenReserve - tokensOut,
  };
  next.publicTradingOpen = canOpenPublicTrading(next.developerBuyLamports, config);
  next.graduated = hasGraduated(next.realSolRaised, config);
  return { next, fee, tokensOut };
}

export function applySell(state: FairLaunchState, tokenIn: bigint, config: FairLaunchConfig = DEFAULT_FAIR_LAUNCH) {
  if (!state.publicTradingOpen) throw new Error("Public trading is not open");
  if (state.graduated) throw new Error("Graduated launches use the liquidity pool");
  const grossSolOut = quoteSell(tokenIn, state.virtualSolReserve, state.virtualTokenReserve);
  const fee = applyTradeFee(grossSolOut, config.tradeFeeBps);
  const netSolOut = grossSolOut - fee;
  return {
    next: { ...state, realSolRaised: state.realSolRaised - grossSolOut, virtualSolReserve: state.virtualSolReserve - grossSolOut, virtualTokenReserve: state.virtualTokenReserve + tokenIn },
    fee,
    grossSolOut,
    netSolOut,
  };
}

export function graduationSnapshot(state: FairLaunchState, config: FairLaunchConfig = DEFAULT_FAIR_LAUNCH) {
  if (!state.graduated) throw new Error("Graduation target has not been reached");
  return { solForPool: state.realSolRaised, tokenReserveForPool: state.virtualTokenReserve, targetSol: config.graduationSol };
}
