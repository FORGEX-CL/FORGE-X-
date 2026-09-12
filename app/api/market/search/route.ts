import { NextRequest, NextResponse } from "next/server";
import { assessTokenRisk } from "@/lib/token-risk";

type DexPair = {
  chainId?: string;
  baseToken?: { name?: string; symbol?: string };
  info?: { websites?: Array<{ url?: string }>; socials?: Array<{ url?: string }> };
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ pairs: [] });

  const response = await fetch(
    `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`,
    { next: { revalidate: 20 } },
  );
  if (!response.ok) return NextResponse.json({ error: "Market provider unavailable" }, { status: 502 });

  const data = await response.json();
  const pairs = (data.pairs ?? [])
    .filter((pair: DexPair) => pair.chainId === "solana")
    .map((pair: DexPair) => {
      const risk = assessTokenRisk({
        name: pair.baseToken?.name,
        symbol: pair.baseToken?.symbol,
        website: pair.info?.websites?.[0]?.url,
        socials: pair.info?.socials?.map((social) => social.url).filter(Boolean) as string[] | undefined,
      });
      return { ...pair, forgeRisk: risk };
    });

  return NextResponse.json({ pairs });
}
