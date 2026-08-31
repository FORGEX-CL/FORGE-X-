import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { name, symbol, description = "", image = "" } = await request.json();
  if (!name || !symbol) return NextResponse.json({ error: "name and symbol are required" }, { status: 400 });
  return NextResponse.json({ metadata: { name, symbol, description, image, properties: { category: "token" } }, note: "Store this JSON at a public HTTPS URI before mint initialization." });
}
