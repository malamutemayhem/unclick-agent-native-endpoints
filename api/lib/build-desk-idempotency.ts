export type IdempotencyKeyParseResult =
  | { value: string; error?: never }
  | { value?: never; error: string }
  | { value?: undefined; error?: never };

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseBuildDeskIdempotencyKey(value: unknown): IdempotencyKeyParseResult {
  if (value === undefined || value === null) return {};
  if (typeof value !== "string") return { error: "idempotency_key must be a string" };

  const trimmed = value.trim();
  if (!trimmed) return {};
  if (trimmed.length > 256) return { error: "idempotency_key must be at most 256 characters" };
  if (/\s/.test(trimmed)) return { error: "idempotency_key must not contain whitespace" };
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    return { error: "idempotency_key contains invalid control characters" };
  }
  return { value: trimmed };
}

export function getBuildDeskIdempotencyKey(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const parsed = parseBuildDeskIdempotencyKey(payload.idempotency_key);
  return parsed.value ?? null;
}

export function attachBuildDeskIdempotencyKey(payload: unknown, key?: string): unknown {
  if (!key) return payload ?? null;
  if (isRecord(payload)) return { ...payload, idempotency_key: key };
  return { value: payload ?? null, idempotency_key: key };
}

export function findBuildDeskRowByIdempotencyKey<T extends Record<string, unknown>>(
  rows: T[] | null | undefined,
  jsonField: keyof T,
  key: string,
): T | null {
  for (const row of rows ?? []) {
    if (getBuildDeskIdempotencyKey(row[jsonField]) === key) return row;
  }
  return null;
}
