"use client";

import { useState } from "react";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const POLL_MS = 500;
const TIMEOUT_MS = 90_000;
const FAIR_SUPPLY = "1000000000";
const TEST_METADATA_URI = "https://raw.githubusercontent.com/solana-developers/program-examples/new-examples/tokens/tokens/.assets/spl-token.json";

type BrowserSolanaWallet = {
  publicKey?: { toString(): string } | null;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
};

function getWallet(): BrowserSolanaWallet | undefined {
  return (window as Window & { solana?: BrowserSolanaWallet }).solana;
}

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForSignature(connection: Connection, signature: string) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < TIMEOUT_MS) {
    const status = (await connection.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
    if (status?.err) throw new Error(`Launch transaction failed: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    await sleep(POLL_MS);
  }
  throw new Error("Timed out waiting for launch confirmation");
}

export function TokenLaunchSigner() {
  const [status, setStatus] = useState("idle");
  const [mint, setMint] = useState("");
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");

  async function launch() {
    const wallet = getWallet();
    if (!wallet?.publicKey || !wallet.signTransaction) { setError("Connect a Solana wallet first."); return; }
    setError(""); setStatus("preparing");
    try {
      const response = await fetch("/api/launch/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payer: wallet.publicKey.toString(), name: "FORGE TEST", symbol: "FGX", decimals: 9, supply: FAIR_SUPPLY, metadataUri: TEST_METADATA_URI, revokeMintAuthority: true, revokeFreezeAuthority: true }) });
      const data = await response.json() as { mint?: string; transaction?: string; error?: string };
      if (!response.ok || !data.mint || !data.transaction) throw new Error(data.error || "Unable to prepare launch");
      setMint(data.mint); setStatus("signing");
      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
      const connection = new Connection(RPC, "confirmed");
      const latest = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = latest.blockhash;
      tx.lastValidBlockHeight = latest.lastValidBlockHeight;
      tx.feePayer = tx.feePayer ?? new PublicKey(wallet.publicKey.toString());
      const signed = await wallet.signTransaction(tx);
      setStatus("confirming");
      const txid = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 3 });
      setSignature(txid);
      await waitForSignature(connection, txid);
      setStatus("confirmed");
    } catch (e) {
      setStatus("failed");
      setError(e instanceof Error ? e.message : "Launch failed");
    }
  }

  return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6"><div className="mb-4"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#f5c542]">Devnet launch</p><h3 className="mt-2 text-xl font-black">Test wallet-signed Fair Launch</h3></div><button onClick={launch} disabled={status === "preparing" || status === "signing" || status === "confirming"} className="w-full rounded-xl bg-[#f5c542] px-5 py-3 font-bold text-black disabled:opacity-40">{status === "preparing" ? "Preparing…" : status === "signing" ? "Approve in wallet…" : status === "confirming" ? "Confirming…" : status === "confirmed" ? "Mint confirmed ✓" : "Create Devnet test token"}</button>{mint && <p className="mt-3 break-all text-xs text-white/45">Mint: {mint}</p>}{signature && <a className="mt-2 block break-all text-xs text-[#f5c542]" href={`https://solscan.io/tx/${signature}?cluster=devnet`} target="_blank" rel="noreferrer">View Devnet transaction</a>}{error && <p className="mt-3 text-xs text-red-400">{error}</p>}</div>;
}
