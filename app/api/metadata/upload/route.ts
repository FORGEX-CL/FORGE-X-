import { NextRequest, NextResponse } from "next/server";
import { PinataSDK } from "pinata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeHttpUrl(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return undefined;
  const url = new URL(String(value));
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`${field} must be an HTTP(S) URL`);
  if (url.username || url.password) throw new Error(`${field} must not contain embedded credentials`);
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname === "0.0.0.0" || url.hostname === "::1") throw new Error(`${field} must not target a local host`);
  return url.toString();
}

export async function POST(request: NextRequest) {
  if (!process.env.PINATA_JWT) return NextResponse.json({ error: "PINATA_JWT is not configured" }, { status: 503 });
  try {
    const body = await request.json();
    if (!body?.name || !body?.symbol || !body?.description) return NextResponse.json({ error: "name, symbol and description are required" }, { status: 400 });
    const name = String(body.name).trim();
    const symbol = String(body.symbol).trim().toUpperCase();
    const description = String(body.description).trim();
    if (name.length > 32 || symbol.length > 10) return NextResponse.json({ error: "Token name or symbol is too long" }, { status: 400 });
    if (description.length > 500) return NextResponse.json({ error: "Description is too long" }, { status: 400 });
    const image = safeHttpUrl(body.image, "Image");
    const website = safeHttpUrl(body.website, "Website");
    const twitter = safeHttpUrl(body.twitter, "X/Twitter");
    const telegram = safeHttpUrl(body.telegram, "Telegram");
    const pinata = new PinataSDK({ pinataJwt: process.env.PINATA_JWT, pinataGateway: process.env.PINATA_GATEWAY || "" });
    const content: Record<string, unknown> = { name, symbol, description };
    if (image) content.image = image;
    if (website) content.external_url = website;
    const properties: Record<string, string> = {};
    if (twitter) properties.twitter = twitter;
    if (telegram) properties.telegram = telegram;
    if (Object.keys(properties).length) content.properties = properties;
    const upload = await pinata.upload.public.json(content).name(`${symbol}-metadata.json`);
    return NextResponse.json({ cid: upload.cid, uri: `ipfs://${upload.cid}`, gatewayUrl: process.env.PINATA_GATEWAY ? `https://${process.env.PINATA_GATEWAY}/ipfs/${upload.cid}` : null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Metadata upload failed" }, { status: 500 });
  }
}
