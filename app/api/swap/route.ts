import { NextRequest, NextResponse } from "next/server";
import { buildJupiterSwapTransaction } from "@/lib/jupiter";

export async function POST(request: NextRequest) {
  try {
    const { quoteResponse, userPublicKey } = await request.json();
    if (!quoteResponse || !userPublicKey) return NextResponse.json({ error: "quoteResponse and userPublicKey are required" }, { status: 400 });
    const result = await buildJupiterSwapTransaction(quoteResponse, userPublicKey);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Swap transaction unavailable" }, { status: 502 });
  }
}
