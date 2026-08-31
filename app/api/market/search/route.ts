import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ pairs: [] });
  const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`, { next: { revalidate: 20 } });
  if (!response.ok) return NextResponse.json({ error: "Market provider unavailable" }, { status: 502 });
  const data = await response.json();
  return NextResponse.json({ pairs: (data.pairs ?? []).filter((pair: { chainId?: string }) => pair.chainId === "solana") });
}
