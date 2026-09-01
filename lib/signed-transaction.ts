import { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import { assertWalletCanSign, type SolanaWalletProvider } from "./wallet-provider";

export type SignableTransaction = Transaction | VersionedTransaction;

export async function signAndConfirmDevnetTransaction(
  provider: SolanaWalletProvider,
  connection: Connection,
  transaction: SignableTransaction,
) {
  assertWalletCanSign(provider);

  const signed = await provider.signTransaction(transaction as Transaction);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  const latest = await connection.getLatestBlockhash("confirmed");
  const confirmation = await connection.confirmTransaction(
    { signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
    "confirmed",
  );

  if (confirmation.value.err) {
    throw new Error(`Solana transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  return { signature, confirmation };
}
