import { NextRequest, NextResponse } from "next/server";
import { assessTokenRisk } from "@/lib/token-risk";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid request body");
    const textFields = ["name", "symbol", "description", "website", "creator", "metadataUri"] as const;
    for (const field of textFields) {
      if (body[field] !== undefined && typeof body[field] !== "string") throw new Error(`${field} must be a string`);
      if (typeof body[field] === "string" && body[field].length > 1000) throw new Error(`${field} is too long`);
    }
    if (Array.isArray(body.socials) && body.socials.length > 10) throw new Error("Too many social links");
    const socials = Array.isArray(body.socials) ? body.socials : undefined;
    if (socials?.some((value: unknown) => typeof value !== "string" || value.length > 500)) throw new Error("Invalid social link");

    const result = assessTokenRisk({
      name: typeof body.name === "string" ? body.name : undefined,
      symbol: typeof body.symbol === "string" ? body.symbol : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      website: typeof body.website === "string" ? body.website : undefined,
      socials: socials?.filter((value: unknown): value is string => typeof value === "string"),
      creator: typeof body.creator === "string" ? body.creator : undefined,
      metadataUri: typeof body.metadataUri === "string" ? body.metadataUri : undefined,
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
