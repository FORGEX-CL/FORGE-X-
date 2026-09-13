"use client";

import { useEffect, useState } from "react";
import { Connection, VersionedTransaction } from "@solana/web3.js";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const WSOL = "So11111111111111111111111111111111111111112";
const POLL_MS = 500;
const TIMEOUT_MS = 90_000;

type MintInfo = { address: string; symbol: string | null; decimals: number | null };
type PoolResponse = { pools?: Array<{ id: string; mintA: string | null; mintB: string | null; symbolA: string | null; symbolB: string | null; decimalsA: number | null; decimalsB: number | null; price: number | null }>; error?: string };
type Wallet = { publicKey?: { toString(): string } | null; signTransaction?: (tx: VersionedTransaction) => Promise<VersionedTransaction> };

type PreparedSwap = { transaction?: string; recentBlockhash?: string; outputAmount?: string; minimumOutputAmount?: string; tradeFee?: string; outputMint?: string; error?: string };

function wallet(): Wallet { return (window as Window & { solana?: Wallet }).solana || {}; }
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function parseUnits(value: string, decimals: number): bigint {
  const normalized = value.trim();
  if (!/^\d*(\.\d*)?$/.test(normalized) || !normalized) throw new Error("Enter a valid amount");
  const [whole = "0", fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) throw new Error(`Maximum ${decimals} decimals`);
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
}
function formatUnits(value: string | bigint, decimals: number): string {
  const raw = BigInt(value.toString());
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const fraction = (raw % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction.slice(0, 6)}` : whole.toString();
}

export function RaydiumCpmmTrader() {
  const [poolId, setPoolId] = useState("");
  const [pool, setPool] = useState<PoolResponse["pools"][number] | null>(null);
  const [mint, setMint] = useState<MintInfo | null>(null);
  const [inputMint, setInputMint] = useState("");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [status, setStatus] = useState("Loading verified pool...");
  const [busy, setBusy] = useState(false);
  const [signature, setSignature] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("pool") || "";
    const requestedMint = params.get("inputMint") || "";
    setPoolId(id);
    setInputMint(requestedMint);
    if (!id) {
      setStatus("Select a verified migrated pool first.");
      return;
    }
    void (async () => {
      try {
        const response = await fetch(`/api/pools/lookup?poolId=${encodeURIComponent(id)}`, { cache: "no-store" });
        const data = (await response.json()) as PoolResponse;
        if (!response.ok || !data.pools?.[0]) throw new Error(data.error || "Verified pool lookup failed");
        const found = data.pools[0];
        setPool(found);
        const selected = requestedMint || found.mintA || found.mintB || "";
        setInputMint(selected);
        const decimals = selected === found.mintA ? found.decimalsA : found.decimalsB;
        setMint({ address: selected, symbol: selected === found.mintA ? found.symbolA : found.symbolB, decimals });
        setStatus("Verified Raydium CPMM pool.");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Pool lookup failed");
      }
    })();
  }, []);

  function flipMint() {
    if (!pool) return;
    const next = inputMint === pool.mintA ? pool.mintB : pool.mintA;
    if (!next) return;
    setInputMint(next);
    setMint({ address: next, symbol: next === pool.mintA ? pool.symbolA : pool.symbolB, decimals: next === pool.mintA ? pool.decimalsA : pool.decimalsB });
    setAmount("");
  }

  async function swap() {
    if (!poolId || !mint?.decimals || !inputMint) return;
    const currentWallet = wallet();
    const trader = currentWallet.publicKey?.toString();
    if (!trader || !currentWallet.signTransaction) {
      setStatus("Connect a wallet that supports transaction signing.");
      return;
    }
    setBusy(true);
    setSignature("");
    try {
      const inputAmount = parseUnits(amount, mint.decimals);
      const slip = Number(slippage) / 100;
      if (!Number.isFinite(slip) || slip < 0.0001 || slip > 1) throw new Error("Slippage must be between 0.01% and 100%");
      setStatus("Preparing verified Raydium swap...");
      const preparedResponse = await fetch("/api/raydium/swap/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trader, poolId, inputMint, amount: inputAmount.toString(), slippage: slip }),
      });
      const prepared = (await preparedResponse.json()) as PreparedSwap;
      if (!preparedResponse.ok || !prepared.transaction || !prepared.recentBlockhash) throw new Error(prepared.error || "Swap preparation failed");
      const connection = new Connection(RPC, "confirmed");
      const valid = await connection.isBlockhashValid(prepared.recentBlockhash, "confirmed");
      if (!valid.value) throw new Error("Prepared transaction blockhash expired; please retry");
      const signed = await currentWallet.signTransaction(VersionedTransaction.deserialize(Buffer.from(prepared.transaction, "base64")));
      setStatus("Submitting transaction...");
      const tx = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
      setSignature(tx);
      const started = Date.now();
      while (Date.now() - started < TIMEOUT_MS) {
        const result = await connection.getSignatureStatuses([tx], { searchTransactionHistory: true });
        const confirmation = result.value[0];
        if (confirmation?.err) throw new Error(`Transaction failed: ${JSON.stringify(confirmation.err)}`);
        if (confirmation?.confirmationStatus === "confirmed" || confirmation?.confirmationStatus === "finalized") {
          setStatus(`Swap confirmed. Received about ${prepared.outputAmount ? formatUnits(prepared.outputAmount, mint.decimals) : "the quoted output"}.`);
          return;
        }
        await sleep(POLL_MS);
      }
      throw new Error("Transaction confirmation timed out; check the signature on Solana before retrying");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Swap failed");
    } finally {
      setBusy(false);
    }
  }

  const inputSymbol = mint?.symbol || (inputMint === WSOL ? "SOL" : "TOKEN");
  const outputMint = pool ? (inputMint === pool.mintA ? pool.mintB : pool.mintA) : null;
  const outputSymbol = pool ? (inputMint === pool.mintA ? pool.symbolB : pool.symbolA) : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#f5c542]">Raydium CPMM</p>
          <h2 className="mt-2 text-xl font-black">Verified swap</h2>
        </div>
        <span className="rounded-full border border-[#f5c542]/20 px-3 py-1 text-xs text-white/55">On-chain verified</span>
      </div>
      <p className="mt-4 text-sm text-white/50">{status}</p>
      {pool && mint ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/40">You pay</div>
            <div className="mt-2 flex gap-3">
              <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" inputMode="decimal" className="min-w-0 flex-1 bg-transparent text-2xl font-bold outline-none" />
              <button type="button" onClick={flipMint} className="rounded-lg border border-white/10 px-3 text-sm font-bold">{inputSymbol} ↕</button>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
            <div className="flex justify-between"><span>Pool</span><span className="font-mono text-xs">{poolId.slice(0, 6)}…{poolId.slice(-6)}</span></div>
            <div className="mt-2 flex justify-between"><span>Receive</span><span>{outputSymbol || outputMint?.slice(0, 8) || "—"}</span></div>
            <label className="mt-3 flex items-center justify-between gap-3"><span>Slippage</span><input value={slippage} onChange={(event) => setSlippage(event.target.value)} className="w-20 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-right text-white outline-none" />%</label>
          </div>
          <button type="button" disabled={busy || !amount} onClick={() => void swap()} className="w-full rounded-xl bg-[#f5c542] px-4 py-3 font-black text-black disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Processing…" : `Swap ${inputSymbol} → ${outputSymbol || "token"}`}</button>
          {signature ? <a className="block truncate text-xs text-[#f5c542]" href={`https://explorer.solana.com/tx/${signature}?cluster=${process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta" ? "mainnet-beta" : "devnet"}`} target="_blank" rel="noreferrer">{signature}</a> : null}
        </div>
      ) : null}
    </div>
  );
}
