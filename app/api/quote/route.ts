import { NextRequest, NextResponse } from "next/server";
import { getJupiterQuote } from "@/lib/jupiter";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const inputMint = searchParams.get("inputMint");
  const outputMint = searchParams.get("outputMint");
  const amount = searchParams.get("amount");
  const slippageBps = Number(searchParams.get("slippageBps") || 50);

  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json({ error: "inputMint, outputMint and amount are required" }, { status: 400 });
  }
  try {
    const quote = await getJupiterQuote({ inputMint, outputMint, amount, slippageBps });
    return NextResponse.json(quote);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Quote unavailable" }, { status: 502 });
  }
}
