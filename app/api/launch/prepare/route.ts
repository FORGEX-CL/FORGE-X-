import { NextRequest, NextResponse } from "next/server";
import { Connection, Keypair, SystemProgram, Transaction, PublicKey } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.payer || !Number.isInteger(body?.decimals) || body.decimals < 0 || body.decimals > 9) {
    return NextResponse.json({ error: "payer and valid decimals are required" }, { status: 400 });
  }
  try {
    const payer = new PublicKey(body.payer);
    const connection = new Connection(RPC, "confirmed");
    const mint = Keypair.generate();
    const lamports = await connection.getMinimumBalanceForRentExemption(82);
    const transaction = new Transaction().add(
      SystemProgram.createAccount({ fromPubkey: payer, newAccountPubkey: mint.publicKey, lamports, space: 82, programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") })
    );
    return NextResponse.json({ mintPublicKey: mint.publicKey.toBase58(), transaction: transaction.serializeMessage().toString("base64"), network: "devnet", note: "Mint initialization instructions must be added before signing." });
  } catch {
    return NextResponse.json({ error: "Unable to prepare launch transaction" }, { status: 400 });
  }
}
