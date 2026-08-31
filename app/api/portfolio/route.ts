import { NextRequest, NextResponse } from "next/server";

const RPC = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

async function rpc(method: string, params: unknown[]) {
  const response = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), cache: "no-store" });
  const json = await response.json();
  if (!response.ok || json.error) throw new Error(json.error?.message || "Solana RPC request failed");
  return json.result;
}

export async function GET(request: NextRequest) {
  const address = new URL(request.url).searchParams.get("address");
  if (!address) return NextResponse.json({ error: "address is required" }, { status: 400 });
  try {
    const [balance, tokens] = await Promise.all([
      rpc("getBalance", [address, { commitment: "confirmed" }]),
      rpc("getTokenAccountsByOwner", [address, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed", commitment: "confirmed" }]),
    ]);
    const assets = (tokens.value || []).map((account: any) => {
      const info = account.account.data.parsed.info;
      return { mint: info.mint, amount: info.tokenAmount.amount, decimals: info.tokenAmount.decimals, uiAmount: info.tokenAmount.uiAmount };
    });
    return NextResponse.json({ address, sol: balance.value / 1_000_000_000, assets });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Portfolio unavailable" }, { status: 502 });
  }
}
