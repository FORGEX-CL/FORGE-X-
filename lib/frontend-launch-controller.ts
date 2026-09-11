import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { chainState, FrontendChainState } from "./frontend-chain-status";

export type WalletSigner = {
  publicKey: PublicKey | null;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
};

const CONFIRM_POLL_MS = 500;
const CONFIRM_TIMEOUT_MS = 90_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSignature(
  connection: Connection,
  signature: string,
  lastValidBlockHeight: number,
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < CONFIRM_TIMEOUT_MS) {
    const [statusResponse, currentBlockHeight] = await Promise.all([
      connection.getSignatureStatuses([signature], { searchTransactionHistory: true }),
      connection.getBlockHeight("confirmed"),
    ]);

    const status = statusResponse.value[0];

    if (status?.err) {
      throw new Error(JSON.stringify(status.err));
    }

    if (
      status?.confirmationStatus === "confirmed" ||
      status?.confirmationStatus === "finalized"
    ) {
      return;
    }

    if (currentBlockHeight > lastValidBlockHeight) {
      throw new Error("Transaction expired before confirmation");
    }

    await sleep(CONFIRM_POLL_MS);
  }

  throw new Error("Timed out waiting for transaction confirmation");
}

export async function sendWalletSignedTransaction(
  connection: Connection,
  wallet: WalletSigner,
  transaction: Transaction,
): Promise<FrontendChainState> {
  if (!wallet.publicKey) throw new Error("Connect a wallet first");

  try {
    chainState("preparing");

    // Refresh the blockhash immediately before the wallet prompt so the user
    // does not sign a transaction built from a stale recent blockhash.
    const latest = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = latest.blockhash;
    transaction.lastValidBlockHeight = latest.lastValidBlockHeight;
    transaction.feePayer = transaction.feePayer ?? wallet.publicKey;

    // Preflight before signing. Signature verification is skipped here because
    // the wallet has not signed yet; sendRawTransaction performs normal
    // signature/preflight validation after signing.
    const simulation = await connection.simulateTransaction(transaction, {
      commitment: "confirmed",
      sigVerify: false,
      replaceRecentBlockhash: false,
    });

    if (simulation.value.err) {
      return chainState("failed", {
        error: JSON.stringify(simulation.value.err),
      });
    }

    chainState("awaiting_signature");
    const signed = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 3,
    });

    chainState("submitted", { signature });
    await waitForSignature(connection, signature, latest.lastValidBlockHeight);

    return chainState("confirmed", { signature });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return chainState("failed", { error: message });
  }
}
