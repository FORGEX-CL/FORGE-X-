"use client";

import { useEffect, useState } from "react";

export function PortfolioLive({ address }: { address?: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!address) return;
    let active = true;
    fetch(`/api/portfolio?address=${encodeURIComponent(address)}`)
      .then(async r => { const json = await r.json(); if (!r.ok) throw new Error(json.error); return json; })
      .then(json => active && setData(json))
      .catch(e => active && setError(e.message || "Portfolio unavailable"));
    return () => { active = false; };
  }, [address]);

  if (!address) return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6 text-sm text-white/40">Connect a Solana wallet to load your live portfolio.</div>;
  if (error) return <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-300">{error}</div>;
  if (!data) return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6 text-sm text-white/40">Loading live assets…</div>;

  return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6"><div className="flex items-end justify-between"><div><p className="text-xs uppercase tracking-[.2em] text-[#f5c542]">Live portfolio</p><h3 className="mt-2 text-2xl font-black">{data.sol.toFixed(4)} SOL</h3></div><span className="text-xs text-emerald-400">On-chain</span></div><div className="mt-6 divide-y divide-white/10">{data.assets.length === 0 ? <p className="py-4 text-sm text-white/35">No SPL tokens found.</p> : data.assets.map((asset: any) => <div key={`${asset.mint}-${asset.amount}`} className="flex justify-between gap-4 py-4"><div className="min-w-0"><div className="font-medium">{asset.uiAmount ?? asset.amount}</div><div className="truncate text-xs text-white/30">{asset.mint}</div></div><span className="text-xs text-white/30">{asset.decimals} decimals</span></div>)}</div></div>;
}
