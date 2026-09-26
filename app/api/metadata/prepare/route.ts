import { NextRequest, NextResponse } from "next/server";
import { uploadTokenMetadata } from "@/lib/metadata-storage";

export const runtime = "nodejs";

function validHttpUrl(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return undefined;
  const url = new URL(String(value));
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`${field} must be an HTTP(S) URL`);
  if (url.username || url.password) throw new Error(`${field} must not contain embedded credentials`);
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname === "0.0.0.0" || url.hostname === "::1") {
    throw new Error(`${field} must not target a local host`);
  }
  return url.toString();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const symbol = String(body.symbol || "").trim().toUpperCase();
    const description = String(body.description || "").trim();
    if (!name || !symbol) throw new Error("Token name and symbol are required");
    if (name.length > 32 || symbol.length > 10) throw new Error("Token name or symbol is too long");
    if (description.length > 500) throw new Error("Description is too long");

    const uri = await uploadTokenMetadata({
      name,
      symbol,
      description,
      image: validHttpUrl(body.image, "Image"),
      website: validHttpUrl(body.website, "Website"),
      twitter: validHttpUrl(body.twitter, "X/Twitter"),
      telegram: validHttpUrl(body.telegram, "Telegram"),
    });
    return NextResponse.json({ uri });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to store metadata" }, { status: 400 });
  }
}
