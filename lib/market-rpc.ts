import { Connection, PublicKey } from "@solana/web3.js";

export type RpcPoolSnapshot = {
  address: string;
  lamports: number;
  executable: boolean;
};

export async function readPoolAccount(connection: Connection, poolAddress: string): Promise<RpcPoolSnapshot | null> {
  const address = new PublicKey(poolAddress);
  const info = await connection.getAccountInfo(address, "confirmed");
  if (!info) return null;
  return { address: address.toBase58(), lamports: info.lamports, executable: info.executable };
}
