export type ForgeSolanaCluster = "devnet" | "mainnet-beta";

export const FORGE_SOLANA_CLUSTER: ForgeSolanaCluster =
  process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta" ? "mainnet-beta" : "devnet";

export const FORGE_SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  (FORGE_SOLANA_CLUSTER === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com");

export const FORGE_RAYDIUM_CPMM_PROGRAM_ID =
  FORGE_SOLANA_CLUSTER === "mainnet-beta"
    ? "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"
    : "DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpY";

export function solscanTxUrl(signature: string): string {
  const suffix =
    FORGE_SOLANA_CLUSTER === "mainnet-beta"
      ? ""
      : `?cluster=${encodeURIComponent(FORGE_SOLANA_CLUSTER)}`;
  return `https://solscan.io/tx/${signature}${suffix}`;
}
