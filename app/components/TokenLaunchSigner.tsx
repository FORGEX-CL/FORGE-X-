"use client";

import { useState } from "react";
import { Connection, Transaction } from "@solana/web3.js";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet";
const POLL_MS = 500;
const TIMEOUT_MS = 90_000;
const FAIR_SUPPLY = "1000000000";
const FAIR_DECIMALS = 9;
const DEV_BUY_LAMPORTS = "500000000";

type BrowserSolanaWallet = {
  publicKey?: { toString(): string } | null;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
};
function getWallet(): BrowserSolanaWallet | undefined { return (window as Window & { solana?: BrowserSolanaWallet }).solana; }
function explorerTx(signature: string) {
  const suffix = CLUSTER === "mainnet-beta" ? "" : `?cluster=${encodeURIComponent(CLUSTER)}`;
  return `https://solscan.io/tx/${signature}${suffix}`;
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
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [status, setStatus] = useState<"idle" | "preparing" | "metadata" | "signing" | "confirming" | "initializing" | "developer_buy_ready" | "developer_signing" | "developer_confirming" | "verifying" | "complete" | "failed">("idle");
  const [mint, setMint] = useState("");
  const [metadataUri, setMetadataUri] = useState("");
  const [signature, setSignature] = useState("");
  const [initializeSignature, setInitializeSignature] = useState("");
  const [developerBuySignature, setDeveloperBuySignature] = useState("");
  const [error, setError] = useState("");

  async function launch() {
    const wallet = getWallet();
    if (!wallet?.publicKey || !wallet.signTransaction) { setError("Connect a Solana wallet first."); return; }
    if (!name.trim() || !symbol.trim() || !description.trim()) { setError("Token name, symbol and description are required."); return; }
    setError(""); setSignature(""); setInitializeSignature(""); setDeveloperBuySignature(""); setMint(""); setMetadataUri(""); setStatus("metadata");
    try {
      const metadataResponse = await fetch("/api/metadata/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, symbol, description, image, website, twitter, telegram }) });
      const metadataData = await metadataResponse.json() as { uri?: string; error?: string };
      if (!metadataResponse.ok || !metadataData.uri) throw new Error(metadataData.error || "Unable to store token metadata");
      setMetadataUri(metadataData.uri);

      setStatus("preparing");
      const response = await fetch("/api/launch/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payer: wallet.publicKey.toString(), name: name.trim(), symbol: symbol.trim().toUpperCase(), decimals: FAIR_DECIMALS, supply: FAIR_SUPPLY, metadataUri: metadataData.uri, revokeMintAuthority: true, revokeFreezeAuthority: true }) });
      const data = await response.json() as { mint?: string; transaction?: string; lastValidBlockHeight?: number; error?: string };
      if (!response.ok || !data.mint || !data.transaction || typeof data.lastValidBlockHeight !== "number") throw new Error(data.error || "Unable to prepare launch");
      setMint(data.mint); setStatus("signing");
      const signed = await wallet.signTransaction(Transaction.from(Buffer.from(data.transaction, "base64")));
      setStatus("confirming");
      const connection = new Connection(RPC, "confirmed");
      const txid = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 3 });
      setSignature(txid);
      await waitForSignature(connection, txid, data.lastValidBlockHeight, "Launch transaction");
      setStatus("initializing");

      const initResponse = await fetch("/api/fair-launch/initialize/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mint: data.mint, developer: wallet.publicKey.toString() }) });
      const initData = await initResponse.json() as { transaction?: string; lastValidBlockHeight?: number; error?: string };
      if (!initResponse.ok || !initData.transaction || typeof initData.lastValidBlockHeight !== "number") throw new Error(initData.error || "Unable to initialize Fair Launch");
      const initSigned = await wallet.signTransaction(Transaction.from(Buffer.from(initData.transaction, "base64")));
      const initTxid = await connection.sendRawTransaction(initSigned.serialize(), { skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 3 });
      setInitializeSignature(initTxid);
      await waitForSignature(connection, initTxid, initData.lastValidBlockHeight, "Fair Launch initialization");
      setStatus("developer_buy_ready");
    } catch (e) {
      setStatus("failed"); setError(e instanceof Error ? e.message : "Launch failed");
    }
  }

  async function developerBuy() {
    const wallet = getWallet();
    if (!wallet?.publicKey || !wallet.signTransaction || !mint) { setError("Connect the developer wallet and complete initialization first."); return; }
    setError(""); setStatus("developer_signing");
    try {
      const response = await fetch("/api/fair-launch/buy/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mint, developer: wallet.publicKey.toString(), grossLamports: DEV_BUY_LAMPORTS }) });
      const data = await response.json() as { transaction?: string; lastValidBlockHeight?: number; error?: string };
      if (!response.ok || !data.transaction || typeof data.lastValidBlockHeight !== "number") throw new Error(data.error || "Unable to prepare developer buy");
      const signed = await wallet.signTransaction(Transaction.from(Buffer.from(data.transaction, "base64")));
      setStatus("developer_confirming");
      const connection = new Connection(RPC, "confirmed");
      const txid = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 3 });
      setDeveloperBuySignature(txid);
      await waitForSignature(connection, txid, data.lastValidBlockHeight, "Developer first buy");
      setStatus("verifying");
      const verifyResponse = await fetch(`/api/fair-launch/state?mint=${encodeURIComponent(mint)}`);
      const verifyData = await verifyResponse.json() as { status?: string; developerBuyLamports?: string; error?: string };
      if (!verifyResponse.ok || verifyData.status !== "LIVE" || BigInt(verifyData.developerBuyLamports || "0") < BigInt(DEV_BUY_LAMPORTS)) throw new Error(verifyData.error || "Developer buy confirmed but Fair Launch state did not become LIVE");
      setStatus("complete");
    } catch (e) {
      setStatus("failed"); setError(e instanceof Error ? e.message : "Developer buy failed");
    }
  }

  const busy = ["preparing", "metadata", "signing", "confirming", "initializing", "developer_signing", "developer_confirming", "verifying"].includes(status);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#f5c542]">{CLUSTER === "mainnet-beta" ? "Mainnet" : CLUSTER} Fair Launch</p>
        <h3 className="mt-2 text-xl font-black">Create → initialize → developer buy</h3>
        <p className="mt-2 text-sm leading-6 text-white/45">FORGE X stores real metadata on public IPFS, creates the fixed 1B token, locks authorities, initializes the curve, seeds its vault, then requires and verifies the developer's 0.5 SOL first buy.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className="forge-input" placeholder="Token name" maxLength={32} />
        <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} className="forge-input" placeholder="SYMBOL" maxLength={10} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="forge-input min-h-24 sm:col-span-2" placeholder="Token description" maxLength={500} />
        <input value={image} onChange={(e) => setImage(e.target.value)} className="forge-input sm:col-span-2" placeholder="Image URL (optional)" />
        <input value={website} onChange={(e) => setWebsite(e.target.value)} className="forge-input" placeholder="Website URL (optional)" />
        <input value={twitter} onChange={(e) => setTwitter(e.target.value)} className="forge-input" placeholder="X/Twitter URL (optional)" />
        <input value={telegram} onChange={(e) => setTelegram(e.target.value)} className="forge-input" placeholder="Telegram URL (optional)" />
      </div>
      <button onClick={status === "developer_buy_ready" ? developerBuy : launch} disabled={busy || status === "complete"} className="mt-4 w-full rounded-xl bg-[#f5c542] px-5 py-3 font-bold text-black disabled:opacity-40">
        {status === "metadata" ? "Storing metadata on IPFS…" : status === "preparing" ? "Preparing…" : status === "signing" ? "Approve launch in wallet…" : status === "confirming" ? "Confirming launch…" : status === "initializing" ? "Initializing Fair Launch…" : status === "developer_buy_ready" ? "Approve developer first buy · 0.5 SOL" : status === "developer_signing" ? "Approve developer buy…" : status === "developer_confirming" ? "Confirming developer buy…" : status === "verifying" ? "Verifying Fair Launch state…" : status === "complete" ? "Fair Launch is live ✓" : "Create Fair Launch token"}
      </button>
      {mint && <p className="mt-3 break-all text-xs text-white/45">Mint: {mint}</p>}
      {metadataUri && <a className="mt-2 block break-all text-xs text-white/35" href={metadataUri} target="_blank" rel="noreferrer">Metadata: {metadataUri}</a>}
      {signature && <a className="mt-2 block break-all text-xs text-[#f5c542]" href={explorerTx(signature)} target="_blank" rel="noreferrer">View launch transaction</a>}
      {initializeSignature && <a className="mt-2 block break-all text-xs text-[#f5c542]" href={explorerTx(initializeSignature)} target="_blank" rel="noreferrer">View Fair Launch initialization</a>}
      {developerBuySignature && <a className="mt-2 block break-all text-xs text-[#f5c542]" href={explorerTx(developerBuySignature)} target="_blank" rel="noreferrer">View developer buy transaction</a>}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </div>
  );
}