"use client";

import { useEffect, useState } from "react";
import { getSolBalance } from "../../lib/solana";

export function WalletBalance({ address }: { address?: string }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!address) return;
    getSolBalance(address).then(setBalance).catch(() => setError(true));
  }, [address]);

  if (!address) return <span className="text-white/35">Connect wallet to view balance</span>;
  if (error) return <span className="text-red-400">Balance unavailable</span>;
  if (balance === null) return <span className="text-white/35">Loading SOL…</span>;
  return <span className="font-bold">{balance.toFixed(4)} SOL</span>;
}
