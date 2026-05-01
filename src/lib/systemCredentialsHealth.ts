export type SystemCredentialStatus =
  | "healthy"
  | "untested"
  | "failing"
  | "stale"
  | "needs_rotation";

export interface CredentialHealthInput {
  platform: string;
  label: string | null;
  is_valid: boolean;
  last_tested_at: string | null;
  last_used_at: string | null;
  last_rotated_at: string | null;
  connector: {
    name: string;
    category: string;
  } | null;
}

export interface SystemCredentialCatalogItem {
  id: string;
  name: string;
  platformSlugs: string[];
  expectedFields: string[];
  usedBy: string[];
  rotationNote: string;
  probeSupported: boolean;
}

export interface SystemCredentialHealthRow extends SystemCredentialCatalogItem {
  owner: string;
  status: SystemCredentialStatus;
  statusLabel: string;
  lastCheckedAt: string | null;
  lastRotatedAt: string | null;
  matchedCredentialCount: number;
  matchedCredentialLabels: string[];
}

export const SYSTEM_CREDENTIAL_STALE_DAYS = 30;
export const SYSTEM_CREDENTIAL_ROTATION_DAYS = 90;

export const SYSTEM_CREDENTIAL_CATALOG: SystemCredentialCatalogItem[] = [
  {
    id: "testpass",
    name: "TestPass API key",
    platformSlugs: ["testpass", "unclick"],
    expectedFields: ["api_key", "token"],
    usedBy: ["TestPass PR checks", "scheduled TestPass", "Dogfood receipt runner"],
    rotationNote: "Rotate the repo secret, rerun TestPass PR Check, then rerun the nightly dogfood receipt.",
    probeSupported: false,
  },
  {
    id: "fishbowl",
    name: "Fishbowl admin key",
    platformSlugs: ["fishbowl", "unclick", "supabase"],
    expectedFields: ["api_key", "service_role_key"],
    usedBy: ["Fishbowl posts", "Now Playing status", "todo reconciliation"],
    rotationNote: "Rotate during a quiet window, then verify Fishbowl post, read, and status updates.",
    probeSupported: false,
  },
  {
    id: "openrouter",
    name: "OpenRouter API key",
    platformSlugs: ["openrouter"],
    expectedFields: ["api_key"],
    usedBy: ["model routing", "agent fallback models"],
    rotationNote: "Rotate in BackstagePass, retest the connection, then run one model route smoke test.",
    probeSupported: true,
  },
  {
    id: "vercel",
    name: "Vercel token",
    platformSlugs: ["vercel"],
    expectedFields: ["api_key", "token"],
    usedBy: ["preview deployments", "deployment status", "project automation"],
    rotationNote: "Rotate in Vercel, update BackstagePass, then verify the next preview deployment.",
    probeSupported: true,
  },
  {
    id: "supabase",
    name: "Supabase service key",
    platformSlugs: ["supabase"],
    expectedFields: ["url", "service_role_key", "anon_key"],
    usedBy: ["BackstagePass", "memory admin", "Pass run storage"],
    rotationNote: "Rotate carefully. BackstagePass, Fishbowl, and Pass run APIs depend on this project key.",
    probeSupported: false,
  },
  {
    id: "github",
    name: "GitHub token",
    platformSlugs: ["github"],
    expectedFields: ["api_key", "token"],
    usedBy: ["PR triage", "CI inspection", "repo automation"],
    rotationNote: "Rotate in GitHub, retest the connection, then verify PR list and workflow read access.",
    probeSupported: true,
  },
  {
    id: "posthog",
    name: "PostHog project key",
    platformSlugs: ["posthog"],
    expectedFields: ["api_key", "project_key"],
    usedBy: ["analytics events", "explicit pageviews"],
    rotationNote: "Rotate in PostHog, update BackstagePass, then verify one pageview reaches the project.",
    probeSupported: false,
  },
];

function parseTime(value: string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function newestIso(values: Array<string | null>): string | null {
  let newest: string | null = null;
  let newestTime = -Infinity;
  for (const value of values) {
    const time = parseTime(value);
    if (time !== null && time > newestTime) {
      newest = value;
      newestTime = time;
    }
  }
  return newest;
}

function oldestIso(values: Array<string | null>): string | null {
  let oldest: string | null = null;
  let oldestTime = Infinity;
  for (const value of values) {
    const time = parseTime(value);
    if (time !== null && time < oldestTime) {
      oldest = value;
      oldestTime = time;
    }
  }
  return oldest;
}

function daysSince(value: string | null, now: Date): number | null {
  const time = parseTime(value);
  if (time === null) return null;
  return Math.floor((now.getTime() - time) / 86_400_000);
}

function statusLabel(status: SystemCredentialStatus): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "failing":
      return "Failing";
    case "stale":
      return "Stale";
    case "needs_rotation":
      return "Needs rotation";
    case "untested":
    default:
      return "Untested";
  }
}

export function deriveSystemCredentialStatus(
  credentials: CredentialHealthInput[],
  now = new Date(),
): SystemCredentialStatus {
  if (credentials.length === 0) return "untested";
  if (credentials.some((credential) => !credential.is_valid)) return "failing";

  const oldestRotation = oldestIso(credentials.map((credential) => credential.last_rotated_at));
  const rotationAge = daysSince(oldestRotation, now);
  if (rotationAge !== null && rotationAge >= SYSTEM_CREDENTIAL_ROTATION_DAYS) {
    return "needs_rotation";
  }

  const lastCheckedAt = newestIso(credentials.map((credential) => credential.last_tested_at));
  if (!lastCheckedAt) return "untested";

  const checkedAge = daysSince(lastCheckedAt, now);
  if (checkedAge !== null && checkedAge >= SYSTEM_CREDENTIAL_STALE_DAYS) return "stale";

  return "healthy";
}

export function buildSystemCredentialHealthRows(
  credentials: CredentialHealthInput[],
  ownerEmail: string | null | undefined,
  now = new Date(),
): SystemCredentialHealthRow[] {
  const normalizedOwner = ownerEmail?.trim() || "Current signed-in user";

  return SYSTEM_CREDENTIAL_CATALOG.map((item) => {
    const matches = credentials.filter((credential) =>
      item.platformSlugs.includes(credential.platform),
    );
    const status = deriveSystemCredentialStatus(matches, now);

    return {
      ...item,
      owner: normalizedOwner,
      status,
      statusLabel: statusLabel(status),
      lastCheckedAt: newestIso(matches.map((credential) => credential.last_tested_at)),
      lastRotatedAt: oldestIso(matches.map((credential) => credential.last_rotated_at)),
      matchedCredentialCount: matches.length,
      matchedCredentialLabels: matches.map((credential) =>
        credential.label || credential.connector?.name || credential.platform,
      ),
    };
  });
}
