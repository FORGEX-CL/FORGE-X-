import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { DEFAULT_FAIR_LAUNCH, FairLaunchConfig } from "./fair-launch";

export type GraduationPlan = {
  sourceState: "GRADUATED";
  solLamports: bigint;
  tokenBaseUnits: bigint;
  destinationPool: PublicKey;
};

export function createGraduationPlan(params: {
  solLamports: bigint;
  tokenBaseUnits: bigint;
  destinationPool: PublicKey;
  config?: FairLaunchConfig;
}): GraduationPlan {
  const config = params.config ?? DEFAULT_FAIR_LAUNCH;
  if (params.solLamports < config.graduationSol) {
    throw new Error("Graduation target has not been reached");
  }
  if (params.tokenBaseUnits <= 0n) {
    throw new Error("No token reserve is available for liquidity migration");
  }
  return {
    sourceState: "GRADUATED",
    solLamports: params.solLamports,
    tokenBaseUnits: params.tokenBaseUnits,
    destinationPool: params.destinationPool,
  };
}

const POLL_MS = 500;
const TIMEOUT_MS = 90_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForGraduationConfirmation(
  connection: Connection,
  signature: string,
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < TIMEOUT_MS) {
    const status = (await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    })).value[0];

    if (status?.err) throw new Error("Graduation transaction failed on-chain");
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    await sleep(POLL_MS);
  }
  throw new Error("Timed out waiting for graduation transaction confirmation");
}

export function assertPoolDestination(address: string): PublicKey {
  try {
    return new PublicKey(address);
  } catch {
    throw new Error("Invalid liquidity-pool destination address");
  }
}

/**
 * Pool creation must be performed by the selected AMM SDK/program.
 * This function intentionally returns an empty Transaction rather than
 * pretending that a pool has been created. The caller must append the
 * official AMM instructions and have the connected wallet sign them.
 */
export function createUnsignedPoolTransaction(): Transaction {
  return new Transaction();
}
