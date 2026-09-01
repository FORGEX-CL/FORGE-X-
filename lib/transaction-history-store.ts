import { recordConfirmedTransaction, sortTransactions, TransactionRecord } from "./transaction-history";

export function createTransactionHistoryStore() {
  const records: TransactionRecord[] = [];
  return {
    add(record: TransactionRecord) {
      const confirmed = recordConfirmedTransaction(record);
      if (!records.some((item) => item.signature === confirmed.signature)) records.push(confirmed);
      return confirmed;
    },
    list(wallet?: string) {
      const filtered = wallet ? records.filter((item) => item.wallet === wallet) : records;
      return sortTransactions(filtered);
    },
  };
}
