"use client";

import { FormEvent, useState } from "react";
import { Shell, SectionTitle, Card } from "../components/Shell";

type Risk = {
  level?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  score?: number;
  hold?: boolean;
  impersonation?: boolean;
};

type Pair = {
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { symbol?: string };
  priceUsd?: string;
  priceChange?: { h24?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  dexId?: string;
  forgeRisk?: Risk;
  forgeStatus?: "WAITING_FOR_DEV_BUY" | "LIVE" | "GRADUATED" | "MIGRATED" | null;
};

const money = (value?: number) => value == null ? "—" : value >= 1_000_000 ? `$${(value / 1_000_000).toFixed(1)}M` : value >= 1_000 ? `$${(value / 1_000).toFixed(1)}K` : `$${value.toFixed(0)}`;

function riskLabel(risk?: Risk) {
  if (!risk) return "Unscreened";
  if (risk.hold || risk.level === "CRITICAL") return "Hold";
  if (risk.impersonation) return "Impersonation risk";
  return `${risk.level ?? "UNKNOWN"} risk`;
}

export default function Market() {
  const [query, setQuery] = useState("SOL");
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search(event?: FormEvent) {
    event?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/market/search?q=${encodeURIComponent(query.trim())}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed");
      setPairs(data.pairs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setPairs([]);
    } finally {
      setLoading(false);
    }
  }

  return <Shell>
    <main className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
      <SectionTitle eyebrow="Market" title="Discover Solana markets." text="Search live market pairs and inspect price, 24h movement, volume and liquidity before you trade." />
      <form onSubmit={search} className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search token or pair" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none placeholder:text-white/30 focus:border-[#f5c542]/50" />
        <button disabled={loading} className="rounded-xl bg-[#f5c542] px-6 py-3 text-sm font-bold text-black disabled:opacity-50">{loading ? "Searching…" : "Search"}</button>
      </form>

      {error && <Card className="mb-6 border-red-400/20"><p className="text-sm text-red-300">{error}</p></Card>}

      <Card>
        <div className="hidden grid-cols-7 gap-4 border-b border-white/10 px-2 pb-4 text-xs uppercase tracking-wider text-white/35 md:grid"><span>Pair</span><span>Price</span><span>24h</span><span>Volume</span><span>Liquidity</span><span>DEX</span><span>Action</span></div>
        {pairs.length === 0 && !loading ? <div className="py-16 text-center text-sm text-white/40">Search for a token to load live Solana markets.</div> : pairs.map((pair) => {
          const change = pair.priceChange?.h24 ?? 0;
          const risk = pair.forgeRisk;
          const mint = pair.baseToken?.address;
          const blocked = risk?.hold || risk?.level === "CRITICAL";
          const canTrade = !blocked && pair.forgeStatus === "LIVE" && Boolean(mint);
          return <div key={`${pair.pairAddress}-${pair.dexId}`} className="grid gap-3 border-b border-white/5 px-2 py-5 text-sm last:border-0 md:grid-cols-7 md:gap-4 md:items-center">
            <div>
              <div className="font-semibold">{pair.baseToken?.symbol ?? "Unknown"}/{pair.quoteToken?.symbol ?? "—"}</div>
              <div className="text-xs text-white/35">{pair.baseToken?.name ?? ""}</div>
              <div className={`mt-1 text-[10px] font-bold uppercase tracking-wider ${blocked ? "text-red-300" : risk?.impersonation || risk?.level === "HIGH" ? "text-amber-300" : "text-emerald-300"}`}>{riskLabel(risk)}{risk?.score != null ? ` · ${risk.score}/100` : ""}</div>
              {pair.forgeStatus && <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#f5c542]">FORGE {pair.forgeStatus.replaceAll("_", " ")}</div>}
            </div>
            <span>{pair.priceUsd ? `$${Number(pair.priceUsd).toPrecision(6)}` : "—"}</span>
            <span className={change >= 0 ? "text-emerald-400" : "text-red-400"}>{change >= 0 ? "+" : ""}{change.toFixed(2)}%</span>
            <span className="text-white/50">{money(pair.volume?.h24)}</span>
            <span className="text-white/50">{money(pair.liquidity?.usd)}</span>
            <span className="text-white/50">{pair.dexId ?? "—"}</span>
            {canTrade ? <a href={`/trade?mint=${encodeURIComponent(mint!)}`} className="inline-flex w-fit rounded-lg border border-[#f5c542]/30 px-3 py-2 text-xs font-bold text-[#f5c542] hover:bg-[#f5c542]/10">Trade on FORGE</a> : <span className="text-xs text-white/25">{blocked ? "Trading blocked" : pair.forgeStatus === "WAITING_FOR_DEV_BUY" ? "Awaiting launch" : "External / unavailable"}</span>}
          </div>;
        })}
      </Card>
    </main>
  </Shell>;
}
