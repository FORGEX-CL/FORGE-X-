import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { buildTokenLaunchTransaction } from "@/lib/token-launch";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payer = new PublicKey(body.payer);
    const connection = new Connection(RPC, "confirmed");
    const result = await buildTokenLaunchTransaction(connection, payer, {
      name: String(body.name || ""), symbol: String(body.symbol || "").toUpperCase(),
      decimals: Number(body.decimals), supply: BigInt(body.supply),
      revokeMintAuthority: Boolean(body.revokeMintAuthority),
      revokeFreezeAuthority: Boolean(body.revokeFreezeAuthority),
    });
    return NextResponse.json({ network: "devnet", mint: result.mint, associatedTokenAccount: result.associatedTokenAccount, transaction: result.transaction.serialize({ requireAllSignatures: false }).toString("base64"), lastValidBlockHeight: result.lastValidBlockHeight });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to prepare token launch" }, { status: 400 });
  }
}
