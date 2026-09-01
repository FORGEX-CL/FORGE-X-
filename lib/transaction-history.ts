export type TransactionType = "LAUNCH" | "DEV_BUY" | "BUY" | "SELL" | "GRADUATION" | "POOL_CREATE";

export type TransactionRecord = {
  signature: string;
  type: TransactionType;
  wallet: string;
  mint?: string;
  poolAddress?: string;
  slot?: number;
  confirmedAt?: number;
};

export function recordConfirmedTransaction(record: TransactionRecord): TransactionRecord {
  if (!record.signature) throw new Error("Transaction signature is required");
  if (!record.wallet) throw new Error("Wallet address is required");
  if (!record.type) throw new Error("Transaction type is required");
  return { ...record, confirmedAt: record.confirmedAt ?? Date.now() };
}

export function sortTransactions(records: TransactionRecord[]): TransactionRecord[] {
  return [...records].sort((a, b) => (b.confirmedAt ?? 0) - (a.confirmedAt ?? 0));
}
