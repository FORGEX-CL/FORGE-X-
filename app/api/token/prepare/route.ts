import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { buildTokenLaunchTransaction } from "@/lib/token-launch";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payer, name, symbol, decimals, supply, revokeMintAuthority, revokeFreezeAuthority } = body;
    if (!payer || !name || !symbol || decimals == null || !supply) return NextResponse.json({ error: "Missing token launch fields" }, { status: 400 });
    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");
    const result = await buildTokenLaunchTransaction(connection, new PublicKey(payer), { name, symbol, decimals: Number(decimals), supply: BigInt(supply), revokeMintAuthority: Boolean(revokeMintAuthority), revokeFreezeAuthority: Boolean(revokeFreezeAuthority) });
    const blockhash = await connection.getLatestBlockhash("confirmed");
    result.transaction.recentBlockhash = blockhash.blockhash;
    result.transaction.lastValidBlockHeight = blockhash.lastValidBlockHeight;
    result.transaction.partialSign(result.mintKeypair);
    return NextResponse.json({ transaction: result.transaction.serialize({ requireAllSignatures: false }).toString("base64"), mint: result.mint, associatedTokenAccount: result.associatedTokenAccount, lastValidBlockHeight: blockhash.lastValidBlockHeight });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to prepare token launch" }, { status: 400 }); }
}
