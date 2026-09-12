import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { assertWalletCanSign, type SolanaWalletProvider } from "./wallet-provider";

export type SignableTransaction = Transaction | VersionedTransaction;

const POLL_MS = 500;
const TIMEOUT_MS = 90_000;

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForSignature(connection: Connection, signature: string): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < TIMEOUT_MS) {
    const status = (await connection.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
    if (status?.err) throw new Error(`Solana transaction failed: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    await sleep(POLL_MS);
  }
  throw new Error("Timed out waiting for Solana transaction confirmation");
}

export async function signAndConfirmDevnetTransaction(
  provider: SolanaWalletProvider,
  connection: Connection,
  transaction: SignableTransaction,
) {
  assertWalletCanSign(provider);

  const latest = await connection.getLatestBlockhash("confirmed");
  if (transaction instanceof Transaction) {
    transaction.recentBlockhash = latest.blockhash;
    transaction.lastValidBlockHeight = latest.lastValidBlockHeight;
    transaction.feePayer = transaction.feePayer ?? new PublicKey(provider.publicKey!.toBase58());
  }

  const signed = await provider.signTransaction(transaction as Transaction);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
    maxRetries: 3,
  });

  await waitForSignature(connection, signature);
  return { signature };
}
