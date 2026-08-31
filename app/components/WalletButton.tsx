"use client";

import { useState } from "react";

export function WalletButton() {
  const [status, setStatus] = useState<"idle" | "connecting" | "connected">("idle");

  async function connect() {
    const provider = (window as any).solana;
    if (!provider?.connect) {
      setStatus("idle");
      window.alert("Install a Solana wallet such as Phantom to connect.");
      return;
    }
    try {
      setStatus("connecting");
      await provider.connect();
      setStatus("connected");
    } catch {
      setStatus("idle");
    }
  }

  return (
    <button onClick={connect} disabled={status === "connecting"} className="rounded-full bg-[#f5c542] px-4 py-2 text-sm font-bold text-black transition hover:bg-[#ffd75e] disabled:opacity-60">
      {status === "connected" ? "Wallet Connected ✓" : status === "connecting" ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}
