export type PoolConfirmation = {
  poolAddress: string;
  transactionSignature: string;
  confirmed: boolean;
};

export function confirmPool(poolAddress: string, transactionSignature: string, confirmedOnChain: boolean): PoolConfirmation {
  if (!poolAddress) throw new Error("Pool address is required");
  if (!transactionSignature) throw new Error("Pool transaction signature is required");
  if (!confirmedOnChain) throw new Error("Pool cannot be marked confirmed before on-chain confirmation");
  return { poolAddress, transactionSignature, confirmed: true };
}
