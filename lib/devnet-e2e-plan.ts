export type E2EStep = "launch" | "metadata" | "authorities" | "dev-buy" | "trade" | "graduate" | "pool" | "portfolio";

export const DEVNET_E2E_STEPS: readonly E2EStep[] = [
  "launch", "metadata", "authorities", "dev-buy", "trade", "graduate", "pool", "portfolio",
];

export function validateE2EResult(completed: E2EStep[]) {
  const seen = new Set(completed);
  const missing = DEVNET_E2E_STEPS.filter((step) => !seen.has(step));
  return { passed: missing.length === 0, missing };
}
