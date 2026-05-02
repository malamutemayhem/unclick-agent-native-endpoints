export type SystemCredentialProvider = "github" | "vercel";
export type SystemCredentialSource = "github_actions_secret" | "vercel_env";
export type SystemCredentialRisk = "critical" | "high" | "normal";
export type SystemCredentialOwnerConfidence = "known" | "inferred" | "unknown";
export type SystemCredentialDisplayStatus = "untested" | "manual_check_required";

export interface SystemCredentialInventoryEntry {
  provider: SystemCredentialProvider;
  source: SystemCredentialSource;
  name: string;
  scope: string;
  workload: string;
  risk: SystemCredentialRisk;
  expected: boolean;
  docsHint: string;
  rotationImpact?: string;
}

export interface SystemCredentialHealthRow extends SystemCredentialInventoryEntry {
  sourceLabel: string;
  ownerLabel: string;
  ownerConfidence: SystemCredentialOwnerConfidence;
  displayStatus: SystemCredentialDisplayStatus;
  healthEvidenceLabel: string;
  lastCheckedAt: string | null;
  rotationImpactSummary: string;
  safeRotationNotes: readonly string[];
}

const BLOCKED_VALUE_FIELDS = new Set([
  "value",
  "encrypted_value",
  "encryptedValue",
  "vsmValue",
  "legacyValue",
  "secret",
  "token",
  "raw",
]);

const EXCLUDED_NAMES = new Set([
  "GITHUB_TOKEN",
  "VERCEL_URL",
]);

const NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const SECRET_LITERAL_NAME_PATTERNS: readonly RegExp[] = [
  /^AKIA[0-9A-Z]{8,}$/,
  /^gh[pousr]_[a-z0-9]{8,}$/i,
  /^sk-[a-z0-9_-]{8,}$/i,
  /^xox[baprs]-[a-z0-9-]{8,}$/i,
];
const UNSAFE_METADATA_COPY_PATTERN =
  /(authorization:|bearer\s+[a-z0-9._-]{8,}|x-api-key|apikey|api[_ -]?key|refresh[_ -]?token|set-cookie:|cookie:|sk-[a-z0-9_-]{8,}|ghp_[a-z0-9]{8,}|xox[baprs]-[a-z0-9-]{8,})/i;
const UNSAFE_ROTATION_GUIDANCE_PATTERN =
  /\b(auto[- ]?rotate|automatic(?:ally)?\s+rotate|provider\s+(?:write|mutation|update|revoke)|self[- ]?serve\s+rotation|rotate\s+without\s+approval)\b/i;

