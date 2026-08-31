"use client";

import { useState } from "react";

const tokens = [
  { symbol: "FORGE", name: "Forge X", price: "$0.0842", change: "+12.8%", volume: "$2.4M" },
  { symbol: "NOVA", name: "Nova", price: "$0.0138", change: "+8.4%", volume: "$918K" },
  { symbol: "FLUX", name: "Flux", price: "$0.0061", change: "-3.2%", volume: "$604K" },
];

export function ForgeDashboard() {
  const [tab, setTab] = useState("Trending");
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[.22em] text-[#f5c542]">Live terminal</p><h2 className="mt-2 text-3xl font-black">The Forge</h2></div>
        <div className="flex rounded-full border border-white/10 bg-white/[.03] p-1 text-sm">
          {["Trending", "New", "Top Volume"].map((x) => <button key={x} onClick={() => setTab(x)} className={`rounded-full px-4 py-2 ${tab === x ? "bg-[#f5c542] text-black" : "text-white/50"}`}>{x}</button>)}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {tokens.map((t, i) => <div key={t.symbol} className="rounded-2xl border border-white/10 bg-white/[.025] p-5 transition hover:-translate-y-1 hover:border-[#f5c542]/40">
          <div className="flex items-center justify-between"><div><div className="font-bold">{t.symbol}</div><div className="text-xs text-white/35">{t.name}</div></div><span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-white/40">{i === 0 ? "HOT" : "SOL"}</span></div>
          <div className="mt-8 flex items-end justify-between"><div className="text-2xl font-black">{t.price}</div><div className={t.change.startsWith("+") ? "text-sm text-emerald-400" : "text-sm text-red-400"}>{t.change}</div></div>
          <div className="mt-3 flex justify-between text-xs text-white/35"><span>24h volume</span><span>{t.volume}</span></div>
          <div className="mt-5 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full w-3/4 rounded-full bg-[#f5c542]" /></div>
        </div>)}
      </div>
    </section>
  );
}
