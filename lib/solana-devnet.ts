import { Connection, PublicKey } from "@solana/web3.js";

/**
 * Fair Launch transaction helpers are Devnet-only until the FORGE X on-chain
 * launch program is deployed and audited.
 */
export const FORGE_X_DEVNET_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
export const forgeXDevnetConnection = new Connection(FORGE_X_DEVNET_RPC, "confirmed");

export function toPublicKey(address: string): PublicKey {
  try {
    return new PublicKey(address);
  } catch {
    throw new Error("Invalid Solana wallet address");
  }
}

export async function getLatestDevnetBlockhash() {
  return forgeXDevnetConnection.getLatestBlockhash("confirmed");
}

export async function confirmDevnetSignature(signature: string) {
  const status = await forgeXDevnetConnection.getSignatureStatus(signature);
  return status.value?.confirmationStatus ?? null;
}
