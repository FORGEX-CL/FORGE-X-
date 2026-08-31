const JUPITER_BASE = "https://lite-api.jup.ag/swap/v1";

export type QuoteParams = { inputMint: string; outputMint: string; amount: string; slippageBps?: number };

export async function getJupiterQuote({ inputMint, outputMint, amount, slippageBps = 50 }: QuoteParams) {
  const params = new URLSearchParams({ inputMint, outputMint, amount, slippageBps: String(slippageBps) });
  const response = await fetch(`${JUPITER_BASE}/quote?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Jupiter quote failed: ${response.status}`);
  return response.json();
}
