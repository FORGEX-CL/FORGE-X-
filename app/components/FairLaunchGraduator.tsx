"use client";

import { useState } from "react";
import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet";
const TIMEOUT_MS = 90_000;

type Wallet = {
  publicKey?: { toString(): string } | null;
  signTransaction?: (transaction: VersionedTransaction) => Promise<VersionedTransaction>;
};

type State = {
  status?: string;
  realSolRaisedLamports?: string;
  virtualTokenReserveBaseUnits?: string;
  graduationSolLamports?: string;
  developer?: string;
};

function getWallet(): Wallet | undefined {
  return (window as Window & { solana?: Wallet }).solana;
}
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function explorerTx(signature: string) {
  const suffix = CLUSTER === "mainnet-beta" ? "" : `?cluster=${encodeURIComponent(CLUSTER)}`;
  return `https://solscan.io/tx/${signature}${suffix}`;
}
async function waitFor(connection: Connection, signature: string) {
  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    const result = (await connection.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
    if (result?.err) throw new Error(`Graduation failed: ${JSON.stringify(result.err)}`);
    if (result?.confirmationStatus === "confirmed" || result?.confirmationStatus === "finalized") return;
    await sleep(500);
  }
  throw new Error("Timed out waiting for graduation confirmation");
}

export function FairLaunchGraduator() {
  const [mint, setMint] = useState("");
  const [state, setState] = useState<State | null>(null);
  const [poolId, setPoolId] = useState("");
  const [signature, setSignature] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function loadState() {
    setError(""); setState(null); setPoolId(""); setSignature("");
    try {
      const value = new PublicKey(mint.trim());
      const wallet = getWallet();
      if (!wallet?.publicKey) throw new Error("Connect the developer wallet first");
      const response = await fetch(`/api/fair-launch/state?mint=${encodeURIComponent(value.toBase58())}`);
      const data = await response.json() as State & { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to load Fair Launch state");
      setState(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load state");
    }
  }

  async function graduate() {
    const wallet = getWallet();
    if (!wallet?.publicKey || !wallet.signTransaction) { setError("Connect a wallet that supports versioned transaction signing."); return; }
    if (!state || state.status !== "GRADUATED") { setError("The launch must reach graduation before migration."); return; }
    setError(""); setStatus("preparing");
    try {
      const response = await fetch("/api/fair-launch/graduate/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mint: new PublicKey(mint.trim()).toBase58(),
          developer: wallet.publicKey.toString(),
          solLamports: state.realSolRaisedLamports,
          tokenBaseUnits: state.virtualTokenReserveBaseUnits,
        }),
      });
      const data = await response.json() as { transaction?: string; poolId?: string; error?: string };
      if (!response.ok || !data.transaction || !data.poolId) throw new Error(data.error || "Unable to prepare Raydium graduation");
      setPoolId(data.poolId);
      const transaction = VersionedTransaction.deserialize(Buffer.from(data.transaction, "base64"));
      setStatus("awaiting_signature");
      const signed = await wallet.signTransaction(transaction);
      setStatus("confirming");
      const connection = new Connection(RPC, "confirmed");
      const txid = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 3 });
      setSignature(txid);
      await waitFor(connection, txid);
      setStatus("verifying");
      const verify = await fetch(`/api/fair-launch/graduate/verify?mint=${encodeURIComponent(mint.trim())}&developer=${encodeURIComponent(wallet.publicKey.toString())}&poolId=${encodeURIComponent(data.poolId)}&signature=${encodeURIComponent(txid)}`);
      const verifyData = await verify.json() as { verified?: boolean; error?: string };
      if (!verify.ok || !verifyData.verified) throw new Error(verifyData.error || "Graduation transaction confirmed but on-chain verification failed");
      setStatus("complete");
      await loadState();
    } catch (e) {
      setStatus("failed"); setError(e instanceof Error ? e.message : "Graduation failed");
    }
  }

  const canGraduate = state?.status === "GRADUATED";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#f5c542]">Fair Launch graduation</p>
        <h2 className="mt-2 text-2xl font-black">Move a graduated launch to Raydium CPMM</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">FORGE X atomically migrates the graduated curve reserves to the developer wallet and executes the Raydium CPMM pool creation in the same transaction. If either side fails, the transaction rolls back.</p>
      </div>
      <div className="mt-5 flex gap-3">
        <input value={mint} onChange={(e) => setMint(e.target.value)} className="forge-input min-w-0 flex-1" placeholder="Graduated token mint" />
        <button onClick={loadState} disabled={!mint.trim() || status === "preparing" || status === "confirming" || status === "verifying"} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold hover:bg-white/5 disabled:opacity-40">Check</button>
      </div>
      {state && <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 p-4"><div className="text-xs text-white/35">Status</div><div className="mt-1 font-bold">{state.status}</div></div>
        <div className="rounded-xl border border-white/10 p-4"><div className="text-xs text-white/35">SOL liquidity</div><div className="mt-1 font-bold">{state.realSolRaisedLamports ? `${(Number(state.realSolRaisedLamports) / 1e9).toFixed(4)} SOL` : "—"}</div></div>
        <div className="rounded-xl border border-white/10 p-4"><div className="text-xs text-white/35">Token liquidity</div><div className="mt-1 font-bold">{state.virtualTokenReserveBaseUnits ? (Number(state.virtualTokenReserveBaseUnits) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—"}</div></div>
      </div>}
      <button onClick={graduate} disabled={!canGraduate || ["preparing", "confirming", "verifying", "complete"].includes(status)} className="mt-5 w-full rounded-xl bg-[#f5c542] px-5 py-3 font-bold text-black disabled:opacity-40">
        {status === "preparing" ? "Preparing atomic graduation…" : status === "awaiting_signature" ? "Approve Raydium graduation in wallet…" : status === "confirming" ? "Confirming graduation…" : status === "verifying" ? "Verifying signed migration + pool…" : status === "complete" ? "Graduation verified ✓" : "Graduate to Raydium CPMM"}
      </button>
      {poolId && <p className="mt-3 break-all text-xs text-white/40">Raydium pool: {poolId}</p>}
      {signature && <a href={explorerTx(signature)} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-[#f5c542]">View graduation transaction</a>}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </div>
  );
}
