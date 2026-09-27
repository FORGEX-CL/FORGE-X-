import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { verifyFairLaunchMint } from "@/lib/launch-verification";
import { assessTokenRisk } from "@/lib/token-risk";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: NextRequest, context: { params: Promise<{ mint: string }> }) {
  try {
    const { mint } = await context.params;
    new PublicKey(mint);
    const connection = new Connection(RPC, "confirmed");
    const verification = await verifyFairLaunchMint(connection, mint, 1_000_000_000n);
    const risk = assessTokenRisk({
      name: verification.name,
      symbol: verification.symbol,
      metadataUri: verification.metadataUri,
    });

    const effectiveScore = verification.valid ? risk.score : Math.max(risk.score, 70);
    const effectiveLevel = effectiveScore >= 80 ? "CRITICAL" : effectiveScore >= 50 ? "HIGH" : effectiveScore >= 25 ? "MEDIUM" : "LOW";
    const flags = verification.valid
      ? risk.flags
      : [...risk.flags, "Mint does not satisfy FORGE X Fair Launch authority/metadata checks"];

    return NextResponse.json({
      mint: verification.mint,
      fairLaunch: verification,
      risk: {
        ...risk,
        score: effectiveScore,
        level: effectiveLevel,
        hold: !verification.valid || risk.hold,
        flags: [...new Set(flags)],
      },
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to verify mint" },
      { status: 400 },
    );
  }
}
