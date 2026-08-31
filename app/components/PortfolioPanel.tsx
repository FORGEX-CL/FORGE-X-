"use client";

import { useState } from "react";

export function PortfolioPanel() {
  const [connected, setConnected] = useState(false);
  return <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
    <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[.22em] text-[#f5c542]">Portfolio</p><h2 className="mt-2 text-3xl font-black">Your on-chain cockpit</h2><p className="mt-3 text-white/45">Connect a wallet to load balances, positions and activity.</p></div>
    <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/[.025] p-6"><div className="text-xs text-white/35">Total value</div><div className="mt-3 text-3xl font-black">{connected ? "$0.00" : "—"}</div></div><div className="rounded-2xl border border-white/10 bg-white/[.025] p-6"><div className="text-xs text-white/35">Positions</div><div className="mt-3 text-3xl font-black">{connected ? "0" : "—"}</div></div><div className="rounded-2xl border border-white/10 bg-white/[.025] p-6"><div className="text-xs text-white/35">Network</div><div className="mt-3 text-xl font-black">Solana Devnet</div></div></div>
    <div className="mt-6 rounded-3xl border border-dashed border-white/10 p-10 text-center"><p className="text-white/45">{connected ? "Wallet connected. Portfolio indexing will appear here." : "No wallet connected."}</p><button onClick={()=>setConnected(true)} className="mt-5 rounded-xl bg-[#f5c542] px-5 py-3 text-sm font-bold text-black">Connect for portfolio</button></div>
  </section>;
}
