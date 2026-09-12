"use client";

import { useState } from "react";
import { Connection, Transaction } from "@solana/web3.js";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const POLL_MS = 500;
const TIMEOUT_MS = 90_000;

function wallet() {
  return (window as Window & { solana?: { publicKey?: { toString(): string } | null; signTransaction?: (tx: Transaction) => Promise<Transaction> } }).solana;
}
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
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
  const [status, setStatus] = useState("idle");
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");

  async function trade() {
    const w = wallet();
    if (!w?.publicKey || !w.signTransaction) { setError("Connect a Solana wallet first."); return; }
    if (!mint.trim() || !amount.trim()) { setError("Enter a Fair Launch mint and amount."); return; }
    setError(""); setSignature(""); setStatus("preparing");
    try {
      const response = await fetch("/api/fair-launch/trade/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mint: mint.trim(), trader: w.publicKey.toString(), side, amount }),
      });
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
    } catch (e) {
      setStatus("failed");
      setError(e instanceof Error ? e.message : "Trade failed");
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
      <div className="flex rounded-xl bg-white/5 p-1">
        <button onClick={() => setSide("buy")} className={`flex-1 rounded-lg py-2 text-sm font-bold ${side === "buy" ? "bg-white/10" : "text-white/40"}`}>Buy</button>
        <button onClick={() => setSide("sell")} className={`flex-1 rounded-lg py-2 text-sm font-bold ${side === "sell" ? "bg-white/10" : "text-white/40"}`}>Sell</button>
      </div>
      <label className="mt-5 block text-sm text-white/50">Fair Launch mint<input value={mint} onChange={(e) => setMint(e.target.value)} className="forge-input" placeholder="Mint address" /></label>
      <label className="mt-4 block text-sm text-white/50">{side === "buy" ? "SOL amount (lamports)" : "Token amount (base units)"}<input value={amount} onChange={(e) => setAmount(e.target.value)} className="forge-input" inputMode="numeric" placeholder={side === "buy" ? "500000000" : "1000000000"} /></label>
      <p className="mt-3 text-xs leading-5 text-white/35">Buy amounts are lamports. Sell amounts are token base units. The server builds the real program instruction; your wallet signs it.</p>
      <button onClick={trade} disabled={status === "preparing" || status === "signing" || status === "confirming"} className="mt-5 w-full rounded-xl bg-[#f5c542] py-3 font-bold text-black disabled:opacity-40">
        {status === "preparing" ? "Preparing…" : status === "signing" ? "Approve in wallet…" : status === "confirming" ? "Confirming…" : status === "confirmed" ? "Trade confirmed ✓" : side === "buy" ? "Buy on Fair Launch" : "Sell on Fair Launch"}
      </button>
      {signature && <a className="mt-3 block break-all text-xs text-[#f5c542]" href={`https://solscan.io/tx/${signature}?cluster=devnet`} target="_blank" rel="noreferrer">View transaction</a>}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </div>
  );
}
