"use client";

import { useMemo, useState } from "react";

const checks = [
  ["Mint authority", "Review before trading"],
  ["Freeze authority", "Review before trading"],
  ["Liquidity", "Check depth and lock status"],
  ["Holder concentration", "Watch top-wallet exposure"],
  ["Metadata", "Verify project identity"],
];

export function ForgeRiskPanel() {
  const [address, setAddress] = useState("");
  const score = useMemo(() => {
    if (!address) return null;
    if (address.length < 20) return "Incomplete";
    return "Review required";
  }, [address]);

  return <section className="mx-auto max-w-5xl px-5 py-16 lg:px-8">
    <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[.22em] text-[#f5c542]">FORGE Guard</p><h2 className="mt-2 text-3xl font-black">Token risk check</h2><p className="mt-3 text-white/45">Paste a token address to prepare a safety review. This tool never guarantees a token is safe.</p></div>
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="rounded-3xl border border-white/10 bg-white/[.025] p-6"><label className="text-sm text-white/50">Solana token address</label><textarea value={address} onChange={e=>setAddress(e.target.value.trim())} placeholder="Paste mint address" rows={4} className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-4 text-sm outline-none focus:border-[#f5c542]/60" /><div className="mt-4 flex items-center justify-between"><span className="text-xs text-white/30">Status</span><span className="text-sm font-bold text-[#f5c542]">{score ?? "Waiting"}</span></div></div>
      <div className="rounded-3xl border border-white/10 bg-white/[.025] p-6"><h3 className="font-bold">Review checklist</h3><div className="mt-4 space-y-2">{checks.map(([a,b])=><div key={a} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-4 py-3"><span className="text-sm">{a}</span><span className="text-xs text-white/35">{b}</span></div>)}</div></div>
    </div>
  </section>;
}
