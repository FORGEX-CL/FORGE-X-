export type LaunchStage =
  | "TOKEN_CREATED"
  | "METADATA_CONFIRMED"
  | "AUTHORITIES_REVOKED"
  | "DEV_BUY_CONFIRMED"
  | "PUBLIC_TRADING"
  | "GRADUATED"
  | "POOL_CONFIRMED";

const ORDER: LaunchStage[] = [
  "TOKEN_CREATED",
  "METADATA_CONFIRMED",
  "AUTHORITIES_REVOKED",
  "DEV_BUY_CONFIRMED",
  "PUBLIC_TRADING",
  "GRADUATED",
  "POOL_CONFIRMED",
];

export function validateLaunchProgress(completed: LaunchStage[]): { ok: boolean; missing: LaunchStage[] } {
  const set = new Set(completed);
  const missing = ORDER.filter((stage) => !set.has(stage));
  const highestCompleted = Math.max(-1, ...completed.map((stage) => ORDER.indexOf(stage)));
  const outOfOrder = completed.some((stage) => ORDER.indexOf(stage) > highestCompleted);
  return { ok: missing.length === 0 && !outOfOrder, missing };
}

export function nextLaunchStage(completed: LaunchStage[]): LaunchStage | null {
  return ORDER.find((stage) => !completed.includes(stage)) ?? null;
}
