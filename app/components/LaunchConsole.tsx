"use client";

import { useState } from "react";

export function LaunchConsole() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  return <section className="mx-auto max-w-4xl px-5 py-16 lg:px-8">
    <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[.22em] text-[#f5c542]">Token studio</p><h2 className="mt-2 text-3xl font-black">Launch on Solana</h2><p className="mt-3 text-white/45">A simple launch flow. Review everything before signing a transaction.</p></div>
    <div className="rounded-3xl border border-white/10 bg-white/[.025] p-6 sm:p-8">
      <div className="mb-8 flex gap-2">{[1,2,3].map(n => <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-[#f5c542]" : "bg-white/10"}`} />)}</div>
      {step === 1 && <div className="space-y-5"><h3 className="text-xl font-bold">Token details</h3><input value={name} onChange={e=>setName(e.target.value)} placeholder="Token name" className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-4 outline-none focus:border-[#f5c542]/60" /><input value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase())} placeholder="Symbol" className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-4 outline-none focus:border-[#f5c542]/60" /><button onClick={()=>setStep(2)} disabled={!name || !symbol} className="rounded-xl bg-[#f5c542] px-6 py-3 font-bold text-black disabled:opacity-30">Continue</button></div>}
      {step === 2 && <div className="space-y-5"><h3 className="text-xl font-bold">Security settings</h3><div className="grid gap-3 sm:grid-cols-2">{["Revoke mint authority", "Revoke freeze authority", "Immutable metadata", "Anti-impersonation check"].map(x=><div key={x} className="rounded-xl border border-white/10 p-4"><div className="font-medium">{x}</div><div className="mt-1 text-xs text-white/35">Recommended for safer launches</div></div>)}</div><button onClick={()=>setStep(3)} className="rounded-xl bg-[#f5c542] px-6 py-3 font-bold text-black">Review launch</button></div>}
      {step === 3 && <div className="space-y-5"><h3 className="text-xl font-bold">Review</h3><div className="rounded-2xl bg-black/30 p-5"><div className="text-sm text-white/40">Token</div><div className="mt-1 text-2xl font-black">{name} <span className="text-[#f5c542]">${symbol}</span></div><p className="mt-4 text-sm text-white/45">No blockchain transaction has been submitted. Connect a wallet and confirm the final transaction when this launch flow is fully integrated.</p></div><button onClick={()=>setStep(1)} className="rounded-xl border border-white/10 px-6 py-3 font-bold">Edit</button></div>}
    </div>
  </section>;
}
