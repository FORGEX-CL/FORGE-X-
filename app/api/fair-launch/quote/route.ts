import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_FAIR_LAUNCH, applyTradeFee, canOpenPublicTrading, hasGraduated, quoteBuy, quoteSell } from "@/lib/fair-launch";

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > 16_384) throw new Error("Request body is too large");
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 16_384) throw new Error("Request body is too large");
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new Error("Invalid request body");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid request body");
    const input = body as Record<string, unknown>;
    const side = input.side === "sell" ? "sell" : "buy";
    const amount = BigInt(String(input.amount || "0"));
    const virtualSol = BigInt(String(input.virtualSol || DEFAULT_FAIR_LAUNCH.virtualSolReserve));
    const virtualTokens = BigInt(String(input.virtualTokens || DEFAULT_FAIR_LAUNCH.virtualTokenReserve));
    const developerBuy = BigInt(String(input.developerBuy || "0"));
    const realSolRaised = BigInt(String(input.realSolRaised || "0"));
    if (amount <= 0n) throw new Error("Amount must be positive");
    if (side === "buy") {
      const fee = applyTradeFee(amount, DEFAULT_FAIR_LAUNCH.tradeFeeBps);
      const tokensOut = quoteBuy(amount - fee, virtualSol, virtualTokens);
      return NextResponse.json({ side, amount: amount.toString(), fee: fee.toString(), tokensOut: tokensOut.toString(), publicTradingOpen: canOpenPublicTrading(developerBuy, DEFAULT_FAIR_LAUNCH), graduated: hasGraduated(realSolRaised + amount - fee, DEFAULT_FAIR_LAUNCH) });
    }
    const grossSolOut = quoteSell(amount, virtualSol, virtualTokens);
    const fee = applyTradeFee(grossSolOut, DEFAULT_FAIR_LAUNCH.tradeFeeBps);
    return NextResponse.json({ side, amount: amount.toString(), grossSolOut: grossSolOut.toString(), fee: fee.toString(), netSolOut: (grossSolOut - fee).toString(), graduated: hasGraduated(realSolRaised, DEFAULT_FAIR_LAUNCH) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid quote" }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const p = new URL(request.url).searchParams;
  try {
    const solIn = BigInt(p.get("solIn") || "0");
    const virtualSol = BigInt(p.get("virtualSol") || DEFAULT_FAIR_LAUNCH.virtualSolReserve.toString());
    const virtualTokens = BigInt(p.get("virtualTokens") || DEFAULT_FAIR_LAUNCH.virtualTokenReserve.toString());
    const tokensOut = quoteBuy(solIn, virtualSol, virtualTokens);
    return NextResponse.json({ solIn: solIn.toString(), tokensOut: tokensOut.toString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid curve quote" }, { status: 400 });
  }
}
