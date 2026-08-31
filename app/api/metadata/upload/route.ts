import { NextRequest, NextResponse } from "next/server";
import { PinataSDK } from "pinata";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!process.env.PINATA_JWT) return NextResponse.json({ error: "PINATA_JWT is not configured" }, { status: 503 });
  try {
    const body = await request.json();
    if (!body?.name || !body?.symbol || !body?.description) return NextResponse.json({ error: "name, symbol and description are required" }, { status: 400 });
    const pinata = new PinataSDK({ pinataJwt: process.env.PINATA_JWT, pinataGateway: process.env.PINATA_GATEWAY || "" });
    const upload = await pinata.upload.public.json({ name: body.name, symbol: body.symbol, description: body.description, image: body.image || "" }).name("metadata.json");
    return NextResponse.json({ cid: upload.cid, uri: `ipfs://${upload.cid}`, gatewayUrl: process.env.PINATA_GATEWAY ? `https://${process.env.PINATA_GATEWAY}/ipfs/${upload.cid}` : null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Metadata upload failed" }, { status: 500 });
  }
}
