"use client";

import { useState } from "react";
import { Card } from "./Shell";

type Pool = {
  id: string; programId: string; verifiedProgram: boolean; mintA: string | null; mintB: string | null;
  symbolA: string | null; symbolB: string | null; decimalsA: number | null; decimalsB: number | null;
  price: number | null; tvl: number | null; feeRate: number | null; volume24h: number | null; apr24h: number | null; openTime: number | null;
};
type LookupResult = { network: string; verified: boolean; source: string; pools: Pool[] };

export function PoolDiscovery() {
  const [mint, setMint] = useState(""); const [poolId, setPoolId] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function lookup() {
    setLoading(true); setError(""); setResult(null);
    try { const params = new URLSearchParams(); if (mint.trim()) params.set("mint", mint.trim()); if (poolId.trim()) params.set("poolId", poolId.trim());
      const response = await fetch(`/api/pools/lookup?${params.toString()}`); const data = await response.json() as LookupResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "Pool lookup failed"); setResult(data);
    } catch (err) { setError(err instanceof Error ? err.message : "Pool lookup failed"); } finally { setLoading(false); }
  }
  return <Card>
    <p className="text-xs font-bold uppercase tracking-[.2em] text-[#f5c542]">Verified pool discovery</p><h2 className="mt-2 text-xl font-black">Find real Raydium CPMM liquidity</h2>
    <p className="mt-2 text-sm leading-6 text-white/45">FORGE X only displays a pool after its account is checked against the expected Raydium CPMM program for the active network.</p>
    <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
      <input value={mint} onChange={(event) => setMint(event.target.value)} placeholder="Token mint address" className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-[#f5c542]/60" />
      <input value={poolId} onChange={(event) => setPoolId(event.target.value)} placeholder="Pool ID (required on Devnet)" className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-[#f5c542]/60" />
      <button type="button" onClick={lookup} disabled={loading || (!mint.trim() && !poolId.trim())} className="rounded-xl bg-[#f5c542] px-5 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-40">{loading ? "Checking…" : "Find pool"}</button>
    </div>
    {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
    {result && <div className="mt-5 space-y-3">{result.verified && result.pools.length > 0 && <div className="flex items-center justify-between rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3"><span className="text-sm text-white/60">Verification</span><span className="text-sm font-black text-emerald-300">✓ CPMM PROGRAM VERIFIED</span></div>}{result.pools.length === 0 ? <p className="text-sm text-white/45">No verified Raydium CPMM pool was found.</p> : result.pools.map((pool) => <PoolCard key={pool.id} pool={pool} network={result.network} />)}</div>}
  </Card>;
}
function PoolCard({ pool, network }: { pool: Pool; network: string }) { return <div className="rounded-xl border border-white/10 bg-white/[.02] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold">{pool.symbolA || "Token"} / {pool.symbolB || "SOL"}</p><p className="mt-1 break-all text-xs text-white/35">{pool.id}</p></div><a href={`https://solscan.io/account/${pool.id}${network === "devnet" ? "?cluster=devnet" : ""}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#f5c542]">View on Solscan ↗</a></div><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4"><Metric label="TVL" value={formatNumber(pool.tvl)} /><Metric label="24h volume" value={formatNumber(pool.volume24h)} /><Metric label="24h APR" value={formatPercent(pool.apr24h)} /><Metric label="Fee" value={formatPercent(pool.feeRate)} /></div></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-black/20 p-3"><p className="text-[10px] uppercase tracking-widest text-white/35">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>; }
function formatNumber(value: number | null) { return typeof value === "number" && Number.isFinite(value) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value) : "—"; }
function formatPercent(value: number | null) { return typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "—"; }
