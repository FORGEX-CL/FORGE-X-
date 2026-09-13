"use client";

import { useEffect, useState } from "react";
import { FairLaunchTrader } from "./FairLaunchTrader";
import { RaydiumCpmmTrader } from "./RaydiumCpmmTrader";

export function TradeMode() {
  const [pool, setPool] = useState("");
  useEffect(() => { setPool(new URLSearchParams(window.location.search).get("pool") || ""); }, []);
  return pool ? <RaydiumCpmmTrader /> : <FairLaunchTrader />;
}
