"use client";

import { useEffect, useState } from "react";
import { connectWallet, listSolanaWallets, type StandardWallet } from "../../lib/wallet-provider";

function shortAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 5)}…${address.slice(-4)}` : address;
}

export function WalletButton() {
  const [status, setStatus] = useState<"idle" | "connecting" | "connected">("idle");
  const [address, setAddress] = useState("");
  const [wallets, setWallets] = useState<StandardWallet[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void listSolanaWallets().then((items) => {
      if (!cancelled) setWallets(items);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  async function connect(wallet?: StandardWallet) {
    setError("");
    setStatus("connecting");
    try {
      const provider = await connectWallet(wallet);
      const nextAddress = provider.publicKey?.toBase58() ?? "";
      if (!nextAddress) throw new Error("Wallet did not return an address");
      setAddress(nextAddress);
      setStatus("connected");
      setOpen(false);
    } catch (e) {
      setStatus("idle");
      setError(e instanceof Error ? e.message : "Wallet connection failed");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => status === "connected" ? setOpen((value) => !value) : setOpen(true)}
        className="rounded-full border border-white/10 bg-white/[.06] px-4 py-2 text-sm font-bold text-white transition hover:bg-white/[.1]"
      >
        {status === "connected" ? shortAddress(address) : "Connect Wallet"}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(92vw,360px)] rounded-2xl border border-white/10 bg-[#11121a] p-3 shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between px-2 py-2">
            <div>
              <p className="text-sm font-black text-white">Connect a wallet</p>
              <p className="mt-1 text-xs text-white/40">Desktop wallets and mobile Solana wallets are supported.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-white/40 hover:bg-white/5">✕</button>
          </div>

          <div className="mt-2 space-y-2">
            {wallets.map((wallet) => (
              <button
                key={wallet.name}
                type="button"
                onClick={() => void connect(wallet)}
                disabled={status === "connecting"}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3 text-left transition hover:border-violet-400/40 hover:bg-violet-400/[.06] disabled:opacity-50"
              >
                <img src={wallet.icon} alt="" className="h-9 w-9 rounded-xl bg-white/10 object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-white">{wallet.name}</span>
                  <span className="mt-1 block text-xs text-white/35">{wallet.name.toLowerCase().includes("mobile") ? "Mobile wallet" : "Solana wallet"}</span>
                </span>
                <span className="text-white/30">→</span>
              </button>
            ))}
            {wallets.length === 0 && (
              <button type="button" onClick={() => void connect()} disabled={status === "connecting"} className="w-full rounded-xl border border-white/10 bg-white/[.03] p-3 text-sm font-bold text-white/70">
                {status === "connecting" ? "Connecting…" : "Detect wallet"}
              </button>
            )}
          </div>

          {error && <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-xs leading-5 text-red-300">{error}</p>}
          {status === "connected" && <p className="mt-3 rounded-xl border border-violet-400/20 bg-violet-400/5 p-3 text-xs text-violet-200">Connected: {shortAddress(address)}</p>}
        </div>
      )}
    </div>
  );
}
