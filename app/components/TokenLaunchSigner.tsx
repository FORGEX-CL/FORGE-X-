"use client";

import { useState } from "react";
import { Connection, Transaction } from "@solana/web3.js";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export function TokenLaunchSigner() {
  const [status, setStatus] = useState("idle");
  const [mint, setMint] = useState("");
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");

  async function launch() {
    const wallet = (window as any).solana;
    if (!wallet?.publicKey || !wallet.signTransaction) { setError("Connect a Solana wallet first."); return; }
    setError(""); setStatus("preparing");
    try {
      const response = await fetch("/api/launch/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payer: wallet.publicKey.toString(), name: "FORGE TEST", symbol: "FGX", decimals: 9, supply: "1000000", revokeMintAuthority: true, revokeFreezeAuthority: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to prepare launch");
      setMint(data.mint); setStatus("signing");
      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
      const signed = await wallet.signTransaction(tx);
      setStatus("confirming");
      const connection = new Connection(RPC, "confirmed");
      const txid = await connection.sendRawTransaction(signed.serialize(), { maxRetries: 2 });
      setSignature(txid);
      await connection.confirmTransaction({ signature: txid, blockhash: tx.recentBlockhash!, lastValidBlockHeight: data.lastValidBlockHeight }, "confirmed");
      setStatus("confirmed");
    } catch (e) { setStatus("failed"); setError(e instanceof Error ? e.message : "Launch failed"); }
  }

  return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6"><div className="mb-4"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#f5c542]">Devnet launch</p><h3 className="mt-2 text-xl font-black">Test wallet-signed mint</h3></div><button onClick={launch} disabled={status === "preparing" || status === "signing" || status === "confirming"} className="w-full rounded-xl bg-[#f5c542] px-5 py-3 font-bold text-black disabled:opacity-40">{status === "preparing" ? "Preparing…" : status === "signing" ? "Approve in wallet…" : status === "confirming" ? "Confirming…" : status === "confirmed" ? "Mint confirmed ✓" : "Create Devnet test token"}</button>{mint && <p className="mt-3 break-all text-xs text-white/45">Mint: {mint}</p>}{signature && <a className="mt-2 block break-all text-xs text-[#f5c542]" href={`https://solscan.io/tx/${signature}?cluster=devnet`} target="_blank" rel="noreferrer">View Devnet transaction</a>}{error && <p className="mt-3 text-xs text-red-400">{error}</p>}</div>;
}
