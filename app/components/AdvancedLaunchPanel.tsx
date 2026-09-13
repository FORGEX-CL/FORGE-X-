"use client";

import { useMemo, useState } from "react";

const STEPS = ["Token", "Authorities", "Liquidity", "Review"] as const;

export function AdvancedLaunchPanel() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [supply, setSupply] = useState("1000000000");
  const [revokeMint, setRevokeMint] = useState(true);
  const [revokeFreeze, setRevokeFreeze] = useState(true);
  const [immutable, setImmutable] = useState(true);
  const [initialSol, setInitialSol] = useState("1");
  const [initialTokens, setInitialTokens] = useState("100000000");
  const [burnLp, setBurnLp] = useState(false);

  const canContinue = useMemo(() => {
    if (step === 0) return name.trim().length > 0 && /^[A-Za-z0-9]{1,10}$/.test(symbol);
    if (step === 1) return revokeMint && revokeFreeze && immutable;
    if (step === 2) return Number(initialSol) > 0 && Number(initialTokens) > 0;
    return true;
  }, [step, name, symbol, revokeMint, revokeFreeze, immutable, initialSol, initialTokens]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#f5c542]">Advanced Launch</p>
        <h3 className="mt-2 text-xl font-black">Build the launch configuration</h3>
        <p className="mt-2 text-sm leading-6 text-white/45">Advanced Launch separates token configuration, authority safety, initial liquidity and final review so every irreversible choice is visible before a wallet signature.</p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {STEPS.map((label, index) => (
          <button key={label} type="button" onClick={() => index <= step && setStep(index)} className={`rounded-lg border px-2 py-2 text-xs font-bold ${index === step ? "border-[#f5c542]/50 bg-[#f5c542]/10 text-[#f5c542]" : "border-white/10 text-white/40"}`}>
            <span className="mr-1">0{index + 1}</span>{label}
          </button>
        ))}
      </div>

      {step === 0 && <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <input className="forge-input" placeholder="Token name" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} />
        <input className="forge-input" placeholder="SYMBOL" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} maxLength={10} />
        <input className="forge-input sm:col-span-2" placeholder="Total supply" inputMode="numeric" value={supply} onChange={(e) => setSupply(e.target.value.replace(/[^0-9]/g, ""))} />
        <div className="sm:col-span-2 rounded-xl border border-white/10 bg-black/10 p-4 text-xs leading-5 text-white/45">Decimals are fixed at 9 for the current Solana token implementation. Supply is expressed in whole tokens and is converted to base units only when the transaction is prepared.</div>
      </div>}

      {step === 1 && <div className="mt-5 space-y-3">
        {[['Revoke mint authority', revokeMint, setRevokeMint], ['Revoke freeze authority', revokeFreeze, setRevokeFreeze], ['Make metadata immutable', immutable, setImmutable]].map(([label, checked, setChecked]) => (
          <label key={label as string} className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-black/10 p-4">
            <span><span className="block text-sm font-bold">{label as string}</span><span className="mt-1 block text-xs text-white/40">This becomes an irreversible on-chain state after signing.</span></span>
            <input type="checkbox" checked={checked as boolean} onChange={(e) => (setChecked as (value: boolean) => void)(e.target.checked)} className="h-5 w-5 accent-[#f5c542]" />
          </label>
        ))}
        <div className="rounded-xl border border-[#f5c542]/15 bg-[#f5c542]/5 p-4 text-xs leading-5 text-white/55">FORGE X currently requires all three protections for the advanced flow. They cannot be disabled at review time.</div>
      </div>}

      {step === 2 && <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-white/45">Initial SOL liquidity<input className="forge-input mt-2" inputMode="decimal" value={initialSol} onChange={(e) => setInitialSol(e.target.value)} /></label>
        <label className="text-xs text-white/45">Initial token liquidity<input className="forge-input mt-2" inputMode="numeric" value={initialTokens} onChange={(e) => setInitialTokens(e.target.value.replace(/[^0-9]/g, ""))} /></label>
        <label className="sm:col-span-2 flex items-center justify-between rounded-xl border border-white/10 p-4"><span><span className="block text-sm font-bold">Burn LP position</span><span className="mt-1 block text-xs text-white/40">Optional permanent LP burn through the configured burn flow.</span></span><input type="checkbox" checked={burnLp} onChange={(e) => setBurnLp(e.target.checked)} className="h-5 w-5 accent-[#f5c542]" /></label>
        <div className="sm:col-span-2 rounded-xl border border-white/10 p-4 text-xs leading-5 text-white/45">Liquidity is displayed here before execution. The wallet must explicitly sign the pool-creation transaction; FORGE X never treats a configuration as a created pool.</div>
      </div>}

      {step === 3 && <div className="mt-5 space-y-3">
        <div className="rounded-xl border border-white/10 p-4"><p className="text-xs uppercase tracking-[.18em] text-white/35">Token</p><p className="mt-2 font-bold">{name || "Unnamed token"} · {symbol || "—"}</p><p className="mt-1 text-sm text-white/45">{supply || "0"} tokens · 9 decimals</p></div>
        <div className="rounded-xl border border-white/10 p-4"><p className="text-xs uppercase tracking-[.18em] text-white/35">Safety</p><p className="mt-2 text-sm text-white/65">Mint revoked · Freeze revoked · Metadata immutable</p></div>
        <div className="rounded-xl border border-white/10 p-4"><p className="text-xs uppercase tracking-[.18em] text-white/35">Liquidity</p><p className="mt-2 text-sm text-white/65">{initialSol} SOL + {initialTokens} tokens {burnLp ? "· LP burn requested" : "· LP remains active"}</p></div>
        <div className="rounded-xl border border-[#f5c542]/15 bg-[#f5c542]/5 p-4 text-xs leading-5 text-white/55">Review is intentionally separate from signing. The next implementation slice will connect this reviewed configuration to serialized token and pool transactions.</div>
      </div>}

      <div className="mt-5 flex gap-3">
        <button type="button" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold disabled:opacity-30">Back</button>
        <button type="button" onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))} disabled={!canContinue || step === STEPS.length - 1} className="flex-1 rounded-xl bg-[#f5c542] px-5 py-3 text-sm font-bold text-black disabled:opacity-30">{step === STEPS.length - 1 ? "Reviewed" : "Continue"}</button>
      </div>
    </div>
  );
}
