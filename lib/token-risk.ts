export type TokenRiskInput = {
  name?: string;
  symbol?: string;
  description?: string;
  website?: string;
  socials?: string[];
  creator?: string;
};

export type TokenRiskResult = {
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  hold: boolean;
  impersonation: boolean;
  flags: string[];
};

const RESERVED_BRANDS = [
  "solana",
  "raydium",
  "jupiter",
  "metaplex",
  "pump",
  "bonk",
  "usdc",
  "usdt",
  "wrapped solana",
  "forge x",
];

const IMPERSONATION_TERMS = ["official", "real", "original", "support", "admin", "team", "v2", "v3", "2.0", "copy", "clone", "fork"];

function normalized(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

function hostname(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

export function assessTokenRisk(input: TokenRiskInput): TokenRiskResult {
  const name = normalized(input.name);
  const symbol = normalized(input.symbol);
  const description = normalized(input.description);
  const flags: string[] = [];
  let score = 0;
  let impersonation = false;

  for (const brand of RESERVED_BRANDS) {
    const brandKey = normalized(brand);
    if (!brandKey) continue;
    if (name === brandKey || symbol === brandKey) {
      score += 85;
      impersonation = true;
      flags.push(`Exact protected-brand collision: ${brand}`);
    } else if (name.includes(brandKey) || symbol.includes(brandKey)) {
      score += 45;
      impersonation = true;
      flags.push(`Protected-brand name collision: ${brand}`);
    }
  }

  const combined = `${name} ${symbol} ${description}`;
  for (const term of IMPERSONATION_TERMS) {
    if (combined.includes(normalized(term))) {
      score += 8;
      flags.push(`Impersonation-style wording: ${term}`);
    }
  }

  if (input.website) {
    const host = hostname(input.website);
    if (!host) {
      score += 15;
      flags.push("Website URL could not be parsed");
    } else if (/^https?:\/\/|^www\./.test(input.website) === false) {
      score += 5;
      flags.push("Website uses an unusual URL format");
    }
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
    hold: level === "CRITICAL",
    impersonation,
    flags: [...new Set(flags)],
  };
}
