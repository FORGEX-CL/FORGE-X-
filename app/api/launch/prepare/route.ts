import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { buildTokenLaunchTransaction } from "@/lib/token-launch";
import { FORGE_X_FAIR_LAUNCH, assertFairLaunchSupply } from "@/lib/fair-launch-rules";

const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta" ? "mainnet-beta" : "devnet";
const RPC = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || (CLUSTER === "mainnet-beta" ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com");

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > 16_384) throw new Error("Request body is too large");
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 16_384) throw new Error("Request body is too large");
    let body: unknown;
    try { body = JSON.parse(rawBody); } catch { throw new Error("Invalid request body"); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid request body");
    const input = body as Record<string, unknown>;
    const payerValue = input.payer;
    if (typeof payerValue !== "string" || !payerValue.trim()) throw new Error("payer is required");
    const payer = new PublicKey(payerValue);
    const supplyValue = input.supply;
    if (typeof supplyValue !== "string" && typeof supplyValue !== "number" && typeof supplyValue !== "bigint") throw new Error("supply is required");
    const supply = BigInt(supplyValue);
    const name = String(input.name || "").trim();
    const symbol = String(input.symbol || "").trim().toUpperCase();
    const metadataUri = String(input.metadataUri || "").trim();

    assertFairLaunchSupply(supply);
    if (Number(input.decimals) !== FORGE_X_FAIR_LAUNCH.decimals) throw new Error("FORGE X Fair Launch uses exactly 9 decimals");
    if (input.revokeMintAuthority !== true || input.revokeFreezeAuthority !== true) throw new Error("FORGE X Fair Launch automatically revokes mint and freeze authority");
    if (!metadataUri) throw new Error("Metadata URI is required for Fair Launch");
    if (!process.env.NEXT_PUBLIC_FORGE_X_PROGRAM_ID) throw new Error("FORGE X Fair Launch program ID is not configured");

    const connection = new Connection(RPC, "confirmed");
    const result = await buildTokenLaunchTransaction(connection, payer, {
      name,
      symbol,
      decimals: FORGE_X_FAIR_LAUNCH.decimals,
      supply: FORGE_X_FAIR_LAUNCH.supply,
      metadataUri,
      revokeMintAuthority: true,
      revokeFreezeAuthority: true,
    });

    return NextResponse.json({
      network: CLUSTER,
      rules: {
        supply: FORGE_X_FAIR_LAUNCH.supply.toString(),
        decimals: FORGE_X_FAIR_LAUNCH.decimals,
        developerFirstBuyRequired: FORGE_X_FAIR_LAUNCH.developerFirstBuyRequired,
        developerMinimumBuyLamports: FORGE_X_FAIR_LAUNCH.developerMinimumBuyLamports.toString(),
        mintAuthorityRevoked: true,
        freezeAuthorityRevoked: true,
        metadataAuthorityRevoked: result.metadataUpdateAuthorityRevoked,
        metadataImmutable: result.metadataImmutable,
        tradingFeeBps: FORGE_X_FAIR_LAUNCH.tradingFeeBps,
        graduationTargetLamports: FORGE_X_FAIR_LAUNCH.graduation.targetSolLamports.toString(),
      },
      mint: result.mint,
      associatedTokenAccount: result.associatedTokenAccount,
      transaction: result.transaction.serialize({ requireAllSignatures: false }).toString("base64"),
      lastValidBlockHeight: result.lastValidBlockHeight,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to prepare token launch" }, { status: 400 });
  }
}
