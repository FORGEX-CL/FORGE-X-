import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { buildTokenLaunchTransaction } from "@/lib/token-launch";

const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta" ? "mainnet-beta" : "devnet";
const RPC = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || (CLUSTER === "mainnet-beta" ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com");

function assertWholeTokenSupply(value: string) {
  if (!/^[0-9]+$/.test(value)) throw new Error("Supply must be a whole number");
  const supply = BigInt(value);
  if (supply <= 0n) throw new Error("Supply must be greater than zero");
  return supply;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payer = new PublicKey(body.payer);
    const name = String(body.name || "").trim();
    const symbol = String(body.symbol || "").trim().toUpperCase();
    const metadataUri = String(body.metadataUri || "").trim();
    const supply = assertWholeTokenSupply(String(body.supply || ""));

    if (!name) throw new Error("Token name is required");
    if (!/^[A-Z0-9]{1,10}$/.test(symbol)) throw new Error("Symbol must be 1-10 uppercase letters/numbers");
    if (!metadataUri) throw new Error("Metadata URI is required");
    if (body.revokeMintAuthority !== true || body.revokeFreezeAuthority !== true || body.immutable !== true) {
      throw new Error("FORGE X Advanced Launch requires mint revocation, freeze revocation and immutable metadata");
    }

    const connection = new Connection(RPC, "confirmed");
    const result = await buildTokenLaunchTransaction(connection, payer, {
      name,
      symbol,
      decimals: 9,
      supply,
      metadataUri,
      revokeMintAuthority: true,
      revokeFreezeAuthority: true,
    });

    return NextResponse.json({
      network: CLUSTER,
      mint: result.mint,
      associatedTokenAccount: result.associatedTokenAccount,
      transaction: result.transaction.serialize({ requireAllSignatures: false }).toString("base64"),
      lastValidBlockHeight: result.lastValidBlockHeight,
      rules: {
        decimals: 9,
        mintAuthorityRevoked: true,
        freezeAuthorityRevoked: true,
        metadataImmutable: true,
        metadataUpdateAuthorityRevoked: true,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to prepare Advanced Launch token" }, { status: 400 });
  }
}
