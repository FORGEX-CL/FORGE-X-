import { DEFAULT_FAIR_LAUNCH, FairLaunchConfig, hasGraduated } from "./fair-launch";

export type GraduationSnapshot = Readonly<{
  realSolRaised: bigint;
  curveTokenReserve: bigint;
  targetSol: bigint;
}>;

/**
 * Creates the immutable values the liquidity-migration layer should consume.
 * This does not move funds. Asset movement must happen in the on-chain program
 * and be confirmed before the UI marks graduation as complete.
 */
export function createGraduationSnapshot(
  realSolRaised: bigint,
  curveTokenReserve: bigint,
  config: FairLaunchConfig = DEFAULT_FAIR_LAUNCH,
): GraduationSnapshot {
  if (realSolRaised < 0n || curveTokenReserve < 0n) {
    throw new Error("Graduation reserves cannot be negative");
  }
  if (!hasGraduated(realSolRaised, config)) {
    throw new Error("Launch has not reached the graduation target");
  }
  return Object.freeze({
    realSolRaised,
    curveTokenReserve,
    targetSol: config.graduationSol,
  });
}

export function assertGraduationMigrationReady(snapshot: GraduationSnapshot) {
  if (snapshot.realSolRaised < snapshot.targetSol) {
    throw new Error("Graduation migration is not ready");
  }
  if (snapshot.curveTokenReserve <= 0n) {
    throw new Error("Graduation migration requires a positive token reserve");
  }
}
