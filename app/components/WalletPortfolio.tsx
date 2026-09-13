"use client";

import { useEffect, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet";

type Wallet = {
  publicKey?: PublicKey | null;
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
};

type TokenPosition = { mint: string; amount: string; decimals: number };

function getWallet(): Wallet | undefined {
  return (window as Window & { solana?: Wallet }).solana;
}

export function WalletPortfolio() {
  const [address, setAddress] = useState("");
  const [sol, setSol] = useState(0);
  const [tokens, setTokens] = useState<TokenPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(publicKey: PublicKey) {
    setLoading(true);
    setError("");
    try {
      const connection = new Connection(RPC, "confirmed");
      const [balance, accounts] = await Promise.all([
        connection.getBalance(publicKey, "confirmed"),
        connection.getParsedTokenAccountsByOwner(publicKey, { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") }, "confirmed"),
      ]);
      setSol(balance / 1_000_000_000);
      const positions = accounts.value.map(({ account }) => {
        const info = account.data.parsed.info;
        return { mint: info.mint as string, amount: info.tokenAmount.uiAmountString as string, decimals: info.tokenAmount.decimals as number };
      }).filter((position) => position.amount !== "0");
      setTokens(positions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load wallet balances");
    } finally {
      setLoading(false);
    }
  }

  async function connect() {
    const wallet = getWallet();
    if (!wallet?.connect) { setError("No compatible browser Solana wallet was detected."); return; }
    setError("");
    try {
      await wallet.connect();
      if (wallet.publicKey) {
        const key = wallet.publicKey.toBase58();
        setAddress(key);
        await load(wallet.publicKey);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Wallet connection failed"); }
  }

  useEffect(() => {
    const wallet = getWallet();
    if (!wallet?.publicKey) return;
    setAddress(wallet.publicKey.toBase58());
    void load(wallet.publicKey);
  }, []);

  return (
    <div className="space-y-5">
      {!address ? (
        <div className="rounded-2xl border border-white/10 bg-white/[.025] p-8 text-center">
          <div className="text-5xl">◎</div>
          <h2 className="mt-4 text-xl font-bold">Connect your Solana wallet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/45">FORGE X reads balances directly from Solana RPC. No private keys are requested or stored.</p>
          <button onClick={connect} className="mt-5 rounded-full bg-[#f5c542] px-6 py-3 font-bold text-black">Connect Wallet</button>
          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs uppercase tracking-[.2em] text-[#f5c542]">Connected wallet</p><p className="mt-2 break-all font-mono text-sm text-white/70">{address}</p></div>
            <button onClick={() => void load(new PublicKey(address))} disabled={loading} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold disabled:opacity-40">{loading ? "Refreshing…" : "Refresh"}</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><div className="text-sm text-white/40">SOL balance</div><div className="mt-2 text-3xl font-black">{sol.toFixed(4)} SOL</div></div>
            <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><div className="text-sm text-white/40">Token positions</div><div className="mt-2 text-3xl font-black">{tokens.length}</div></div>
            <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><div className="text-sm text-white/40">Network</div><div className="mt-2 text-3xl font-black">{CLUSTER}</div></div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5">
            <div className="mb-4"><p className="text-xs uppercase tracking-[.2em] text-[#f5c542]">Token positions</p><h2 className="mt-1 text-xl font-black">On-chain balances</h2></div>
            {tokens.length === 0 ? <p className="text-sm text-white/45">No non-zero SPL Token positions found.</p> : <div className="space-y-3">{tokens.map((token) => <div key={token.mint} className="rounded-xl border border-white/10 p-4"><div className="flex items-center justify-between gap-4"><span className="font-mono text-xs text-white/50">{token.mint}</span><span className="font-bold">{token.amount}</span></div></div>)}</div>}
          </div>
        </>
      )}
      {error && address && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
