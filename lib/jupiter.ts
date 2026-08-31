const JUPITER_BASE = "https://lite-api.jup.ag/swap/v1";

export type QuoteParams = { inputMint: string; outputMint: string; amount: string; slippageBps?: number };

export async function getJupiterQuote({ inputMint, outputMint, amount, slippageBps = 50 }: QuoteParams) {
  const params = new URLSearchParams({ inputMint, outputMint, amount, slippageBps: String(slippageBps) });
  const response = await fetch(`${JUPITER_BASE}/quote?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Jupiter quote failed: ${response.status}`);
  return response.json();
}

export async function buildJupiterSwapTransaction(quoteResponse: unknown, userPublicKey: string) {
  const response = await fetch(`${JUPITER_BASE}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quoteResponse, userPublicKey, dynamicComputeUnitLimit: true, prioritizationFeeLamports: "auto" }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Jupiter swap build failed: ${response.status}`);
  return response.json() as Promise<{ swapTransaction: string; lastValidBlockHeight: number }>;
}