export const SYSTEM_CREDENTIAL_INVENTORY: readonly SystemCredentialInventoryEntry[] = Object.freeze([
  {
    provider: "github",
    source: "github_actions_secret",
    name: "TESTPASS_TOKEN",
    scope: "repository actions secret",
    workload: "TestPass PR checks",
    risk: "critical",
    expected: true,
    docsHint: "GitHub Actions secret metadata can confirm name and timestamps without returning the value.",
    rotationImpact: "Changing this can block PR TestPass checks until the GitHub Actions secret is updated and a smoke run passes.",
  },
  {
    provider: "github",
    source: "github_actions_secret",
    name: "TESTPASS_CRON_SECRET",
    scope: "repository actions secret",
    workload: "scheduled TestPass smoke",
    risk: "critical",
    expected: true,
    docsHint: "Track by secret name only; scheduled proof should verify the cron gate.",
    rotationImpact: "Changing this can stop scheduled TestPass smoke runs and overnight proof receipts.",
  },
  {
    provider: "github",
    source: "github_actions_secret",
    name: "CRON_SECRET",
    scope: "repository actions secret",
    workload: "scheduled job gates",
    risk: "high",
    expected: true,
    docsHint: "Shared cron gates need rotation notes before any key swap.",
    rotationImpact: "Changing this can break scheduled route gates until every caller uses the new value.",
  },
  {
    provider: "github",
    source: "github_actions_secret",
    name: "UXPASS_TOKEN",
    scope: "repository actions secret",
    workload: "UXPass dogfood and scheduled captures",
    risk: "high",
    expected: true,
    docsHint: "Use dogfood receipts for health evidence; never show the token value.",
  },
  {
    provider: "github",
    source: "github_actions_secret",
    name: "FISHBOWL_WAKE_TOKEN",
    scope: "repository actions secret",
    workload: "Event Wake Router and WakePass handoffs",
    risk: "critical",
    expected: true,
    docsHint: "Wake dispatch proof is the safe health signal.",
    rotationImpact: "Changing this can break WakePass and Fishbowl routing dispatch until the wake router is updated.",
  },
  {
    provider: "github",
    source: "github_actions_secret",
    name: "FISHBOWL_AUTOCLOSE_TOKEN",
    scope: "repository actions secret",
    workload: "Fishbowl todo auto-close on PR merge",
    risk: "high",
    expected: true,
    docsHint: "Auto-close workflow success proves the credential path without exposing it.",
  },
  {
    provider: "github",
    source: "github_actions_secret",
    name: "OPENROUTER_API_KEY",
    scope: "repository actions secret",
    workload: "wake/no-wake classifier and model routing",
    risk: "high",
    expected: true,
    docsHint: "Only static dry-run prompts should be used for future health probes.",
    rotationImpact: "Changing this can disable the wake/no-wake classifier and model routing used by automation.",
  },
  {
    provider: "github",
    source: "github_actions_secret",
    name: "ANTHROPIC_API_KEY",
    scope: "repository actions secret",
    workload: "Claude model workflows",
    risk: "normal",
    expected: false,
    docsHint: "Optional model key; track presence by metadata only.",
  },
  {
    provider: "github",
    source: "github_actions_secret",
    name: "SUPABASE_ACCESS_TOKEN",
    scope: "repository actions secret",
    workload: "Supabase CLI automation",
    risk: "high",
    expected: false,
    docsHint: "Supabase automation should use metadata and successful job evidence only.",
  },
  {
    provider: "github",
    source: "github_actions_secret",
    name: "SUPABASE_PROJECT_REF",
    scope: "repository actions secret",
    workload: "Supabase CLI project targeting",
    risk: "normal",
    expected: false,
    docsHint: "Project references are identifiers, but still useful for ownership mapping.",
  },
  {
    provider: "github",
    source: "github_actions_secret",
    name: "SUPABASE_DB_PASSWORD",
    scope: "repository actions secret",
    workload: "Supabase database automation",
    risk: "critical",
    expected: false,
    docsHint: "Database password rotation needs explicit human approval.",
  },
  {
    provider: "github",
    source: "github_actions_secret",
    name: "VAULT_PLAN_JSON",
    scope: "repository actions secret",
    workload: "vault planning workflows",
    risk: "high",
    expected: false,
    docsHint: "Treat as sensitive structured payload; inventory must never copy the contents.",
  },
  {
    provider: "vercel",
    source: "vercel_env",
    name: "SUPABASE_URL",
    scope: "project environment variable",
    workload: "admin APIs and runtime Supabase access",
    risk: "normal",
    expected: true,
    docsHint: "Vercel metadata may include value-shaped fields; sanitize before display.",
  },
  {
    provider: "vercel",
    source: "vercel_env",
    name: "SUPABASE_SERVICE_ROLE_KEY",
    scope: "project environment variable",
    workload: "privileged admin/server operations",
    risk: "critical",
    expected: true,
    docsHint: "Service-role rotation needs human review and deploy coordination.",
    rotationImpact: "Changing this can break privileged admin and server operations until Vercel runtime env is redeployed.",
  },
  {
    provider: "vercel",
    source: "vercel_env",
    name: "VITE_SUPABASE_URL",
    scope: "project environment variable",
    workload: "browser Supabase configuration",
    risk: "normal",
    expected: true,
    docsHint: "Public runtime names can still help explain which app surface depends on them.",
  },
  {
    provider: "vercel",
    source: "vercel_env",
    name: "VITE_SUPABASE_ANON_KEY",
    scope: "project environment variable",
    workload: "browser Supabase anon access",
    risk: "normal",
    expected: true,
    docsHint: "Anon keys are not service-role secrets, but rotation can still break login flows.",
    rotationImpact: "Changing this can break browser Supabase access until the public runtime env is redeployed.",
  },
  {
    provider: "vercel",
    source: "vercel_env",
    name: "OPENAI_API_KEY",
    scope: "project environment variable",
    workload: "OpenAI model calls",
    risk: "high",
    expected: false,
    docsHint: "Future probes should use read-only model metadata, not user prompts.",
  },
  {
    provider: "vercel",
    source: "vercel_env",
    name: "ANTHROPIC_API_KEY",
    scope: "project environment variable",
    workload: "Claude model calls",
    risk: "high",
    expected: false,
    docsHint: "Track project ownership and last successful model metadata check.",
  },
  {
    provider: "vercel",
    source: "vercel_env",
    name: "OPENROUTER_API_KEY",
    scope: "project environment variable",
    workload: "model routing",
    risk: "high",
    expected: false,
    docsHint: "Inventory by name only; never copy Vercel env values into RotatePass.",
    rotationImpact: "Changing this can break runtime model routing until the deployment picks up the replacement.",
  },
  {
    provider: "vercel",
    source: "vercel_env",
    name: "CRON_SECRET",
    scope: "project environment variable",
    workload: "scheduled route gates",
    risk: "critical",
    expected: true,
    docsHint: "Cron gate changes can break scheduled Pass receipts.",
    rotationImpact: "Changing this can break scheduled route gates and Pass receipts until cron callers are updated.",
  },
  {
    provider: "vercel",
    source: "vercel_env",
    name: "TESTPASS_CRON_USER_ID",
    scope: "project environment variable",
    workload: "scheduled TestPass identity",
    risk: "normal",
    expected: false,
    docsHint: "Identifier only; useful for ownership and blast-radius notes.",
  },
  {
    provider: "vercel",
    source: "vercel_env",
    name: "UXPASS_CRON_USER_ID",
    scope: "project environment variable",
    workload: "scheduled UXPass identity",
    risk: "normal",
    expected: false,
    docsHint: "Identifier only; pair with scheduled receipt status.",
  },
  {
    provider: "vercel",
    source: "vercel_env",
    name: "POSTHOG_API_KEY",
    scope: "project environment variable",
    workload: "analytics capture",
    risk: "normal",
    expected: false,
    docsHint: "Prefer existing analytics receipt evidence over synthetic events.",
    rotationImpact: "Changing this can stop analytics capture until the replacement key is deployed.",
  },
  {
    provider: "vercel",
    source: "vercel_env",
    name: "POSTHOG_HOST",
    scope: "project environment variable",
    workload: "analytics host routing",
    risk: "normal",
    expected: false,
    docsHint: "Host metadata is safe to show when known.",
  },
  {
    provider: "vercel",
    source: "vercel_env",
    name: "STRIPE_SECRET_KEY",
    scope: "project environment variable",
    workload: "payments",
    risk: "critical",
    expected: false,
    docsHint: "Payments credentials require explicit human approval before any rotation work.",
  },
  {
    provider: "vercel",
    source: "vercel_env",
    name: "STRIPE_WEBHOOK_SECRET",
    scope: "project environment variable",
    workload: "payment webhooks",
    risk: "critical",
    expected: false,
    docsHint: "Webhook secret rotation can break payment event verification.",
  },
  {
    provider: "vercel",
    source: "vercel_env",
    name: "RESEND_API_KEY",
    scope: "project environment variable",
    workload: "email delivery",
    risk: "high",
    expected: false,
    docsHint: "Email credential health should use delivery metadata only.",
  },
  {
    provider: "vercel",
    source: "vercel_env",
    name: "ADMIN_NOTIFICATION_EMAIL",
    scope: "project environment variable",
    workload: "admin notifications",
    risk: "normal",
    expected: false,
    docsHint: "Email addresses are metadata, but still avoid broad public display.",
  },
  {
    provider: "vercel",
    source: "vercel_env",
    name: "UMAMI_WEBSITE_ID",
    scope: "project environment variable",
    workload: "analytics",
    risk: "normal",
    expected: false,
    docsHint: "Identifier only; track with analytics health evidence if used.",
  },
  {
    provider: "vercel",
    source: "vercel_env",
    name: "UMAMI_URL",
    scope: "project environment variable",
    workload: "analytics",
    risk: "normal",
    expected: false,
    docsHint: "Host metadata is safe to show when known.",
  },
]);

