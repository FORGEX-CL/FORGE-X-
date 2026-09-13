"use client";

import { useSearchParams } from "next/navigation";
import { FairLaunchTrader } from "./FairLaunchTrader";
import { RaydiumCpmmTrader } from "./RaydiumCpmmTrader";

export function TradeMode() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "fair";
  const pool = searchParams.get("pool") || "";
  const inputMint = searchParams.get("inputMint") || "";

  // Never infer the execution model from the mere presence of a pool address.
  // Market supplies mode=raydium only for migrated/graduated routes. The
  // Raydium trader independently verifies the supplied pool on-chain.
  if (mode === "raydium" && pool) {
    return <RaydiumCpmmTrader key={`${pool}:${inputMint}`} />;
  }

  return <FairLaunchTrader />;
}
