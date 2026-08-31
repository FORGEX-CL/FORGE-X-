"use client";

import { useState } from "react";

export function SwapQuote() {
  const [inputMint, setInputMint] = useState("So11111111111111111111111111111111111111112");
  const [outputMint, setOutputMint] = useState("");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchQuote() {
    setLoading(true); setError(""); setQuote(null);
    try {
      const res = await fetch(`/api/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Quote unavailable");
      setQuote(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Quote unavailable"); }
    finally { setLoading(false); }
  }

  return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
    <div className="mb-5"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#f5c542]">Route engine</p><h3 className="mt-2 text-xl font-black">Get a swap quote</h3></div>
    <div className="space-y-3"><input value={inputMint} onChange={e=>setInputMint(e.target.value)} placeholder="Input token mint" className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none" /><input value={outputMint} onChange={e=>setOutputMint(e.target.value)} placeholder="Output token mint" className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none" /><input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Amount in base units" inputMode="numeric" className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none" /><button disabled={!outputMint || !amount || loading} onClick={fetchQuote} className="w-full rounded-xl bg-[#f5c542] px-5 py-3 font-bold text-black disabled:opacity-30">{loading ? "Finding route…" : "Get quote"}</button></div>
    {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
    {quote && <div className="mt-5 rounded-xl border border-white/10 p-4 text-sm"><div className="flex justify-between"><span className="text-white/40">Expected output</span><b>{quote.outAmount}</b></div><div className="mt-2 flex justify-between"><span className="text-white/40">Price impact</span><b>{quote.priceImpactPct ?? "—"}%</b></div><p className="mt-4 text-xs text-white/30">Quote only. No transaction has been signed or submitted.</p></div>}
  </div>;
}
