import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { buildTokenLaunchTransaction } from "@/lib/token-launch";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payer, name, symbol, decimals, supply, metadataUri, revokeMintAuthority, revokeFreezeAuthority } = body;
    if (!payer || !name || !symbol || decimals == null || !supply || !metadataUri) {
      return NextResponse.json({ error: "Missing token launch fields" }, { status: 400 });
    }

    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com",
      "confirmed",
    );
    const result = await buildTokenLaunchTransaction(connection, new PublicKey(payer), {
      name: String(name),
      symbol: String(symbol).toUpperCase(),
      decimals: Number(decimals),
      supply: BigInt(supply),
      metadataUri: String(metadataUri),
      revokeMintAuthority: Boolean(revokeMintAuthority),
      revokeFreezeAuthority: Boolean(revokeFreezeAuthority),
    });

    return NextResponse.json({
      transaction: result.transaction.serialize({ requireAllSignatures: false }).toString("base64"),
      mint: result.mint,
      associatedTokenAccount: result.associatedTokenAccount,
      metadataImmutable: result.metadataImmutable,
      lastValidBlockHeight: result.lastValidBlockHeight,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to prepare token launch" },
      { status: 400 },
    );
  }
}
