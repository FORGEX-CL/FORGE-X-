"use client";

import { useState } from "react";
import { Connection, VersionedTransaction } from "@solana/web3.js";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const POLL_MS = 500;
const TIMEOUT_MS = 90_000;

type BrowserSolanaProvider = {
  publicKey?: { toString(): string } | null;
  signTransaction?: (transaction: VersionedTransaction) => Promise<VersionedTransaction>;
};

function getProvider(): BrowserSolanaProvider | undefined {
  return (window as Window & { solana?: BrowserSolanaProvider }).solana;
}

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForSignature(connection: Connection, signature: string) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < TIMEOUT_MS) {
    const status = (await connection.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
    if (status?.err) throw new Error(`Swap transaction failed: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    await sleep(POLL_MS);
  }
  throw new Error("Timed out waiting for swap confirmation");
}

export function SolanaSwap({ quote }: { quote: unknown }) {
  const [status, setStatus] = useState<"idle" | "signing" | "confirming" | "confirmed" | "failed">("idle");
  const [signature, setSignature] = useState("");

  async function signAndSend() {
    const provider = getProvider();
    if (!provider?.publicKey || !provider.signTransaction) return setStatus("failed");
    try {
      setStatus("signing");
      const response = await fetch("/api/swap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteResponse: quote, userPublicKey: provider.publicKey.toString() }) });
      const data = await response.json() as { swapTransaction?: string; error?: string };
      if (!response.ok || !data.swapTransaction) throw new Error(data.error || "Could not build transaction");
      const transaction = VersionedTransaction.deserialize(Buffer.from(data.swapTransaction, "base64"));
      const signed = await provider.signTransaction(transaction);
      setStatus("confirming");
      const connection = new Connection(RPC, "confirmed");
      const txid = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 3 });
      setSignature(txid);
      await waitForSignature(connection, txid);
      setStatus("confirmed");
    } catch { setStatus("failed"); }
  }

  return <div className="mt-4"><button onClick={signAndSend} disabled={status === "signing" || status === "confirming"} className="w-full rounded-xl bg-[#f5c542] px-5 py-3 font-bold text-black disabled:opacity-40">{status === "signing" ? "Approve in wallet…" : status === "confirming" ? "Confirming on Solana…" : status === "confirmed" ? "Swap confirmed ✓" : "Swap with connected wallet"}</button>{signature && <a className="mt-3 block break-all text-xs text-[#f5c542]" target="_blank" rel="noreferrer" href={`https://solscan.io/tx/${signature}`}>View transaction: {signature}</a>}{status === "failed" && <p className="mt-2 text-xs text-red-400">Swap failed or was rejected. No funds are held by FORGE X.</p>}</div>;
}
