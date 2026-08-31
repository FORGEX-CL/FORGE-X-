"use client";

import { FormEvent, useState } from "react";
import { Shell, SectionTitle, Card } from "../components/Shell";

type Pair = {
  pairAddress?: string;
  baseToken?: { name?: string; symbol?: string };
  quoteToken?: { symbol?: string };
  priceUsd?: string;
  priceChange?: { h24?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  dexId?: string;
};

const money = (value?: number) => value == null ? "—" : value >= 1_000_000 ? `$${(value / 1_000_000).toFixed(1)}M` : value >= 1_000 ? `$${(value / 1_000).toFixed(1)}K` : `$${value.toFixed(0)}`;

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
        <div className="hidden grid-cols-6 gap-4 border-b border-white/10 px-2 pb-4 text-xs uppercase tracking-wider text-white/35 md:grid"><span>Pair</span><span>Price</span><span>24h</span><span>Volume</span><span>Liquidity</span><span>DEX</span></div>
        {pairs.length === 0 && !loading ? <div className="py-16 text-center text-sm text-white/40">Search for a token to load live Solana markets.</div> : pairs.map((pair) => {
          const change = pair.priceChange?.h24 ?? 0;
          return <div key={`${pair.pairAddress}-${pair.dexId}`} className="grid gap-2 border-b border-white/5 px-2 py-5 text-sm last:border-0 md:grid-cols-6 md:gap-4 md:items-center">
            <div><div className="font-semibold">{pair.baseToken?.symbol ?? "Unknown"}/{pair.quoteToken?.symbol ?? "—"}</div><div className="text-xs text-white/35">{pair.baseToken?.name ?? ""}</div></div>
            <span>{pair.priceUsd ? `$${Number(pair.priceUsd).toPrecision(6)}` : "—"}</span>
            <span className={change >= 0 ? "text-emerald-400" : "text-red-400"}>{change >= 0 ? "+" : ""}{change.toFixed(2)}%</span>
            <span className="text-white/50">{money(pair.volume?.h24)}</span>
            <span className="text-white/50">{money(pair.liquidity?.usd)}</span>
            <span className="text-white/50">{pair.dexId ?? "—"}</span>
          </div>;
        })}
      </Card>
    </main>
  </Shell>;
}
