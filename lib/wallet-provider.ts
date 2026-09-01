import type { Transaction } from "@solana/web3.js";

export type SolanaWalletProvider = {
  publicKey?: { toBase58(): string } | null;
  connect: () => Promise<{ publicKey?: { toBase58(): string } }>;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
};

export function getBrowserWallet(): SolanaWalletProvider {
  if (typeof window === "undefined") throw new Error("Wallet is only available in the browser");
  const provider = (window as Window & { solana?: SolanaWalletProvider }).solana;
  if (!provider?.connect) throw new Error("No compatible Solana wallet found");
  return provider;
}

export function assertWalletCanSign(provider: SolanaWalletProvider): asserts provider is SolanaWalletProvider & { signTransaction: (transaction: Transaction) => Promise<Transaction> } {
  if (!provider.signTransaction) {
    throw new Error("Connected wallet does not support transaction signing");
  }
}

export async function connectBrowserWallet() {
  const provider = getBrowserWallet();
  const result = await provider.connect();
  const address = result.publicKey?.toBase58() ?? provider.publicKey?.toBase58();
  if (!address) throw new Error("Wallet connected without a public key");
  return { provider, address };
}
