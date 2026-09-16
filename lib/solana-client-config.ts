export type SolanaCluster = "devnet" | "mainnet-beta";

export const SOLANA_CLUSTER: SolanaCluster =
  process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta" ? "mainnet-beta" : "devnet";

export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  (SOLANA_CLUSTER === "devnet"
    ? "https://api.devnet.solana.com"
    : "https://api.mainnet-beta.solana.com");

export const RAYDIUM_CPMM_PROGRAM_ID =
  SOLANA_CLUSTER === "devnet"
    ? "DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpY"
    : "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";

export function solanaExplorerTx(signature: string): string {
  const suffix = SOLANA_CLUSTER === "devnet" ? "?cluster=devnet" : "";
  return `https://solscan.io/tx/${signature}${suffix}`;
}
