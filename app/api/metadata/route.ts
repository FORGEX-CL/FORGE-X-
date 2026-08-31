import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.symbol || !body?.description) {
    return NextResponse.json({ error: "name, symbol and description are required" }, { status: 400 });
  }
  // Storage provider integration is intentionally server-side. Configure a provider
  // before production use; never expose storage credentials to the browser.
  return NextResponse.json({
    metadata: {
      name: body.name,
      symbol: body.symbol,
      description: body.description,
      image: body.image || "",
    },
    status: "ready_for_storage",
  });
}
