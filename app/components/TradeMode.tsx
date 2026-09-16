"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FairLaunchTrader } from "./FairLaunchTrader";
import { RaydiumCpmmTrader } from "./RaydiumCpmmTrader";

function TradeModeContent() {
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

export function TradeMode() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6 text-sm text-white/40">
          Loading trade route…
        </div>
      }
    >
      <TradeModeContent />
    </Suspense>
  );
}
