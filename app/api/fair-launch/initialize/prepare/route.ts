import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddress, getMint } from "@solana/spl-token";
import { buildInitializeFairLaunch, buildSeedFairLaunchVault } from "@/lib/fair-launch-program";
import { FORGE_X_FAIR_LAUNCH } from "@/lib/fair-launch-rules";

const RPC = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mint = new PublicKey(body.mint);
    const developer = new PublicKey(body.developer);
    if (!process.env.NEXT_PUBLIC_FORGE_X_PROGRAM_ID) throw new Error("FORGE X Fair Launch program ID is not configured");

    const connection = new Connection(RPC, "confirmed");
    const mintInfo = await getMint(connection, mint, "confirmed");
    if (mintInfo.decimals !== FORGE_X_FAIR_LAUNCH.decimals) throw new Error("Mint decimals do not match Fair Launch rules");
    if (mintInfo.supply !== FORGE_X_FAIR_LAUNCH.supply * 10n ** 9n) throw new Error("Mint supply does not match Fair Launch rules");
    if (mintInfo.mintAuthority !== null || mintInfo.freezeAuthority !== null) throw new Error("Mint authorities must already be revoked");

    const developerAta = await getAccount(connection, await getAssociatedTokenAddress(mint, developer), "confirmed");
    if (developerAta.amount !== mintInfo.supply) throw new Error("Developer token account does not contain the complete Fair Launch supply");

    const latest = await connection.getLatestBlockhash("confirmed");
    const transaction = new Transaction().add(
      buildInitializeFairLaunch(mint, developer, FORGE_X_FAIR_LAUNCH.graduation.targetSolLamports),
      ...buildSeedFairLaunchVault(mint, developer),
    );
    transaction.feePayer = developer;
    transaction.recentBlockhash = latest.blockhash;

    return NextResponse.json({ transaction: transaction.serialize({ requireAllSignatures: false }).toString("base64"), mint: mint.toBase58(), developer: developer.toBase58(), lastValidBlockHeight: latest.lastValidBlockHeight });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to prepare Fair Launch initialization" }, { status: 400 });
  }
}
