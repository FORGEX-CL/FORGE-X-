"use client";

import { useSearchParams } from "next/navigation";
import { FairLaunchTrader } from "./FairLaunchTrader";
import { RaydiumCpmmTrader } from "./RaydiumCpmmTrader";

export function TradeMode() {
  const params = useSearchParams();
  const pool = params.get("pool");
  return pool ? <RaydiumCpmmTrader /> : <FairLaunchTrader />;
}
