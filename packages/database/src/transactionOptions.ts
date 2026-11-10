export const DEFAULT_DB_TX_MAX_WAIT_MS = 10_000;
export const DEFAULT_DB_TX_TIMEOUT_MS = 30_000;

function positiveInteger(raw: string | undefined, fallback: number): number {
  if (raw === undefined || !/^\d+$/.test(raw.trim())) return fallback;
  const value = Number(raw.trim());
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

/**
 * Client-level interactive transaction defaults (Prisma's own defaults are 2 s maxWait and
 * 5 s timeout, too tight for combat round-end chains on Azure). Per-call options still win.
 */
export function buildTransactionOptions(env: NodeJS.ProcessEnv = process.env): {
  maxWait: number;
  timeout: number;
} {
  return {
    maxWait: positiveInteger(env.GLANTRI_DB_TX_MAX_WAIT_MS, DEFAULT_DB_TX_MAX_WAIT_MS),
    timeout: positiveInteger(env.GLANTRI_DB_TX_TIMEOUT_MS, DEFAULT_DB_TX_TIMEOUT_MS),
  };
}
