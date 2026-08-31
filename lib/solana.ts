import { Connection, PublicKey } from "@solana/web3.js";

export const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
export const solanaConnection = new Connection(SOLANA_RPC, "confirmed");

export function isValidSolanaAddress(address: string) {
  try { new PublicKey(address); return true; } catch { return false; }
}

export async function getSolBalance(address: string) {
  if (!isValidSolanaAddress(address)) throw new Error("Invalid Solana address");
  const lamports = await solanaConnection.getBalance(new PublicKey(address));
  return lamports / 1_000_000_000;
}
