import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { verifyFairLaunchMint } from "@/lib/launch-verification";
import { assessTokenRisk } from "@/lib/token-risk";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export async function GET(_request: NextRequest, context: { params: Promise<{ mint: string }> }) {
  try {
    const { mint } = await context.params;
    new PublicKey(mint);
    const connection = new Connection(RPC, "confirmed");
    const verification = await verifyFairLaunchMint(connection, mint, 1_000_000_000n);
    const risk = assessTokenRisk({});

    return NextResponse.json({
      mint: verification.mint,
      fairLaunch: verification,
      risk: {
        ...risk,
        score: verification.valid ? risk.score : Math.max(risk.score, 70),
        level: verification.valid ? risk.level : "HIGH",
        hold: !verification.valid || risk.hold,
        flags: verification.valid ? risk.flags : [...risk.flags, "Mint does not satisfy FORGE X Fair Launch authority/metadata checks"],
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to verify mint" },
      { status: 400 },
    );
  }
}
