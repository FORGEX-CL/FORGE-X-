"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { WSOL } from "@/lib/raydium-cpmm-swap-builder";

const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta" ? "mainnet-beta" : "devnet";
const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || (CLUSTER === "devnet" ? "https://api.devnet.solana.com" : "");
const MAINNET_CPMM_PROGRAM = "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";
const DEVNET_CPMM_PROGRAM = "DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb";
const EXPECTED_CPMM_PROGRAM = CLUSTER === "devnet" ? DEVNET_CPMM_PROGRAM : MAINNET_CPMM_PROGRAM;
const POLL_MS = 1_000;

type MintInfo = { address: string; symbol?: string; decimals: number };
type PoolResponse = { pools?: Array<{ poolId: string; programId?: string; mintA?: string; mintB?: string; symbolA?: string; symbolB?: string; decimalsA?: number; decimalsB?: number }>; error?: string };
type PreparedSwap = { transaction: string; recentBlockhash: string; lastValidBlockHeight: number; poolId: string; inputMint: string; outputMint: string; programId: string; quote: { outputAmount: string; minimumOutputAmount: string; tradeFee: string } };

function decodeBase64(value: string): Uint8Array {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForSignature(connection: Connection, signature: string, lastValidBlockHeight: number): Promise<void> {
  for (;;) {
    const status = (await connection.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
    if (status?.err) throw new Error(`Swap failed on-chain: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    const blockHeight = await connection.getBlockHeight("confirmed");
    if (blockHeight > lastValidBlockHeight) throw new Error("Swap transaction expired before confirmation");
    await sleep(POLL_MS);
  }
}

export function RaydiumCpmmTrader() {
  const searchParams = useSearchParams();
  const queryPool = searchParams.get("pool") || "";
  const queryInputMint = searchParams.get("inputMint") || WSOL;
  const [poolId, setPoolId] = useState(queryPool);
  const [mints, setMints] = useState<MintInfo[]>([]);
  const [inputMint, setInputMint] = useState(queryInputMint);
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [quote, setQuote] = useState<{ outputAmount: string; minimumOutputAmount: string; tradeFee: string; outputMint: string } | null>(null);
  const [status, setStatus] = useState("idle");
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");
  const [loadingPool, setLoadingPool] = useState(false);

  const input = mints.find((mint) => mint.address === inputMint);
  const output = mints.find((mint) => mint.address !== inputMint);

  useEffect(() => {
    if (!poolId.trim()) return;
    const timer = setTimeout(async () => {
      setLoadingPool(true); setError("");
      try {
        const response = await fetch(`/api/pools/lookup?poolId=${encodeURIComponent(poolId.trim())}`);
        const data = await response.json() as PoolResponse;
        if (!response.ok || !data.pools?.[0]) throw new Error(data.error || "Unable to verify pool");
        const pool = data.pools[0];
        const nextMints: MintInfo[] = [
          { address: pool.mintA || "", symbol: pool.symbolA, decimals: pool.decimalsA ?? 9 },
          { address: pool.mintB || "", symbol: pool.symbolB, decimals: pool.decimalsB ?? 9 },
        ].filter((mint) => mint.address);
        if (pool.programId && pool.programId !== EXPECTED_CPMM_PROGRAM) throw new Error("Selected pool is not the expected Raydium CPMM program");
        if (!nextMints.length) throw new Error("Selected pool did not return token mints");
        setMints(nextMints);
        if (!nextMints.some((mint) => mint.address === inputMint)) setInputMint(nextMints[0].address);
      } catch (poolError) {
        setMints([]);
        setError(poolError instanceof Error ? poolError.message : "Unable to verify pool");
      } finally {
        setLoadingPool(false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [poolId, inputMint]);

  async function prepareSwap(): Promise<PreparedSwap> {
    if (!poolId.trim() || !inputMint.trim()) throw new Error("Pool and input mint are required");
    const numericAmount = Number(amount);
    const numericSlippage = Number(slippage);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error("Enter a valid trade amount");
    if (!Number.isFinite(numericSlippage) || numericSlippage < 0.01 || numericSlippage > 5) throw new Error("Slippage must be between 0.01% and 5%");
    const response = await fetch("/api/raydium/swap/prepare", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ trader: window.localStorage.getItem("forge-x-wallet") || undefined, poolId: poolId.trim(), inputMint, amount: amount.trim(), slippageBps: Math.round(numericSlippage * 100) }) });
    const data = await response.json() as PreparedSwap & { error?: string };
    if (!response.ok) throw new Error(data.error || "Unable to prepare Raydium swap");
    if (data.poolId !== poolId.trim() || data.inputMint !== inputMint || data.programId !== EXPECTED_CPMM_PROGRAM) throw new Error("Prepared swap route failed FORGE X security validation");
    return data;
  }

  async function executeSwap() {
    try {
      setStatus("preparing"); setError(""); setSignature("");
      const wallet = window.localStorage.getItem("forge-x-wallet");
      if (!wallet) throw new Error("Connect a wallet before swapping");
      if (!RPC) throw new Error("Public Solana RPC is not configured for mainnet swaps");
      const trader = new PublicKey(wallet);
      const connection = new Connection(RPC, "confirmed");
      const prepared = await prepareSwap();
      if (prepared.programId !== EXPECTED_CPMM_PROGRAM) throw new Error("Prepared swap uses an unexpected CPMM program");
      const transactionBytes = decodeBase64(prepared.transaction);
      const transaction = transactionBytes.length && transactionBytes[0] === 1 ? VersionedTransaction.deserialize(transactionBytes) : Transaction.from(transactionBytes);
      if (transaction instanceof Transaction) {
        if (transaction.recentBlockhash !== prepared.recentBlockhash) throw new Error("Prepared swap blockhash validation failed");
        if (transaction.feePayer?.toBase58() !== trader.toBase58()) throw new Error("Prepared swap payer does not match connected wallet");
      } else if (transaction.message.recentBlockhash !== prepared.recentBlockhash) {
        throw new Error("Prepared swap blockhash validation failed");
      }
      if (transaction instanceof VersionedTransaction) {
        const payer = transaction.message.staticAccountKeys[0]?.toBase58();
        if (payer !== trader.toBase58()) throw new Error("Prepared swap payer does not match connected wallet");
        if (!transaction.message.compiledInstructions.some((ix) => transaction.message.staticAccountKeys[ix.programIdIndex]?.toBase58() === EXPECTED_CPMM_PROGRAM)) throw new Error("Prepared transaction does not call the expected Raydium CPMM program");
      } else if (!transaction.instructions.some((ix) => ix.programId.toBase58() === EXPECTED_CPMM_PROGRAM)) {
        throw new Error("Prepared transaction does not call the expected Raydium CPMM program");
      }
      const beforeHeight = await connection.getBlockHeight("confirmed");
      if (beforeHeight > prepared.lastValidBlockHeight) throw new Error("Prepared swap transaction expired before signing");
      setStatus("signing");
      const provider = (window as unknown as { solana?: { publicKey?: PublicKey; signTransaction?: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction> } }).solana;
      if (!provider?.signTransaction) throw new Error("Connected wallet does not expose signTransaction");
      const signed = await provider.signTransaction(transaction);
      const afterHeight = await connection.getBlockHeight("confirmed");
      if (afterHeight > prepared.lastValidBlockHeight) throw new Error("Prepared swap expired while waiting for wallet signature");
      setStatus("sending");
      const raw = signed.serialize();
      const sig = await connection.sendRawTransaction(raw, { skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 5 });
      setSignature(sig); setStatus("confirming");
      await waitForSignature(connection, sig, prepared.lastValidBlockHeight);
      setStatus("confirmed");
    } catch (swapError) {
      setStatus("error"); setError(swapError instanceof Error ? swapError.message : "Swap failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm"><span className="text-white/60">Pool ID</span><input className="w-full rounded-xl border border-white/10 bg-white/5 p-3" value={poolId} onChange={(event) => setPoolId(event.target.value)} placeholder="Raydium CPMM pool" /></label>
        <label className="space-y-1 text-sm"><span className="text-white/60">Input mint</span><input className="w-full rounded-xl border border-white/10 bg-white/5 p-3" value={inputMint} onChange={(event) => setInputMint(event.target.value)} placeholder="Mint address" /></label>
        <label className="space-y-1 text-sm"><span className="text-white/60">Amount</span><input className="w-full rounded-xl border border-white/10 bg-white/5 p-3" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.0" /></label>
        <label className="space-y-1 text-sm"><span className="text-white/60">Slippage %</span><input className="w-full rounded-xl border border-white/10 bg-white/5 p-3" value={slippage} onChange={(event) => setSlippage(event.target.value)} placeholder="0.5" /></label>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
        {loadingPool ? "Verifying Raydium CPMM pool…" : input && output ? `${input.symbol || input.address.slice(0, 8)} → ${output.symbol || output.address.slice(0, 8)}` : "Select a verified Raydium CPMM pool."}
      </div>
      {quote && <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">Quote: {quote.outputAmount} · Minimum: {quote.minimumOutputAmount} · Fee: {quote.tradeFee}</div>}
      {error && <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}
      <button type="button" onClick={() => void executeSwap()} disabled={loadingPool || status === "preparing" || status === "signing" || status === "sending" || status === "confirming"} className="rounded-xl bg-white px-5 py-3 font-semibold text-black disabled:opacity-50">{status === "confirming" ? "Confirming…" : status === "signing" ? "Sign in wallet…" : status === "sending" ? "Sending…" : "Swap"}</button>
      {signature && <a className="block text-sm underline" href={`https://solscan.io/tx/${signature}${CLUSTER === "devnet" ? "?cluster=devnet" : ""}`} target="_blank" rel="noreferrer">View transaction</a>}
    </div>
  );
}
