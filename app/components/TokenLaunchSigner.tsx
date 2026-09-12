"use client";

import { useState } from "react";
import { Connection, Transaction } from "@solana/web3.js";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const POLL_MS = 500;
const TIMEOUT_MS = 90_000;
const FAIR_SUPPLY = "1000000000";
const FAIR_DECIMALS = 9;
const DEV_BUY_LAMPORTS = "500000000";
const DEFAULT_METADATA_URI = "https://raw.githubusercontent.com/solana-developers/program-examples/new-examples/tokens/tokens/.assets/spl-token.json";

type BrowserSolanaWallet = {
  publicKey?: { toString(): string } | null;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
};

function getWallet(): BrowserSolanaWallet | undefined {
  return (window as Window & { solana?: BrowserSolanaWallet }).solana;
}

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForSignature(connection: Connection, signature: string, lastValidBlockHeight: number, label: string) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < TIMEOUT_MS) {
    const status = (await connection.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
    if (status?.err) throw new Error(`${label} failed: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    if (await connection.getBlockHeight("confirmed") > lastValidBlockHeight) throw new Error(`${label} expired before confirmation`);
    await sleep(POLL_MS);
  }
  throw new Error(`Timed out waiting for ${label.toLowerCase()}`);
}

export function TokenLaunchSigner() {
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [metadataUri, setMetadataUri] = useState(DEFAULT_METADATA_URI);
  const [status, setStatus] = useState<"idle" | "preparing" | "signing" | "confirming" | "developer_buy_ready" | "developer_signing" | "developer_confirming" | "complete" | "failed">("idle");
  const [mint, setMint] = useState("");
  const [signature, setSignature] = useState("");
  const [developerBuySignature, setDeveloperBuySignature] = useState("");
  const [error, setError] = useState("");

  async function launch() {
    const wallet = getWallet();
    if (!wallet?.publicKey || !wallet.signTransaction) { setError("Connect a Solana wallet first."); return; }
    if (!name.trim() || !symbol.trim()) { setError("Token name and symbol are required."); return; }
    setError(""); setSignature(""); setDeveloperBuySignature(""); setMint(""); setStatus("preparing");
    try {
      const response = await fetch("/api/launch/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payer: wallet.publicKey.toString(),
          name: name.trim(),
          symbol: symbol.trim().toUpperCase(),
          decimals: FAIR_DECIMALS,
          supply: FAIR_SUPPLY,
          metadataUri: metadataUri.trim(),
          revokeMintAuthority: true,
          revokeFreezeAuthority: true,
        }),
      });
      const data = await response.json() as { mint?: string; transaction?: string; lastValidBlockHeight?: number; error?: string };
      if (!response.ok || !data.mint || !data.transaction || typeof data.lastValidBlockHeight !== "number") throw new Error(data.error || "Unable to prepare launch");

      setMint(data.mint);
      setStatus("signing");
      // The server partially signed this transaction with the new mint keypair.
      // Never replace its blockhash after partial signing.
      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
      const signed = await wallet.signTransaction(tx);
      setStatus("confirming");
      const connection = new Connection(RPC, "confirmed");
      const txid = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 3 });
      setSignature(txid);
      await waitForSignature(connection, txid, data.lastValidBlockHeight, "Launch transaction");
      setStatus("developer_buy_ready");
    } catch (e) {
      setStatus("failed");
      setError(e instanceof Error ? e.message : "Launch failed");
    }
  }

  async function developerBuy() {
    const wallet = getWallet();
    if (!wallet?.publicKey || !wallet.signTransaction || !mint) { setError("Connect the developer wallet and complete the token launch first."); return; }
    setError(""); setStatus("developer_signing");
    try {
      const response = await fetch("/api/fair-launch/buy/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mint, developer: wallet.publicKey.toString(), grossLamports: DEV_BUY_LAMPORTS }),
      });
      const data = await response.json() as { transaction?: string; lastValidBlockHeight?: number; error?: string };
      if (!response.ok || !data.transaction || typeof data.lastValidBlockHeight !== "number") throw new Error(data.error || "Unable to prepare developer buy");

      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
      const signed = await wallet.signTransaction(tx);
      setStatus("developer_confirming");
      const connection = new Connection(RPC, "confirmed");
      const txid = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 3 });
      setDeveloperBuySignature(txid);
      await waitForSignature(connection, txid, data.lastValidBlockHeight, "Developer first buy");
      setStatus("complete");
    } catch (e) {
      setStatus("failed");
      setError(e instanceof Error ? e.message : "Developer buy failed");
    }
  }

  const busy = ["preparing", "signing", "confirming", "developer_signing", "developer_confirming"].includes(status);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#f5c542]">Devnet Fair Launch</p>
        <h3 className="mt-2 text-xl font-black">Create → seed → developer buy</h3>
        <p className="mt-2 text-sm leading-6 text-white/45">FORGE X creates the fixed 1B token, locks authorities, finalizes metadata, initializes and seeds the curve, then requires the developer's 0.5 SOL first buy before public trading.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className="forge-input" placeholder="Token name" maxLength={32} />
        <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} className="forge-input" placeholder="SYMBOL" maxLength={10} />
        <input value={metadataUri} onChange={(e) => setMetadataUri(e.target.value)} className="forge-input sm:col-span-2" placeholder="Metadata URI" />
      </div>
      <button onClick={status === "developer_buy_ready" ? developerBuy : launch} disabled={busy || status === "complete"} className="mt-4 w-full rounded-xl bg-[#f5c542] px-5 py-3 font-bold text-black disabled:opacity-40">
        {status === "preparing" ? "Preparing…" : status === "signing" ? "Approve launch in wallet…" : status === "confirming" ? "Confirming launch…" : status === "developer_buy_ready" ? "Approve developer first buy · 0.5 SOL" : status === "developer_signing" ? "Approve developer buy…" : status === "developer_confirming" ? "Confirming developer buy…" : status === "complete" ? "Fair Launch is live ✓" : "Create Fair Launch token"}
      </button>
      {mint && <p className="mt-3 break-all text-xs text-white/45">Mint: {mint}</p>}
      {signature && <a className="mt-2 block break-all text-xs text-[#f5c542]" href={`https://solscan.io/tx/${signature}?cluster=devnet`} target="_blank" rel="noreferrer">View launch transaction</a>}
      {developerBuySignature && <a className="mt-2 block break-all text-xs text-[#f5c542]" href={`https://solscan.io/tx/${developerBuySignature}?cluster=devnet`} target="_blank" rel="noreferrer">View developer buy transaction</a>}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </div>
  );
}
