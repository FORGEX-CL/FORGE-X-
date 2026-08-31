"use client";

import { useState } from "react";
import { Connection, VersionedTransaction } from "@solana/web3.js";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export function SolanaSwap({ quote }: { quote: any }) {
  const [status, setStatus] = useState<"idle" | "signing" | "confirming" | "confirmed" | "failed">("idle");
  const [signature, setSignature] = useState("");

  async function signAndSend() {
    const provider = (window as any).solana;
    if (!provider?.publicKey || !provider.signTransaction) return setStatus("failed");
    try {
      setStatus("signing");
      const response = await fetch("/api/swap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteResponse: quote, userPublicKey: provider.publicKey.toString() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not build transaction");
      const transaction = VersionedTransaction.deserialize(Buffer.from(data.swapTransaction, "base64"));
      const signed = await provider.signTransaction(transaction);
      setStatus("confirming");
      const connection = new Connection(RPC, "confirmed");
      const txid = await connection.sendRawTransaction(signed.serialize(), { maxRetries: 2 });
      setSignature(txid);
      await connection.confirmTransaction({ signature: txid, blockhash: transaction.message.recentBlockhash, lastValidBlockHeight: data.lastValidBlockHeight }, "confirmed");
      setStatus("confirmed");
    } catch { setStatus("failed"); }
  }

  return <div className="mt-4"><button onClick={signAndSend} disabled={status === "signing" || status === "confirming"} className="w-full rounded-xl bg-[#f5c542] px-5 py-3 font-bold text-black disabled:opacity-40">{status === "signing" ? "Approve in wallet…" : status === "confirming" ? "Confirming on Solana…" : status === "confirmed" ? "Swap confirmed ✓" : "Swap with connected wallet"}</button>{signature && <a className="mt-3 block break-all text-xs text-[#f5c542]" target="_blank" rel="noreferrer" href={`https://solscan.io/tx/${signature}`}>View transaction: {signature}</a>}{status === "failed" && <p className="mt-2 text-xs text-red-400">Swap failed or was rejected. No funds are held by FORGE X.</p>}</div>;
}
