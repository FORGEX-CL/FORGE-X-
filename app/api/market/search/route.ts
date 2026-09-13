import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { assessTokenRisk } from "@/lib/token-risk";

type DexPair = {
  pairAddress?: string;
  chainId?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { symbol?: string };
  priceUsd?: string;
  priceChange?: { h24?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  dexId?: string;
  info?: { websites?: Array<{ url?: string }>; socials?: Array<{ url?: string }> };
};

type DexSearchResponse = { pairs?: DexPair[] | null };
type ForgeStatus = "WAITING_FOR_DEV_BUY" | "LIVE" | "GRADUATED" | "MIGRATED" | null;

const RPC = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = process.env.NEXT_PUBLIC_FORGE_X_PROGRAM_ID;
const STATE_SEED = Buffer.from("launch");
const STATUS: Record<number, ForgeStatus> = { 0: "WAITING_FOR_DEV_BUY", 1: "LIVE", 2: "GRADUATED", 3: "MIGRATED" };
const MAX_QUERY_LENGTH = 80;
const PROVIDER_TIMEOUT_MS = 8_000;

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
        if (account?.owner.equals(programId) && account.data.length >= 82) {
          result.set(pair.mint, STATUS[account.data[33]] ?? null);
        }
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
    if (q.length > MAX_QUERY_LENGTH) return NextResponse.json({ error: "Search query is too long" }, { status: 400 });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
        next: { revalidate: 20 },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) return NextResponse.json({ error: "Market provider unavailable" }, { status: 502 });

    const data: unknown = await response.json();
    const dexData = data && typeof data === "object" ? data as DexSearchResponse : {};
    const solanaPairs = Array.isArray(dexData.pairs) ? dexData.pairs.filter((pair) => pair?.chainId === "solana") : [];
    const mints = [...new Set(solanaPairs.map((pair) => pair.baseToken?.address).filter((address): address is string => typeof address === "string"))].slice(0, 50);
    const forgeStatuses = await getForgeStatuses(mints);

    const pairs = solanaPairs.map((pair) => {
      const socials = pair.info?.socials?.map((social) => social.url).filter((url): url is string => typeof url === "string");
      const risk = assessTokenRisk({
        name: pair.baseToken?.name,
        symbol: pair.baseToken?.symbol,
        website: pair.info?.websites?.[0]?.url,
        socials,
      });
      const mint = pair.baseToken?.address;
      return { ...pair, forgeRisk: risk, forgeStatus: mint ? forgeStatuses.get(mint) ?? null : null };
    });

    return NextResponse.json({ pairs });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "Market provider timed out" : "Market search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
