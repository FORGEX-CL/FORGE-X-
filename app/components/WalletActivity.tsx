"use client";

import { useEffect, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet";
const FORGE_PROGRAM_ID = process.env.NEXT_PUBLIC_FORGE_X_PROGRAM_ID || "";

const EXPLORER = CLUSTER === "mainnet-beta"
  ? "https://solscan.io/tx/"
  : `https://solscan.io/tx/?cluster=${CLUSTER}&tx=`;

const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ASSOCIATED_TOKEN_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

type Wallet = { publicKey?: PublicKey | null };
type ActivityItem = {
  signature: string;
  slot: number;
  blockTime: number | null;
  confirmationStatus: string | null;
  err: unknown;
  feeLamports: number | null;
  type: string;
};

type ParsedInstruction = { programId?: string; program?: string };

function getWallet(): Wallet | undefined {
  return (window as Window & { solana?: Wallet }).solana;
}

function formatTime(timestamp: number | null) {
  if (!timestamp) return "Time unavailable";
  return new Date(timestamp * 1000).toLocaleString();
}

function classify(instructions: ParsedInstruction[]) {
  const ids = new Set(instructions.map((instruction) => instruction.programId).filter(Boolean));
  if (FORGE_PROGRAM_ID && ids.has(FORGE_PROGRAM_ID)) return "FORGE X";
  if (ids.has(TOKEN_PROGRAM)) return "Token activity";
  if (ids.has(ASSOCIATED_TOKEN_PROGRAM)) return "Token account";
  if (ids.has(SYSTEM_PROGRAM)) return "SOL transfer";
  return "Transaction";
}

export function WalletActivity() {
  const [address, setAddress] = useState("");
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(publicKey: PublicKey) {
    setLoading(true);
    setError("");
    try {
      const connection = new Connection(RPC, "confirmed");
      const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 12 }, "confirmed");
      const details = await Promise.all(signatures.map(async (item) => {
        try {
          const transaction = await connection.getTransaction(item.signature, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
            encoding: "jsonParsed",
          });
          const instructions = (transaction?.transaction.message.instructions ?? []) as ParsedInstruction[];
          return {
            signature: item.signature,
            slot: item.slot,
            blockTime: item.blockTime,
            confirmationStatus: item.confirmationStatus ?? null,
            err: item.err,
            feeLamports: transaction?.meta?.fee ?? null,
            type: classify(instructions),
          };
        } catch {
          return {
            signature: item.signature,
            slot: item.slot,
            blockTime: item.blockTime,
            confirmationStatus: item.confirmationStatus ?? null,
            err: item.err,
            feeLamports: null,
            type: "Transaction",
          };
        }
      }));
      setItems(details);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load wallet activity");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const wallet = getWallet();
    if (!wallet?.publicKey) return;
    setAddress(wallet.publicKey.toBase58());
    void load(wallet.publicKey);
  }, []);

  if (!address) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
        <p className="text-xs uppercase tracking-[.2em] text-[#f5c542]">Activity</p>
        <h2 className="mt-1 text-xl font-black">Transaction history</h2>
        <p className="mt-2 text-sm text-white/45">Connect your wallet above to load confirmed transaction history directly from Solana RPC.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[.2em] text-[#f5c542]">Activity</p>
          <h2 className="mt-1 text-xl font-black">Transaction history</h2>
          <p className="mt-1 text-sm text-white/45">Latest confirmed transactions, classified from their on-chain instructions.</p>
        </div>
        <button onClick={() => void load(new PublicKey(address))} disabled={loading} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold disabled:opacity-40">
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && <p className="mt-4 text-xs text-red-400">{error}</p>}

      {items.length === 0 && !loading ? (
        <p className="mt-5 text-sm text-white/45">No confirmed transactions found.</p>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map((item) => (
            <a key={item.signature} href={`${EXPLORER}${item.signature}`} target="_blank" rel="noreferrer" className="block rounded-xl border border-white/10 p-4 transition hover:border-white/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-mono text-xs text-white/65">{item.signature}</p>
                    <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/45">{item.type}</span>
                  </div>
                  <p className="mt-1 text-xs text-white/35">Slot {item.slot} · {formatTime(item.blockTime)}{item.feeLamports != null ? ` · Fee ${(item.feeLamports / 1_000_000_000).toFixed(6)} SOL` : ""}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs font-bold">
                  <span className={item.err ? "rounded-full bg-red-500/10 px-2 py-1 text-red-400" : "rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-400"}>{item.err ? "Failed" : item.confirmationStatus || "Confirmed"}</span>
                  <span className="text-white/35">View ↗</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
