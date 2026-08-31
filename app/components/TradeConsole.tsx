"use client";

import { useState } from "react";

export function TradeConsole() {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  return <section className="mx-auto max-w-5xl px-5 py-16 lg:px-8">
    <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[.22em] text-[#f5c542]">Execution</p><h2 className="mt-2 text-3xl font-black">Trade</h2><p className="mt-3 text-white/45">Prepare a swap, review the route and approve it with your wallet.</p></div>
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <div className="rounded-3xl border border-white/10 bg-white/[.025] p-6">
        <div className="mb-6 flex rounded-xl border border-white/10 p-1"><button onClick={()=>setSide("buy")} className={`flex-1 rounded-lg py-3 text-sm font-bold ${side === "buy" ? "bg-[#f5c542] text-black" : "text-white/45"}`}>Buy</button><button onClick={()=>setSide("sell")} className={`flex-1 rounded-lg py-3 text-sm font-bold ${side === "sell" ? "bg-[#f5c542] text-black" : "text-white/45"}`}>Sell</button></div>
        <label className="text-xs text-white/40">You pay</label><div className="mt-2 flex rounded-xl border border-white/10 bg-black/30 p-4"><input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="min-w-0 flex-1 bg-transparent text-2xl font-bold outline-none" /><span className="font-bold">SOL</span></div>
        <div className="my-4 text-center text-white/25">↓</div>
        <label className="text-xs text-white/40">You receive</label><div className="mt-2 flex rounded-xl border border-white/10 bg-black/30 p-4"><span className="flex-1 text-2xl font-bold text-white/30">0.00</span><span className="font-bold">TOKEN</span></div>
        <button className="mt-6 w-full rounded-xl bg-[#f5c542] py-4 font-black text-black">Connect wallet to {side}</button>
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/[.025] p-6"><h3 className="font-bold">Trade details</h3><div className="mt-6 space-y-4 text-sm"><div className="flex justify-between"><span className="text-white/40">Network</span><span>Solana</span></div><div className="flex justify-between"><span className="text-white/40">Route</span><span>Auto</span></div><div className="flex justify-between"><span className="text-white/40">Slippage</span><span>0.5%</span></div><div className="flex justify-between"><span className="text-white/40">Price impact</span><span className="text-white/35">—</span></div></div><div className="mt-8 rounded-xl border border-[#f5c542]/20 bg-[#f5c542]/5 p-4 text-xs leading-5 text-white/45">A real swap must be quoted and simulated before signing. FORGE X will never ask you to approve an unknown transaction.</div></div>
    </div>
  </section>;
}
