const DEFAULT_MEMORY_QUOTA_EXEMPT_EMAILS = ["creativelead@malamutemayhem.com"];

function normalizeEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}

function quotaExemptEmails(raw = process.env.UNCLICK_MEMORY_QUOTA_EXEMPT_EMAILS ?? ""): Set<string> {
  const emails = new Set(DEFAULT_MEMORY_QUOTA_EXEMPT_EMAILS);
  for (const item of raw.split(",")) {
    const normalized = normalizeEmail(item);
    if (normalized) emails.add(normalized);
  }
  return emails;
}

export function isMemoryQuotaExemptEmail(
  email: string | null | undefined,
  rawAllowlist = process.env.UNCLICK_MEMORY_QUOTA_EXEMPT_EMAILS ?? "",
): boolean {
  const normalized = normalizeEmail(email);
  return normalized ? quotaExemptEmails(rawAllowlist).has(normalized) : false;
}

export function effectiveMemoryTier(
  tier: string | null | undefined,
  email: string | null | undefined,
): string {
  if (isMemoryQuotaExemptEmail(email)) return "owner";
  return tier?.trim().toLowerCase() || "free";
}

export function shouldEnforceManagedMemoryCaps(input: {
  tenancyMode: "byod" | "managed";
  tier: string | null | undefined;
  accountEmail?: string | null;
  quotaExempt?: boolean;
}): boolean {
  if (input.tenancyMode !== "managed") return false;
  if (input.quotaExempt === true) return false;
  if (isMemoryQuotaExemptEmail(input.accountEmail)) return false;
  return (input.tier?.trim().toLowerCase() || "free") === "free";
}
