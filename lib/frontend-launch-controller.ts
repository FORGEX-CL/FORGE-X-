import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { chainState, FrontendChainState } from "./frontend-chain-status";

export type WalletSigner = {
  publicKey: PublicKey | null;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
};

export async function sendWalletSignedTransaction(
  connection: Connection,
  wallet: WalletSigner,
  transaction: Transaction,
): Promise<FrontendChainState> {
  if (!wallet.publicKey) throw new Error("Connect a wallet first");

  const prepared = chainState("preparing");
  void prepared;

  const signed = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
  const submitted = chainState("submitted", { signature });
  void submitted;

  const confirmation = await connection.confirmTransaction(signature, "confirmed");
  if (confirmation.value.err) {
    return chainState("failed", { signature, error: JSON.stringify(confirmation.value.err) });
  }

  return chainState("confirmed", { signature });
}
