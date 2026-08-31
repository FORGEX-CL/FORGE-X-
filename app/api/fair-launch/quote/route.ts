import { NextRequest, NextResponse } from "next/server";
import { quoteBuy } from "@/lib/fair-launch";

export async function GET(request: NextRequest) {
  const p = new URL(request.url).searchParams;
  try {
    const solIn = BigInt(p.get("solIn") || "0");
    const virtualSol = BigInt(p.get("virtualSol") || "0");
    const virtualTokens = BigInt(p.get("virtualTokens") || "0");
    const tokensOut = quoteBuy(solIn, virtualSol, virtualTokens);
    return NextResponse.json({ solIn: solIn.toString(), tokensOut: tokensOut.toString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid curve quote" }, { status: 400 });
  }
}
