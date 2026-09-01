import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { buildTokenLaunchTransaction } from "@/lib/token-launch";
import { FORGE_X_FAIR_LAUNCH, assertFairLaunchSupply } from "@/lib/fair-launch-rules";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payer = new PublicKey(body.payer);
    const supply = BigInt(body.supply);

    // Fair Launch settings are protocol-owned and cannot be overridden by the client.
    assertFairLaunchSupply(supply);
    if (Number(body.decimals) !== FORGE_X_FAIR_LAUNCH.decimals) {
      throw new Error("FORGE X Fair Launch uses exactly 9 decimals");
    }
    if (body.revokeMintAuthority !== true || body.revokeFreezeAuthority !== true) {
      throw new Error("FORGE X Fair Launch automatically revokes mint and freeze authority");
    }

    const connection = new Connection(RPC, "confirmed");
    const result = await buildTokenLaunchTransaction(connection, payer, {
      name: String(body.name || ""),
      symbol: String(body.symbol || "").toUpperCase(),
      decimals: FORGE_X_FAIR_LAUNCH.decimals,
      supply: FORGE_X_FAIR_LAUNCH.supply,
      revokeMintAuthority: true,
      revokeFreezeAuthority: true,
    });

    return NextResponse.json({
      network: "devnet",
      rules: {
        supply: FORGE_X_FAIR_LAUNCH.supply.toString(),
        decimals: FORGE_X_FAIR_LAUNCH.decimals,
        developerFirstBuyRequired: FORGE_X_FAIR_LAUNCH.developerFirstBuyRequired,
        mintAuthorityRevoked: true,
        freezeAuthorityRevoked: true,
        metadataAuthorityRevoked: FORGE_X_FAIR_LAUNCH.metadataAuthorityRevoked,
        tradingFeeBps: FORGE_X_FAIR_LAUNCH.tradingFeeBps,
      },
      mint: result.mint,
      associatedTokenAccount: result.associatedTokenAccount,
      transaction: result.transaction.serialize({ requireAllSignatures: false }).toString("base64"),
      lastValidBlockHeight: result.lastValidBlockHeight,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to prepare token launch" },
      { status: 400 },
    );
  }
}
