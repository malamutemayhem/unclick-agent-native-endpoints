export function parseEnvInt(rawValue, { fallback, min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = String(rawValue ?? "").trim();
  if (!/^\d+$/.test(raw)) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(parsed, max));
}

export function readTimingConfig(env = process.env) {
  return {
    pollIntervalMs: parseEnvInt(env.UNCLICK_CHANNEL_POLL, { fallback: 5_000, min: 250, max: 60_000 }),
    apiTimeoutMs: parseEnvInt(env.UNCLICK_API_TIMEOUT_MS, { fallback: 10_000, min: 1_000, max: 120_000 }),
  };
}
