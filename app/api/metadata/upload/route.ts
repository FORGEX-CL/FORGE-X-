import { NextRequest, NextResponse } from "next/server";
import { PinataSDK } from "pinata";

export const runtime = "nodejs";

function httpUrl(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return "";
  const url = new URL(String(value));
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`${field} must be an HTTP(S) URL`);
  if (url.username || url.password) throw new Error(`${field} must not contain embedded credentials`);
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname === "0.0.0.0" || url.hostname === "::1") {
    throw new Error(`${field} must not target a local host`);
  }
  return url.toString();
}

export async function POST(request: NextRequest) {
  if (!process.env.PINATA_JWT) return NextResponse.json({ error: "PINATA_JWT is not configured" }, { status: 503 });
  try {
    const body = await request.json();
    const name = String(body?.name || "").trim();
    const symbol = String(body?.symbol || "").trim().toUpperCase();
    const description = String(body?.description || "").trim();
    if (!name || !symbol || !description) {
      return NextResponse.json({ error: "name, symbol and description are required" }, { status: 400 });
    }
    if (name.length > 32 || symbol.length > 10) {
      return NextResponse.json({ error: "Token name or symbol is too long" }, { status: 400 });
    }
    if (description.length > 500) {
      return NextResponse.json({ error: "Description is too long" }, { status: 400 });
    }

    const image = httpUrl(body.image, "Image");
    const website = httpUrl(body.website, "Website");
    const twitter = httpUrl(body.twitter, "X/Twitter");
    const telegram = httpUrl(body.telegram, "Telegram");

    const pinata = new PinataSDK({
      pinataJwt: process.env.PINATA_JWT,
      pinataGateway: process.env.PINATA_GATEWAY || "",
    });
    const upload = await pinata.upload.public.json({
      name,
      symbol,
      description,
      image,
      website,
      twitter,
      telegram,
    }).name("metadata.json");

    return NextResponse.json({
      cid: upload.cid,
      uri: `ipfs://${upload.cid}`,
      gatewayUrl: process.env.PINATA_GATEWAY ? `https://${process.env.PINATA_GATEWAY}/ipfs/${upload.cid}` : null,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Metadata upload failed" },
      { status: 400 },
    );
  }
}
