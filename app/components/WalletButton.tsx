"use client";

import { useEffect, useState } from "react";
import { connectWallet, disconnectBrowserWallet, listSolanaWallets, restoreWalletConnection, type StandardWallet } from "../../lib/wallet-provider";

function shortAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 5)}…${address.slice(-4)}` : address;
}

function walletType(wallet: StandardWallet) {
  const name = wallet.name.toLowerCase();
  return name.includes("mobile") || name.includes("mwa") ? "Mobile" : "Desktop";
}

export function WalletButton() {
  const [status, setStatus] = useState<"idle" | "connecting" | "connected">("idle");
  const [address, setAddress] = useState("");
  const [wallets, setWallets] = useState<StandardWallet[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [selectedWallet, setSelectedWallet] = useState("");

  useEffect(() => {
    let cancelled = false;
    void listSolanaWallets().then((items) => {
      if (!cancelled) setWallets(items);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  async function connect(wallet: StandardWallet) {
    setError("");
    setStatus("connecting");
    try {
      const provider = await connectWallet(wallet);
      const nextAddress = provider.publicKey?.toBase58() ?? "";
      if (!nextAddress) throw new Error("Wallet did not return an address");
      setAddress(nextAddress);
      setSelectedWallet(wallet.name);
      setStatus("connected");
      setOpen(false);
    } catch (e) {
      setStatus("idle");
      setError(e instanceof Error ? e.message : "Wallet connection failed");
    }
  }

  async function disconnect() {
    try {
      await disconnectBrowserWallet();
    } finally {
      setAddress("");
      setSelectedWallet("");
      setStatus("idle");
      setOpen(false);
    }
  }

  const desktop = wallets.filter((w) => walletType(w) === "Desktop");
  const mobile = wallets.filter((w) => walletType(w) === "Mobile");

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full border border-violet-400/30 bg-violet-500/10 px-4 py-2 text-sm font-bold text-white transition hover:border-violet-300/60 hover:bg-violet-500/20"
      >
        {status === "connected" ? shortAddress(address) : "Connect Wallet"}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(94vw,390px)] max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#10121a] p-3 shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between px-2 py-2">
            <div>
              <p className="text-sm font-black text-white">{status === "connected" ? "Wallet connected" : "Connect a wallet"}</p>
              <p className="mt-1 text-xs text-white/45">{status === "connected" ? `${selectedWallet} · ${shortAddress(address)}` : "Choose a desktop or mobile Solana wallet."}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-white/40 hover:bg-white/5">✕</button>
          </div>

          {status === "connected" ? (
            <div className="mt-2 space-y-2">
              <div className="rounded-xl border border-violet-400/20 bg-violet-400/5 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-violet-300">Connected</p>
                <p className="mt-1 break-all text-sm text-white/80">{address}</p>
              </div>
              <button type="button" onClick={() => void disconnect()} className="w-full rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm font-bold text-red-200 hover:bg-red-400/10">
                Disconnect
              </button>
            </div>
          ) : (
            <div className="mt-2 space-y-4">
              <WalletGroup title="Desktop wallets" wallets={desktop} onConnect={connect} empty="No desktop wallet detected. Install a Solana wallet extension." />
              <WalletGroup title="Mobile wallets" wallets={mobile} onConnect={connect} empty="Mobile Wallet Adapter will appear when a compatible wallet is available." />
            </div>
          )}

          {error && <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-xs leading-5 text-red-300">{error}</p>}
        </div>
      )}
    </div>
  );
}

function WalletGroup({ title, wallets, onConnect, empty }: { title: string; wallets: StandardWallet[]; onConnect: (wallet: StandardWallet) => void; empty: string }) {
  return (
    <section>
      <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-[.16em] text-white/35">{title}</p>
      <div className="space-y-2">
        {wallets.map((wallet) => (
          <button key={wallet.name} type="button" onClick={() => onConnect(wallet)} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3 text-left transition hover:border-violet-400/50 hover:bg-violet-400/[.07]">
            {wallet.icon ? <img src={wallet.icon} alt="" className="h-9 w-9 shrink-0 rounded-xl bg-white/10 object-cover" /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-200">W</span>}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-white">{wallet.name}</span>
              <span className="mt-1 block text-xs text-white/35">Solana wallet</span>
            </span>
            <span className="text-white/30">→</span>
          </button>
        ))}
        {wallets.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-3 text-xs leading-5 text-white/35">{empty}</p>}
      </div>
    </section>
  );
}
