export type TokenRiskInput = {
  name?: string;
  symbol?: string;
  description?: string;
  website?: string;
  socials?: string[];
  creator?: string;
  metadataUri?: string;
};

export type TokenRiskResult = {
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  hold: boolean;
  impersonation: boolean;
  flags: string[];
};

const PROTECTED_BRANDS: Array<{ name: string; domains: string[] }> = [
  { name: "solana", domains: ["solana.com"] },
  { name: "raydium", domains: ["raydium.io"] },
  { name: "jupiter", domains: ["jup.ag", "jupiter.ag"] },
  { name: "metaplex", domains: ["metaplex.com"] },
  { name: "pump", domains: ["pump.fun"] },
  { name: "bonk", domains: ["bonk.fun"] },
  { name: "usdc", domains: ["circle.com"] },
  { name: "usdt", domains: ["tether.to"] },
  { name: "forge x", domains: [] },
];

const IMPERSONATION_TERMS = ["official", "real", "original", "support", "admin", "team", "v2", "v3", "2.0", "copy", "clone", "fork"];

function normalized(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

function hostname(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

export function assessTokenRisk(input: TokenRiskInput): TokenRiskResult {
  const name = normalized(input.name);
  const symbol = normalized(input.symbol);
  const description = normalized(input.description);
  const websiteHost = hostname(input.website);
  const flags: string[] = [];
  let score = 0;
  let impersonation = false;

  if (input.metadataUri) {
    try {
      const metadataUrl = new URL(input.metadataUri);
      if (metadataUrl.protocol !== "https:") {
        score += 20;
        flags.push("Token metadata URI is not HTTPS");
      }
      if (metadataUrl.username || metadataUrl.password) {
        score += 25;
        flags.push("Token metadata URI contains embedded credentials");
      }
    } catch {
      score += 25;
      flags.push("Token metadata URI could not be parsed");
    }
  }
  for (const brand of PROTECTED_BRANDS) {
    const brandKey = normalized(brand.name);
    if (!brandKey) continue;
    const nameCollision = name === brandKey || symbol === brandKey;
    const lookalikeName = name.includes(brandKey) || symbol.includes(brandKey);
    if (nameCollision) {
      score += 85;
      impersonation = true;
      flags.push(`Exact protected-brand collision: ${brand.name}`);
    } else if (lookalikeName) {
      score += 45;
      impersonation = true;
      flags.push(`Protected-brand name collision: ${brand.name}`);
    }

    if (lookalikeName && brand.domains.length > 0 && websiteHost && !brand.domains.includes(websiteHost)) {
      score += 25;
      impersonation = true;
      flags.push(`Brand-like token uses a non-official ${brand.name} website domain`);
    }
  }

  const combined = `${name} ${symbol} ${description}`;
  for (const term of IMPERSONATION_TERMS) {
    if (combined.includes(normalized(term))) {
      score += 8;
      flags.push(`Impersonation-style wording: ${term}`);
    }
  }

  if (input.website && !websiteHost) {
    score += 15;
    flags.push("Website URL could not be parsed");
  }

  if (input.socials?.some((value) => !/^https?:\/\//i.test(value))) {
    score += 5;
    flags.push("One or more social links are not absolute URLs");
  }

  score = Math.min(score, 100);
  const level = score >= 80 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 25 ? "MEDIUM" : "LOW";

  return {
    score,
    level,
    hold: level === "CRITICAL" || impersonation,
    impersonation,
    flags: [...new Set(flags)],
  };
}
