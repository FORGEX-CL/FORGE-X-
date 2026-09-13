"use client";

import { useEffect, useState } from "react";
import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const WSOL = "So11111111111111111111111111111111111111112";
const POLL_MS = 500;
const TIMEOUT_MS = 90_000;

type MintInfo = { address: string; symbol: string | null; decimals: number | null };
type PoolResponse = { pools?: Array<{ id: string; mintA: string | null; mintB: string | null; symbolA: string | null; symbolB: string | null; decimalsA: number | null; decimalsB: number | null; price: number | null }>; error?: string };
type Wallet = { publicKey?: { toString(): string } | null; signTransaction?: (tx: VersionedTransaction) => Promise<VersionedTransaction> };

function wallet(): Wallet { return (window as Window & { solana?: Wallet }).solana || {}; }
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function parseUnits(value: string, decimals: number): bigint {
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error("Enter a valid amount");
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) throw new Error(`Maximum ${decimals} decimal places allowed`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
}
function formatUnits(raw: string, decimals: number): string {
  const value = BigInt(raw); const unit = 10n ** BigInt(decimals); const whole = value / unit;
  const fraction = (value % unit).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
async function waitFor(connection: Connection, signature: string, lastValidBlockHeight: number) {
  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    const status = (await connection.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
    if (status?.err) throw new Error(`Swap failed: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    if (await connection.getBlockHeight("confirmed") > lastValidBlockHeight) throw new Error("Swap transaction expired before confirmation");
    await sleep(POLL_MS);
  }
  throw new Error("Timed out waiting for swap confirmation");
}

export function RaydiumCpmmTrader() {
  const [poolId, setPoolId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("pool") || "");
  const [mints, setMints] = useState<MintInfo[]>([]);
  const [inputMint, setInputMint] = useState(() => typeof window === "undefined" ? WSOL : new URLSearchParams(window.location.search).get("inputMint") || WSOL);
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [quote, setQuote] = useState<{ outputAmount: string; minimumOutputAmount: string; tradeFee: string; outputMint: string } | null>(null);
  const [status, setStatus] = useState("idle");
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");
  const [loadingPool, setLoadingPool] = useState(false);

  const input = mints.find((mint) => mint.address === inputMint);
  const output = mints.find((mint) => mint.address !== inputMint);

  useEffect(() => {
    if (!poolId.trim()) return;
    const timer = setTimeout(async () => {
      setLoadingPool(true); setError("");
      try {
        const response = await fetch(`/api/pools/lookup?poolId=${encodeURIComponent(poolId.trim())}`);
        const data = await response.json() as PoolResponse;
        if (!response.ok || !data.pools?.[0]) throw new Error(data.error || "Unable to verify pool");
        const pool = data.pools[0];
        const nextMints: MintInfo[] = [
          { address: pool.mintA || "", symbol: pool.symbolA, decimals: pool.decimalsA },
          { address: pool.mintB || "", symbol: pool.symbolB, decimals: pool.decimalsB },
        ].filter((mint) => mint.address && mint.decimals !== null);
        if (nextMints.length !== 2) throw new Error("Pool mint metadata is incomplete");
        setMints(nextMints);
        setInputMint((current) => nextMints.some((mint) => mint.address === current) ? current : nextMints[0].address);
      } catch (e) { setMints([]); setError(e instanceof Error ? e.message : "Unable to verify pool"); }
      finally { setLoadingPool(false); }
    }, 200);
    return () => clearTimeout(timer);
  }, [poolId]);

  async function swap() {
    const w = wallet();
    if (!w.publicKey || !w.signTransaction) { setError("Connect a Solana wallet first."); return; }
    if (!poolId.trim() || !input || !output) { setError("Enter a verified Raydium CPMM pool."); return; }
    if (!amount.trim()) { setError("Enter a swap amount."); return; }
    setError(""); setSignature(""); setQuote(null); setStatus("preparing");
    try {
      const rawAmount = parseUnits(amount, input.decimals ?? 9);
      const response = await fetch("/api/raydium/swap/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ poolId: poolId.trim(), trader: w.publicKey.toString(), inputMint, amount: rawAmount.toString(), slippage: Number(slippage) / 100 }) });
      const data = await response.json() as { transaction?: string; outputAmount?: string; minimumOutputAmount?: string; tradeFee?: string; outputMint?: string; error?: string };
      if (!response.ok || !data.transaction || !data.outputAmount || !data.outputMint) throw new Error(data.error || "Unable to prepare Raydium swap");
      setQuote({ outputAmount: data.outputAmount, minimumOutputAmount: data.minimumOutputAmount || "0", tradeFee: data.tradeFee || "0", outputMint: data.outputMint });
      setStatus("signing");
      const signed = await w.signTransaction(VersionedTransaction.deserialize(Buffer.from(data.transaction, "base64")));
      setStatus("confirming");
      const connection = new Connection(RPC, "confirmed");
      const latest = await connection.getLatestBlockhash("confirmed");
      const txid = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 3 });
      setSignature(txid);
      await waitFor(connection, txid, latest.lastValidBlockHeight);
      setStatus("confirmed");
    } catch (e) { setStatus("failed"); setError(e instanceof Error ? e.message : "Swap failed"); }
  }

  function flip() {
    if (output) { setInputMint(output.address); setAmount(""); setQuote(null); }
  }

  const outputDecimals = output?.decimals ?? 9;
  return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
    <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#f5c542]">Raydium CPMM</p><h3 className="mt-2 text-xl font-black">Trade a migrated pool</h3></div><span className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-wider text-white/45">Verified on-chain</span></div>
    <label className="mt-5 block text-sm text-white/50">Pool ID<input value={poolId} onChange={(e) => setPoolId(e.target.value)} className="forge-input" placeholder="Raydium CPMM pool address" /></label>
    {loadingPool && <p className="mt-3 text-xs text-white/40">Checking pool account…</p>}
    {mints.length === 2 && <>
      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex items-center justify-between"><span className="text-xs text-white/40">You pay</span><button onClick={flip} className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/50">Flip</button></div><div className="mt-2 flex items-center gap-3"><input value={amount} onChange={(e) => setAmount(e.target.value)} className="min-w-0 flex-1 bg-transparent text-2xl font-bold outline-none" inputMode="decimal" placeholder="0.00" /><span className="font-bold">{input?.symbol || (inputMint === WSOL ? "SOL" : "TOKEN")}</span></div></div>
      <div className="py-2 text-center text-white/20">↓</div>
      <div className="rounded-xl border border-white/10 bg-black/20 p-4"><span className="text-xs text-white/40">You receive</span><div className="mt-2 flex items-center justify-between gap-3"><span className="text-2xl font-bold text-white/60">{quote ? formatUnits(quote.outputAmount, outputDecimals) : "0.00"}</span><span className="font-bold">{output?.symbol || "TOKEN"}</span></div></div>
      <label className="mt-4 block text-sm text-white/50">Slippage<input value={slippage} onChange={(e) => setSlippage(e.target.value)} className="forge-input" inputMode="decimal" placeholder="0.5" /><span className="mt-1 block text-[11px] text-white/30">Percent. The server converts this to the Raydium SDK slippage fraction.</span></label>
      {quote && <div className="mt-4 grid gap-2 rounded-xl border border-white/10 p-4 text-xs text-white/45"><div className="flex justify-between"><span>Minimum received</span><span>{formatUnits(quote.minimumOutputAmount, outputDecimals)} {output?.symbol || "TOKEN"}</span></div><div className="flex justify-between"><span>Pool trade fee</span><span>{formatUnits(quote.tradeFee, input?.decimals ?? 9)} {input?.symbol || "TOKEN"}</span></div></div>}
      <button onClick={swap} disabled={status === "preparing" || status === "signing" || status === "confirming" || loadingPool} className="mt-5 w-full rounded-xl bg-[#f5c542] py-3 font-bold text-black disabled:opacity-40">{status === "preparing" ? "Preparing…" : status === "signing" ? "Approve in wallet…" : status === "confirming" ? "Confirming…" : status === "confirmed" ? "Swap confirmed ✓" : "Swap on Raydium"}</button>
    </>}
    {signature && <a className="mt-3 block break-all text-xs text-[#f5c542]" href={`https://solscan.io/tx/${signature}?cluster=${process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet"}`} target="_blank" rel="noreferrer">View transaction</a>}
    {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
  </div>;
}
