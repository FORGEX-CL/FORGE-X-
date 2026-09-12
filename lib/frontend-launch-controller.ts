import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import type { SolanaWalletProvider } from "./wallet-provider";

export type FrontendChainState = {
  status: "idle" | "preparing" | "awaiting_signature" | "confirming" | "confirmed" | "failed";
  signature?: string;
  error?: string;
};

const POLL_MS = 500;
const TIMEOUT_MS = 90_000;

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

export function chainState(status: FrontendChainState["status"], extra: Omit<FrontendChainState, "status"> = {}): FrontendChainState {
  return { status, ...extra };
}

async function waitForSignature(connection: Connection, signature: string, lastValidBlockHeight: number): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < TIMEOUT_MS) {
    const status = (await connection.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
    if (status?.err) throw new Error(`Solana transaction failed: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    const blockHeight = await connection.getBlockHeight("confirmed");
    if (blockHeight > lastValidBlockHeight) throw new Error("Solana transaction expired before confirmation");
    await sleep(POLL_MS);
  }
  throw new Error("Timed out waiting for Solana transaction confirmation");
}

export async function signAndConfirmFrontendTransaction(
  wallet: SolanaWalletProvider & { publicKey: { toBase58(): string }; signTransaction: (transaction: Transaction) => Promise<Transaction> },
  connection: Connection,
  transaction: Transaction,
  onState: (state: FrontendChainState) => void = () => undefined,
): Promise<FrontendChainState> {
  try {
    onState(chainState("preparing"));
    const latest = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = latest.blockhash;
    transaction.lastValidBlockHeight = latest.lastValidBlockHeight;
    transaction.feePayer = transaction.feePayer ?? new PublicKey(wallet.publicKey.toBase58());

    const simulation = await connection.simulateTransaction(transaction, { sigVerify: false });
    if (simulation.value.err) {
      return chainState("failed", { error: JSON.stringify(simulation.value.err) });
    }

    onState(chainState("awaiting_signature"));
    const signed = await wallet.signTransaction(transaction);
    onState(chainState("confirming"));
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 3,
    });
    await waitForSignature(connection, signature, latest.lastValidBlockHeight);
    const result = chainState("confirmed", { signature });
    onState(result);
    return result;
  } catch (error) {
    const result = chainState("failed", { error: error instanceof Error ? error.message : "Transaction failed" });
    onState(result);
    return result;
  }
}
