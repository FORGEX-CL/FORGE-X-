"use client";

import { useEffect, useState } from "react";
import { Connection, Transaction } from "@solana/web3.js";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const DECIMALS = 9;
const POLL_MS = 500;
const TIMEOUT_MS = 90_000;

type StateData = {
  status: string;
  developerBuyLamports: string;
  realSolRaisedLamports: string;
  virtualSolReserveLamports: string;
  virtualTokenReserveBaseUnits: string;
  graduationSolLamports: string;
};

type Wallet = { publicKey?: { toString(): string } | null; signTransaction?: (tx: Transaction) => Promise<Transaction> };
function wallet(): Wallet { return (window as Window & { solana?: Wallet }).solana || {}; }
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function toBaseUnits(value: string, decimals: number): bigint {
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error("Enter a valid positive number");
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) throw new Error(`Maximum ${decimals} decimal places allowed`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
}
function formatUnits(raw: string, decimals: number): string {
  const value = BigInt(raw);
  const unit = 10n ** BigInt(decimals);
  const whole = value / unit;
  const fraction = (value % unit).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
async function waitFor(connection: Connection, signature: string, lastValidBlockHeight: number) {
  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    const status = (await connection.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
    if (status?.err) throw new Error(`Trade failed: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    if (await connection.getBlockHeight("confirmed") > lastValidBlockHeight) throw new Error("Trade transaction expired before confirmation");
    await sleep(POLL_MS);
  }
  throw new Error("Timed out waiting for trade confirmation");
}

export function FairLaunchTrader() {
  const [mint, setMint] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [state, setState] = useState<StateData | null>(null);
  const [quote, setQuote] = useState("");
  const [status, setStatus] = useState("idle");
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setQuote("");
    if (!mint.trim()) { setState(null); return; }
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/fair-launch/state?mint=${encodeURIComponent(mint.trim())}`);
        const data = await response.json() as StateData & { error?: string };
        if (!response.ok) throw new Error(data.error || "Fair Launch not found");
        setState(data); setError("");
      } catch (e) { setState(null); setError(e instanceof Error ? e.message : "Unable to load Fair Launch state"); }
    }, 350);
    return () => clearTimeout(timer);
  }, [mint]);

  useEffect(() => {
    if (!state || !amount.trim()) { setQuote(""); return; }
    const timer = setTimeout(async () => {
      try {
        const raw = toBaseUnits(amount, side === "buy" ? 9 : DECIMALS);
        const response = await fetch("/api/fair-launch/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ side, amount: raw.toString(), virtualSol: state.virtualSolReserveLamports, virtualTokens: state.virtualTokenReserveBaseUnits, developerBuy: state.developerBuyLamports, realSolRaised: state.realSolRaisedLamports }) });
        const data = await response.json() as { tokensOut?: string; netSolOut?: string; error?: string };
        if (!response.ok) throw new Error(data.error || "Unable to quote trade");
        setQuote(side === "buy" ? `Estimated output: ${formatUnits(data.tokensOut || "0", DECIMALS)} tokens` : `Estimated output: ${formatUnits(data.netSolOut || "0", 9)} SOL`);
      } catch (e) { setQuote(e instanceof Error ? e.message : "Unable to quote trade"); }
    }, 250);
    return () => clearTimeout(timer);
  }, [amount, side, state]);

  async function trade() {
    const w = wallet();
    if (!w.publicKey || !w.signTransaction) { setError("Connect a Solana wallet first."); return; }
    if (!mint.trim() || !amount.trim()) { setError("Enter a Fair Launch mint and amount."); return; }
    if (!state) { setError("Load a valid Fair Launch before trading."); return; }
    if (side === "buy" && state.status !== "LIVE" && state.status !== "WAITING_FOR_DEV_BUY") { setError("This Fair Launch is not accepting buys."); return; }
    if (side === "sell" && state.status !== "LIVE") { setError("This Fair Launch is not accepting sells."); return; }
    setError(""); setSignature(""); setStatus("preparing");
    try {
      const rawAmount = toBaseUnits(amount, 9);
      const response = await fetch("/api/fair-launch/trade/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mint: mint.trim(), trader: w.publicKey.toString(), side, amount: rawAmount.toString() }) });
      const data = await response.json() as { transaction?: string; lastValidBlockHeight?: number; error?: string };
      if (!response.ok || !data.transaction || typeof data.lastValidBlockHeight !== "number") throw new Error(data.error || "Unable to prepare trade");
      setStatus("signing");
      const signed = await w.signTransaction(Transaction.from(Buffer.from(data.transaction, "base64")));
      setStatus("confirming");
      const connection = new Connection(RPC, "confirmed");
      const txid = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 3 });
      setSignature(txid);
      await waitFor(connection, txid, data.lastValidBlockHeight);
      setStatus("confirmed");
      const refreshed = await fetch(`/api/fair-launch/state?mint=${encodeURIComponent(mint.trim())}`);
      if (refreshed.ok) setState(await refreshed.json() as StateData);
    } catch (e) {
      setStatus("failed"); setError(e instanceof Error ? e.message : "Trade failed");
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
      <div className="flex rounded-xl bg-white/5 p-1">
        <button onClick={() => setSide("buy")} className={`flex-1 rounded-lg py-2 text-sm font-bold ${side === "buy" ? "bg-white/10" : "text-white/40"}`}>Buy</button>
        <button onClick={() => setSide("sell")} className={`flex-1 rounded-lg py-2 text-sm font-bold ${side === "sell" ? "bg-white/10" : "text-white/40"}`}>Sell</button>
      </div>
      <label className="mt-5 block text-sm text-white/50">Fair Launch mint<input value={mint} onChange={(e) => setMint(e.target.value)} className="forge-input" placeholder="Mint address" /></label>
      {state && <p className="mt-3 text-xs text-white/40">Status: <span className="text-white/70">{state.status}</span> · Raised {formatUnits(state.realSolRaisedLamports, 9)} / {formatUnits(state.graduationSolLamports, 9)} SOL</p>}
      <label className="mt-4 block text-sm text-white/50">{side === "buy" ? "SOL amount" : "Token amount"}<input value={amount} onChange={(e) => setAmount(e.target.value)} className="forge-input" inputMode="decimal" placeholder={side === "buy" ? "0.50" : "1000"} /></label>
      {quote && <p className="mt-3 text-sm text-white/60">{quote}</p>}
      <p className="mt-3 text-xs leading-5 text-white/35">Amounts use human units. The server converts them to lamports/base units and builds the real on-chain instruction. Trading charges the configured 0.50% fee.</p>
      <button onClick={trade} disabled={status === "preparing" || status === "signing" || status === "confirming"} className="mt-5 w-full rounded-xl bg-[#f5c542] py-3 font-bold text-black disabled:opacity-40">
        {status === "preparing" ? "Preparing…" : status === "signing" ? "Approve in wallet…" : status === "confirming" ? "Confirming…" : status === "confirmed" ? "Trade confirmed ✓" : side === "buy" ? "Buy on Fair Launch" : "Sell on Fair Launch"}
      </button>
      {signature && <a className="mt-3 block break-all text-xs text-[#f5c542]" href={`https://solscan.io/tx/${signature}?cluster=devnet`} target="_blank" rel="noreferrer">View transaction</a>}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </div>
  );
}
