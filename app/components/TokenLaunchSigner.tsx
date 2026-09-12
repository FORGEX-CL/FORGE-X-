"use client";

import { useState } from "react";
import { Connection, Transaction } from "@solana/web3.js";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const POLL_MS = 500;
const TIMEOUT_MS = 90_000;
const FAIR_SUPPLY = "1000000000";
const FAIR_DECIMALS = 9;
const DEFAULT_METADATA_URI = "https://raw.githubusercontent.com/solana-developers/program-examples/new-examples/tokens/tokens/.assets/spl-token.json";

type BrowserSolanaWallet = {
  publicKey?: { toString(): string } | null;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
};

function getWallet(): BrowserSolanaWallet | undefined {
  return (window as Window & { solana?: BrowserSolanaWallet }).solana;
}

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForSignature(connection: Connection, signature: string, lastValidBlockHeight: number) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < TIMEOUT_MS) {
    const status = (await connection.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
    if (status?.err) throw new Error(`Launch transaction failed: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    if (await connection.getBlockHeight("confirmed") > lastValidBlockHeight) {
      throw new Error("Launch transaction expired before confirmation");
    }
    await sleep(POLL_MS);
  }
  throw new Error("Timed out waiting for launch confirmation");
}

export function TokenLaunchSigner() {
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [metadataUri, setMetadataUri] = useState(DEFAULT_METADATA_URI);
  const [status, setStatus] = useState<"idle" | "preparing" | "signing" | "confirming" | "confirmed" | "failed">("idle");
  const [mint, setMint] = useState("");
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");

  async function launch() {
    const wallet = getWallet();
    if (!wallet?.publicKey || !wallet.signTransaction) { setError("Connect a Solana wallet first."); return; }
    if (!name.trim() || !symbol.trim()) { setError("Token name and symbol are required."); return; }
    setError(""); setSignature(""); setMint(""); setStatus("preparing");
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
      // The server already prepared and partially signed this transaction with the mint
      // keypair. Do not replace its blockhash: doing so would invalidate that signature.
      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
      const signed = await wallet.signTransaction(tx);

      setStatus("confirming");
      const connection = new Connection(RPC, "confirmed");
      const txid = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      });
      setSignature(txid);
      await waitForSignature(connection, txid, data.lastValidBlockHeight);
      setStatus("confirmed");
    } catch (e) {
      setStatus("failed");
      setError(e instanceof Error ? e.message : "Launch failed");
    }
  }

  const busy = status === "preparing" || status === "signing" || status === "confirming";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#f5c542]">Devnet Fair Launch</p>
        <h3 className="mt-2 text-xl font-black">Create a real wallet-signed token</h3>
        <p className="mt-2 text-sm leading-6 text-white/45">1B supply, 9 decimals, mint and freeze authority revoked, immutable metadata, and real on-chain confirmation.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className="forge-input" placeholder="Token name" maxLength={32} />
        <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} className="forge-input" placeholder="SYMBOL" maxLength={10} />
        <input value={metadataUri} onChange={(e) => setMetadataUri(e.target.value)} className="forge-input sm:col-span-2" placeholder="Metadata URI" />
      </div>
      <button onClick={launch} disabled={busy} className="mt-4 w-full rounded-xl bg-[#f5c542] px-5 py-3 font-bold text-black disabled:opacity-40">
        {status === "preparing" ? "Preparing…" : status === "signing" ? "Approve in wallet…" : status === "confirming" ? "Confirming on Solana…" : status === "confirmed" ? "Launch confirmed ✓" : "Create Fair Launch token"}
      </button>
      {mint && <p className="mt-3 break-all text-xs text-white/45">Mint: {mint}</p>}
      {signature && <a className="mt-2 block break-all text-xs text-[#f5c542]" href={`https://solscan.io/tx/${signature}?cluster=devnet`} target="_blank" rel="noreferrer">View Devnet transaction</a>}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </div>
  );
}
