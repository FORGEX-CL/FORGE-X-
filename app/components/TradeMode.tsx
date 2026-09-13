"use client";

import { useSearchParams } from "next/navigation";
import { FairLaunchTrader } from "./FairLaunchTrader";
import { RaydiumCpmmTrader } from "./RaydiumCpmmTrader";

export function TradeMode() {
  const searchParams = useSearchParams();
  const pool = searchParams.get("pool") || "";

  return pool ? <RaydiumCpmmTrader /> : <FairLaunchTrader />;
}