export function shouldTrackCredentialName(name: string): boolean {
  const trimmed = name.trim();
  const normalized = trimmed.toUpperCase();
  if (!NAME_PATTERN.test(normalized)) return false;
  if (EXCLUDED_NAMES.has(normalized)) return false;
  return !SECRET_LITERAL_NAME_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function hasSecretValueField(record: Record<string, unknown>): boolean {
  return Object.keys(record).some((key) => BLOCKED_VALUE_FIELDS.has(key));
}

export function sanitizeInventoryRecord(record: Record<string, unknown>): SystemCredentialInventoryEntry | null {
  if (hasSecretValueField(record)) return null;
  const name = typeof record.name === "string" ? record.name.trim().toUpperCase() : "";
  if (!shouldTrackCredentialName(name)) return null;
  if (record.provider !== "github" && record.provider !== "vercel") return null;
  if (record.source !== "github_actions_secret" && record.source !== "vercel_env") return null;

  return {
    provider: record.provider,
    source: record.source,
    name,
    scope: typeof record.scope === "string" ? record.scope : "unknown",
    workload: typeof record.workload === "string" ? record.workload : "unknown",
    risk: record.risk === "critical" || record.risk === "high" ? record.risk : "normal",
    expected: record.expected === true,
    docsHint: sanitizeMetadataCopy(record.docsHint, "Metadata only; no secret value is available."),
    rotationImpact: sanitizeMetadataCopy(record.rotationImpact, undefined, {
      forbidAutomationClaims: true,
    }),
  };
}

export function listSystemCredentialInventory(): readonly SystemCredentialInventoryEntry[] {
  return SYSTEM_CREDENTIAL_INVENTORY;
}

export function listSystemCredentialHealthRows(): readonly SystemCredentialHealthRow[] {
  return SYSTEM_CREDENTIAL_INVENTORY.map((entry) => deriveSystemCredentialHealthRow(entry));
}

export function deriveSystemCredentialHealthRow(entry: SystemCredentialInventoryEntry): SystemCredentialHealthRow {
  return {
    ...entry,
    sourceLabel: sourceLabelFor(entry),
    ownerLabel: ownerLabelFor(entry),
    ownerConfidence: ownerConfidenceFor(entry),
    displayStatus: "untested",
    healthEvidenceLabel: healthEvidenceLabelFor(entry),
    lastCheckedAt: null,
    rotationImpactSummary: rotationImpactSummaryFor(entry),
    safeRotationNotes: rotationNotesFor(entry),
  };
}

function sanitizeMetadataCopy(
  value: unknown,
  fallback?: string,
  options?: { forbidAutomationClaims?: boolean },
): string | undefined {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (UNSAFE_METADATA_COPY_PATTERN.test(trimmed)) return fallback;
  if (options?.forbidAutomationClaims && UNSAFE_ROTATION_GUIDANCE_PATTERN.test(trimmed)) return fallback;
  return trimmed;
}

function ownerLabelFor(entry: SystemCredentialInventoryEntry): string {
  switch (entry.source) {
    case "github_actions_secret":
      return "GitHub Actions - malamutemayhem/unclick-agent-native-endpoints";
    case "vercel_env":
      return "Vercel project environment";
  }
}

function ownerConfidenceFor(entry: SystemCredentialInventoryEntry): SystemCredentialOwnerConfidence {
  switch (entry.source) {
    case "github_actions_secret":
      return "inferred";
    case "vercel_env":
      return "unknown";
  }
}

function sourceLabelFor(entry: SystemCredentialInventoryEntry): string {
  switch (entry.source) {
    case "github_actions_secret":
      return "GitHub Actions secret name";
    case "vercel_env":
      return "Vercel environment variable name";
  }
}

function healthEvidenceLabelFor(entry: SystemCredentialInventoryEntry): string {
  const workload = entry.workload.toLowerCase();
  if (entry.name === "TESTPASS_TOKEN") return "Use latest TestPass PR check receipt.";
  if (entry.name === "TESTPASS_CRON_SECRET") return "Use scheduled TestPass smoke receipt.";
  if (entry.name === "UXPASS_TOKEN") return "Use UXPass dogfood capture receipt.";
  if (entry.name === "FISHBOWL_WAKE_TOKEN") return "Use Wake Router dispatch proof.";
  if (entry.name === "FISHBOWL_AUTOCLOSE_TOKEN") return "Use Fishbowl auto-close workflow result.";
  if (entry.name === "OPENROUTER_API_KEY") return "Use static classifier dry-run proof.";
  if (entry.name === "SUPABASE_SERVICE_ROLE_KEY") return "Use human-reviewed admin/server health proof.";
  if (entry.name === "CRON_SECRET") return "Use scheduled route gate receipt.";
  if (workload.includes("analytics")) return "Use analytics receipt evidence.";
  if (workload.includes("payment")) return "Use approved payment webhook proof.";
  if (workload.includes("email")) return "Use delivery metadata evidence.";
  return "No live probe is claimed; use manual metadata review.";
}

function rotationImpactSummaryFor(entry: SystemCredentialInventoryEntry): string {
  return entry.rotationImpact ?? `Changing this can affect ${entry.workload}.`;
}

function rotationNotesFor(entry: SystemCredentialInventoryEntry): readonly string[] {
  const notes = [
    rotationImpactSummaryFor(entry),
    verificationNoteFor(entry),
  ];

  if (entry.risk === "critical") {
    notes.push("Use human review for rotation and keep dependent checks fail-closed.");
  }

  return notes;
}

function verificationNoteFor(entry: SystemCredentialInventoryEntry): string {
  const workload = entry.workload.toLowerCase();
  if (entry.name === "TESTPASS_TOKEN") return "After rotation, rerun the TestPass PR check.";
  if (entry.name === "TESTPASS_CRON_SECRET") return "After rotation, trigger the scheduled TestPass smoke.";
  if (entry.name === "UXPASS_TOKEN") return "After rotation, run the UXPass dogfood capture.";
  if (entry.name === "FISHBOWL_WAKE_TOKEN") return "After rotation, run a dry WakePass route proof.";
  if (entry.name === "FISHBOWL_AUTOCLOSE_TOKEN") return "After rotation, verify the Fishbowl todo auto-close workflow.";
  if (entry.name === "OPENROUTER_API_KEY") return "After rotation, run a static wake classifier dry-run.";
  if (entry.name === "SUPABASE_SERVICE_ROLE_KEY") return "After rotation, verify privileged admin/server health with human review.";
  if (entry.name === "CRON_SECRET") return "After rotation, verify scheduled route gates and Pass receipts.";
  if (workload.includes("analytics")) return "After rotation, confirm analytics receipt evidence.";
  if (workload.includes("payment")) return "After rotation, verify payment webhook handling with explicit approval.";
  if (workload.includes("email")) return "After rotation, verify delivery metadata only.";
  return "After rotation, run the narrowest safe metadata or workflow receipt check.";
}
