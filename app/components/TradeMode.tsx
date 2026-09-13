"use client";

import { useSyncExternalStore } from "react";
import { FairLaunchTrader } from "./FairLaunchTrader";
import { RaydiumCpmmTrader } from "./RaydiumCpmmTrader";

function subscribeToLocation() {
  return () => {};
}

function getPoolFromLocation() {
  return new URLSearchParams(window.location.search).get("pool") || "";
}

function getServerPool() {
  return "";
}

export function TradeMode() {
  const pool = useSyncExternalStore(subscribeToLocation, getPoolFromLocation, getServerPool);
  return pool ? <RaydiumCpmmTrader /> : <FairLaunchTrader />;
}
