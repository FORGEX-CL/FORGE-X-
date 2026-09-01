export type GraduationReserve = {
  solLamports: bigint;
  tokenBaseUnits: bigint;
};

export type PoolMigrationPlan = {
  solLamports: bigint;
  tokenBaseUnits: bigint;
  requiresWalletSignature: true;
  confirmedOnChain: false;
};

export function preparePoolMigration(reserve: GraduationReserve): PoolMigrationPlan {
  if (reserve.solLamports <= 0n) throw new Error("Graduation must contain SOL reserves");
  if (reserve.tokenBaseUnits <= 0n) throw new Error("Graduation must contain token reserves");

  return {
    solLamports: reserve.solLamports,
    tokenBaseUnits: reserve.tokenBaseUnits,
    requiresWalletSignature: true,
    confirmedOnChain: false,
  };
}

export function markPoolConfirmed(plan: PoolMigrationPlan): PoolMigrationPlan {
  return { ...plan, confirmedOnChain: true };
}
