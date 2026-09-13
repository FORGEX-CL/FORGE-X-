import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { assessTokenRisk } from "@/lib/token-risk";

type DexPair = {
  chainId?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  info?: { websites?: Array<{ url?: string }>; socials?: Array<{ url?: string }> };
};

type ForgeStatus = "WAITING_FOR_DEV_BUY" | "LIVE" | "GRADUATED" | "MIGRATED" | null;

const RPC = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = process.env.NEXT_PUBLIC_FORGE_X_PROGRAM_ID;
const STATE_SEED = Buffer.from("launch");
const STATUS: Record<number, ForgeStatus> = { 0: "WAITING_FOR_DEV_BUY", 1: "LIVE", 2: "GRADUATED", 3: "MIGRATED" };

function getForgeStatuses(mints: string[]): Promise<Map<string, ForgeStatus>> {
  if (!PROGRAM_ID || mints.length === 0) return Promise.resolve(new Map());
  try {
    const programId = new PublicKey(PROGRAM_ID);
    const pairs = mints.map((mint) => {
      const publicKey = new PublicKey(mint);
      const [state] = PublicKey.findProgramAddressSync([STATE_SEED, publicKey.toBuffer()], programId);
      return { mint, state };
    });
    const connection = new Connection(RPC, "confirmed");
    return connection.getMultipleAccountsInfo(pairs.map((pair) => pair.state), "confirmed").then((accounts) => {
      const result = new Map<string, ForgeStatus>();
      pairs.forEach((pair, index) => {
        const account = accounts[index];
        if (account?.owner.equals(programId) && account.data.length >= 82) result.set(pair.mint, STATUS[account.data[33]] ?? null);
      });
      return result;
    });
  } catch {
    return Promise.resolve(new Map());
  }
}

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim();
    if (!q) return NextResponse.json({ pairs: [] });
    if (q.length > 80) return NextResponse.json({ error: "Search query is too long" }, { status: 400 });

    const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`, { next: { revalidate: 20 } });
    if (!response.ok) return NextResponse.json({ error: "Market provider unavailable" }, { status: 502 });

    const data = await response.json();
    const solanaPairs = (data.pairs ?? []).filter((pair: DexPair) => pair.chainId === "solana");
    const mints = [...new Set(solanaPairs.map((pair: DexPair) => pair.baseToken?.address).filter((address): address is string => typeof address === "string"))].slice(0, 50);
    const forgeStatuses = await getForgeStatuses(mints);

    const pairs = solanaPairs.map((pair: DexPair) => {
      const risk = assessTokenRisk({
        name: pair.baseToken?.name,
        symbol: pair.baseToken?.symbol,
        website: pair.info?.websites?.[0]?.url,
        socials: pair.info?.socials?.map((social) => social.url).filter(Boolean) as string[] | undefined,
      });
      const mint = pair.baseToken?.address;
      return { ...pair, forgeRisk: risk, forgeStatus: mint ? forgeStatuses.get(mint) ?? null : null };
    });

    return NextResponse.json({ pairs });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Market search failed" }, { status: 500 });
  }
}
