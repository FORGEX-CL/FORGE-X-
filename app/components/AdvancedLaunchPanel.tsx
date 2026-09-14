"use client";

import { useMemo, useState } from "react";
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

const STEPS = ["Token", "Authorities", "Liquidity", "Review"] as const;
const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet";

type Signable = Transaction | VersionedTransaction;
type Wallet = { publicKey?: { toString(): string } | null; signTransaction?: (transaction: Signable) => Promise<Signable> };
function getWallet(): Wallet | undefined { return (window as Window & { solana?: Wallet }).solana; }
function explorerTx(signature: string) { const suffix = CLUSTER === "mainnet-beta" ? "" : `?cluster=${encodeURIComponent(CLUSTER)}`; return `https://solscan.io/tx/${signature}${suffix}`; }
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function waitForConfirmation(connection: Connection, signature: string) {
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    const status = (await connection.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
    if (status?.err) throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    await sleep(500);
  }
  throw new Error("Timed out waiting for transaction confirmation");
}
function parseDecimalToUnits(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) throw new Error("Liquidity amount is invalid");
  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) throw new Error(`Amount supports at most ${decimals} decimals`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
}

export function AdvancedLaunchPanel() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [supply, setSupply] = useState("1000000000");
  const [metadataUri, setMetadataUri] = useState("");
  const [revokeMint, setRevokeMint] = useState(true);
  const [revokeFreeze, setRevokeFreeze] = useState(true);
  const [immutable, setImmutable] = useState(true);
  const [initialSol, setInitialSol] = useState("1");
  const [initialTokens, setInitialTokens] = useState("100000000");
  const [burnLp, setBurnLp] = useState(false);
  const [status, setStatus] = useState<"idle" | "preparing" | "signing" | "confirming" | "verified" | "failed">("idle");
  const [mint, setMint] = useState("");
  const [tokenSignature, setTokenSignature] = useState("");
  const [poolSignature, setPoolSignature] = useState("");
  const [poolId, setPoolId] = useState("");
  const [error, setError] = useState("");

  const canContinue = useMemo(() => {
    if (step === 0) return name.trim().length > 0 && /^[A-Za-z0-9]{1,10}$/.test(symbol) && /^[0-9]+$/.test(supply) && BigInt(supply || "0") > 0n && metadataUri.trim().length > 0;
    if (step === 1) return revokeMint && revokeFreeze && immutable;
    if (step === 2) return /^\d+(?:\.\d+)?$/.test(initialSol) && Number(initialSol) > 0 && /^[0-9]+$/.test(initialTokens) && BigInt(initialTokens || "0") > 0n;
    return true;
  }, [step, name, symbol, supply, metadataUri, revokeMint, revokeFreeze, immutable, initialSol, initialTokens]);

  async function executeTokenCreation() {
    const wallet = getWallet();
    if (!wallet?.publicKey || !wallet.signTransaction) { setError("Connect a Solana wallet first."); return; }
    setError(""); setTokenSignature(""); setPoolSignature(""); setPoolId(""); setMint(""); setStatus("preparing");
    try {
      const response = await fetch("/api/advanced-launch/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payer: wallet.publicKey.toString(), name: name.trim(), symbol: symbol.trim().toUpperCase(), supply, metadataUri: metadataUri.trim(), revokeMintAuthority: true, revokeFreezeAuthority: true, immutable: true }) });
      const data = await response.json() as { transaction?: string; mint?: string; lastValidBlockHeight?: number; error?: string };
      if (!response.ok || !data.transaction || !data.mint || typeof data.lastValidBlockHeight !== "number") throw new Error(data.error || "Unable to prepare Advanced Launch token");
      setMint(data.mint); setStatus("signing");
      const signed = await wallet.signTransaction(Transaction.from(Buffer.from(data.transaction, "base64")));
      if (!(signed instanceof Transaction)) throw new Error("Wallet returned an unexpected token transaction type");
      setStatus("confirming");
      const connection = new Connection(RPC, "confirmed");
      const txid = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 3 });
      setTokenSignature(txid);
      await waitForConfirmation(connection, txid);
      const account = await connection.getParsedAccountInfo(new PublicKey(data.mint), "confirmed");
      const parsed = account.value?.data;
      if (!parsed || !("parsed" in parsed)) throw new Error("Token confirmed but its on-chain mint account could not be parsed");
      const info = (parsed as { parsed: { info: { decimals?: number; supply?: string; mintAuthority?: string | null; freezeAuthority?: string | null } } }).parsed.info;
      const expectedSupply = (BigInt(supply) * 1_000_000_000n).toString();
      if (info.decimals !== 9 || info.supply !== expectedSupply || info.mintAuthority !== null || info.freezeAuthority !== null) throw new Error("Token transaction confirmed, but on-chain authority/supply verification failed");
      setStatus("verified");
    } catch (e) { setStatus("failed"); setError(e instanceof Error ? e.message : "Advanced Launch failed"); }
  }

  async function executePoolCreation() {
    const wallet = getWallet();
    if (!wallet?.publicKey || !wallet.signTransaction || !mint) { setError("Create and verify the token before creating its pool."); return; }
    setError(""); setStatus("preparing");
    try {
      const tokenBaseUnits = BigInt(initialTokens) * 1_000_000_000n;
      const solLamports = parseDecimalToUnits(initialSol, 9);
      const response = await fetch("/api/advanced-launch/pool/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallet: wallet.publicKey.toString(), mint, tokenBaseUnits: tokenBaseUnits.toString(), solLamports: solLamports.toString() }) });
      const data = await response.json() as { transaction?: string; poolId?: string; programId?: string; mint?: string; tokenBaseUnits?: string; solLamports?: string; error?: string };
      if (!response.ok || !data.transaction || !data.poolId || !data.programId) throw new Error(data.error || "Unable to prepare liquidity pool");
      if (data.mint !== mint || data.tokenBaseUnits !== tokenBaseUnits.toString() || data.solLamports !== solLamports.toString()) throw new Error("Pool preparation changed the requested mint or liquidity amounts");
      setPoolId(data.poolId); setStatus("signing");
      const unsigned = VersionedTransaction.deserialize(Buffer.from(data.transaction, "base64"));
      const signed = await wallet.signTransaction(unsigned);
      if (!(signed instanceof VersionedTransaction)) throw new Error("Wallet returned an unexpected pool transaction type");
      setStatus("confirming");
      const connection = new Connection(RPC, "confirmed");
      const txid = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 3 });
      setPoolSignature(txid);
      await waitForConfirmation(connection, txid);
      const poolAccount = await connection.getAccountInfo(new PublicKey(data.poolId), "confirmed");
      if (!poolAccount || !poolAccount.owner.equals(new PublicKey(data.programId))) throw new Error("Pool transaction confirmed, but the pool account owner could not be verified");
      setStatus("verified");
    } catch (e) { setStatus("failed"); setError(e instanceof Error ? e.message : "Pool creation failed"); }
  }

  const busy = status === "preparing" || status === "signing" || status === "confirming";
  const hasPool = Boolean(poolId && poolSignature);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
      <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#f5c542]">Advanced Launch</p><h3 className="mt-2 text-xl font-black">Build the launch configuration</h3><p className="mt-2 text-sm leading-6 text-white/45">Configure the token first, then review the irreversible protections and liquidity before any wallet signature.</p></div>
      <div className="grid grid-cols-4 gap-2">{STEPS.map((label, index) => <button key={label} type="button" onClick={() => index <= step && setStep(index)} className={`rounded-lg border px-2 py-2 text-xs font-bold ${index === step ? "border-[#f5c542]/50 bg-[#f5c542]/10 text-[#f5c542]" : "border-white/10 text-white/40"}`}><span className="mr-1">0{index + 1}</span>{label}</button>)}</div>
      {step === 0 && <div className="mt-5 grid gap-3 sm:grid-cols-2"><input className="forge-input" placeholder="Token name" value={name} onChange={(e) => setName(e.target.value)} maxLength={32}/><input className="forge-input" placeholder="SYMBOL" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} maxLength={10}/><input className="forge-input sm:col-span-2" placeholder="Total supply" inputMode="numeric" value={supply} onChange={(e) => setSupply(e.target.value.replace(/[^0-9]/g, ""))}/><input className="forge-input sm:col-span-2" placeholder="Metadata URI (IPFS/Arweave)" value={metadataUri} onChange={(e) => setMetadataUri(e.target.value)}/><div className="sm:col-span-2 rounded-xl border border-white/10 bg-black/10 p-4 text-xs leading-5 text-white/45">Decimals are fixed at 9. The server converts whole-token supply to SPL base units when preparing the transaction.</div></div>}
      {step === 1 && <div className="mt-5 space-y-3">{[["Revoke mint authority", revokeMint, setRevokeMint], ["Revoke freeze authority", revokeFreeze, setRevokeFreeze], ["Make metadata immutable", immutable, setImmutable]].map(([label, checked, setChecked]) => <label key={label as string} className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-black/10 p-4"><span><span className="block text-sm font-bold">{label as string}</span><span className="mt-1 block text-xs text-white/40">This becomes an irreversible on-chain state after signing.</span></span><input type="checkbox" checked={checked as boolean} onChange={(e) => (setChecked as (value: boolean) => void)(e.target.checked)} className="h-5 w-5 accent-[#f5c542]"/></label>)}<div className="rounded-xl border border-[#f5c542]/15 bg-[#f5c542]/5 p-4 text-xs leading-5 text-white/55">FORGE X currently requires all three protections. The server enforces them independently of this UI.</div></div>}
      {step === 2 && <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-xs text-white/45">Initial SOL liquidity<input className="forge-input mt-2" inputMode="decimal" value={initialSol} onChange={(e) => setInitialSol(e.target.value)}/></label><label className="text-xs text-white/45">Initial token liquidity<input className="forge-input mt-2" inputMode="numeric" value={initialTokens} onChange={(e) => setInitialTokens(e.target.value.replace(/[^0-9]/g, ""))}/></label><label className="sm:col-span-2 flex items-center justify-between rounded-xl border border-white/10 p-4"><span><span className="block text-sm font-bold">Burn LP position</span><span className="mt-1 block text-xs text-white/40">Requested for the later verified LP-burn transaction.</span></span><input type="checkbox" checked={burnLp} onChange={(e) => setBurnLp(e.target.checked)} className="h-5 w-5 accent-[#f5c542]"/></label><div className="sm:col-span-2 rounded-xl border border-white/10 p-4 text-xs leading-5 text-white/45">The pool transaction is prepared and simulated server-side, then signed by your wallet. The pool is not considered created until its account is verified on-chain.</div></div>}
      {step === 3 && <div className="mt-5 space-y-3"><div className="rounded-xl border border-white/10 p-4"><p className="text-xs uppercase tracking-[.18em] text-white/35">Token</p><p className="mt-2 font-bold">{name || "Unnamed token"} · {symbol || "—"}</p><p className="mt-1 text-sm text-white/45">{supply || "0"} tokens · 9 decimals</p></div><div className="rounded-xl border border-white/10 p-4"><p className="text-xs uppercase tracking-[.18em] text-white/35">Safety</p><p className="mt-2 text-sm text-white/65">Mint revoked · Freeze revoked · Metadata immutable</p></div><div className="rounded-xl border border-white/10 p-4"><p className="text-xs uppercase tracking-[.18em] text-white/35">Liquidity</p><p className="mt-2 text-sm text-white/65">{initialSol} SOL + {initialTokens} tokens {burnLp ? "· LP burn requested" : "· LP remains active"}</p></div><div className="rounded-xl border border-[#f5c542]/15 bg-[#f5c542]/5 p-4 text-xs leading-5 text-white/55">{hasPool ? "Token and Raydium CPMM pool are both verified on-chain." : status === "verified" ? "Token is verified. The next action creates and verifies the Raydium CPMM pool." : "Token creation and pool creation are separate signed transactions; neither is reported as verified until chain state confirms it."}</div></div>}
      {error && <p className="mt-4 text-xs text-red-400">{error}</p>}
      {mint && <p className="mt-3 break-all text-xs text-white/45">Mint: {mint}</p>}
      {tokenSignature && <a className="mt-2 block break-all text-xs text-[#f5c542]" href={explorerTx(tokenSignature)} target="_blank" rel="noreferrer">View token transaction</a>}
      {poolId && <p className="mt-2 break-all text-xs text-white/45">Pool: {poolId}</p>}
      {poolSignature && <a className="mt-2 block break-all text-xs text-[#f5c542]" href={explorerTx(poolSignature)} target="_blank" rel="noreferrer">View pool transaction</a>}
      <div className="mt-5 flex gap-3"><button type="button" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0 || busy} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold disabled:opacity-30">Back</button>{step < STEPS.length - 1 ? <button type="button" onClick={() => setStep(step + 1)} disabled={!canContinue || busy} className="flex-1 rounded-xl bg-[#f5c542] px-5 py-3 text-sm font-bold text-black disabled:opacity-30">Continue</button> : <button type="button" onClick={status === "verified" && !hasPool ? executePoolCreation : executeTokenCreation} disabled={busy || hasPool} className="flex-1 rounded-xl bg-[#f5c542] px-5 py-3 text-sm font-bold text-black disabled:opacity-30">{status === "preparing" ? "Preparing…" : status === "signing" ? "Approve in wallet…" : status === "confirming" ? "Confirming on-chain…" : hasPool ? "Launch verified ✓" : status === "verified" ? "Create & verify pool" : "Create & verify token"}</button>}</div>
    </div>
  );
}
