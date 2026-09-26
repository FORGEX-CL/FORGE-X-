import { NextRequest, NextResponse } from "next/server";
import { assessTokenRisk } from "@/lib/token-risk";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = assessTokenRisk({
      name: typeof body.name === "string" ? body.name : undefined,
      symbol: typeof body.symbol === "string" ? body.symbol : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      website: typeof body.website === "string" ? body.website : undefined,
      socials: Array.isArray(body.socials) ? body.socials.filter((value: unknown): value is string => typeof value === "string") : undefined,
      creator: typeof body.creator === "string" ? body.creator : undefined,
    });

    return NextResponse.json({
      ...result,
      disclaimer: "FORGE X risk signals are heuristic screening, not a guarantee that a token is safe.",
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to assess token risk" },
      { status: 400 },
    );
  }
}
