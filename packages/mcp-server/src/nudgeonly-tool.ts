// NudgeOnlyAPI is the PinballWake red-lane helper for painpoint hints only.
// It can summarize, flag, and suggest checks, but it must never decide or write.

import { createHash } from "node:crypto";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "liquid/lfm-2.5-1.2b-instruct:free";
const NUDGEONLY_OPENROUTER_ALLOW_PAID_FLAG = "NUDGEONLY_OPENROUTER_ALLOW_PAID";
const DEFAULT_MAX_TOKENS = 260;
const MAX_INPUT_CHARS = 6000;
const PAINPOINT_TYPES = [
  "stale_ack",
  "duplicate_wake",
  "unclear_owner",
  "queue_hydration_failure",
  "noisy_thread",
  "missing_proof",
  "none",
] as const;

const PAINPOINT_CATALOG = [
  {
    type: "stale_ack",
    label: "Stale ACK",
    watch: ["WakePass", "dispatches", "PR review handoffs", "quiet seats"],
    cue: "A wake, handoff, or review is visible but the expected acknowledgement is stale or absent.",
    verifier: "Run the WakePass ACK verifier against the source dispatch or PR.",
  },
  {
    type: "duplicate_wake",
    label: "Duplicate Wake",
    watch: ["WakePass", "dispatches", "issues", "PRs"],
    cue: "Two or more wake records point at the same target, owner, and unresolved action.",
    verifier: "Compare source IDs, target URLs, owners, and timestamps before consolidating.",
  },
  {
    type: "unclear_owner",
    label: "Unclear Owner",
    watch: ["Orchestrator handoff", "active jobs", "seat status", "Fishbowl"],
    cue: "The system can see a blocker, but the next owner or next receipt is not obvious.",
    verifier: "Run an owner resolver or inspect the latest promoted handoff receipt.",
  },
  {
    type: "missing_proof",
    label: "Missing Proof",
    watch: ["completed WakePass", "done messages", "PR closure", "session summaries"],
    cue: "A task claims done/completed, but the compact state lacks a proof pointer.",
    verifier: "Check for a linked PR, commit, receipt ID, run ID, or source pointer.",
  },
  {
    type: "queue_hydration_failure",
    label: "Queue Hydration Failure",
    watch: ["active jobs", "actionable todos", "open todos", "dispatches", "Boardroom"],
    cue: "The system reports zero active jobs while actionable backlog still exists.",
    verifier: "Compare Orchestrator active job count against list_actionable_todos, open/in_progress todos, and recent dispatches.",
  },
  {
    type: "noisy_thread",
    label: "Noisy Thread",
    watch: ["heartbeats", "admin Orchestrator", "conversation turns", "Fishbowl"],
    cue: "Repeated low-signal messages hide the actual current state or next action.",
    verifier: "Count repeated heartbeats or near-duplicate turns, then collapse to the latest material state.",
  },
  {
    type: "none",
    label: "Healthy Control",
    watch: ["completed events", "fresh receipts"],
    cue: "The event is healthy, completed, or informational and has no explicit painpoint signal.",
    verifier: "Do not alert. Keep it as a control case for false-positive checks.",
  },
] as const;

const ROLLOUT_SURFACES = [
  {
    surface: "PinballWake/WakePass",
    use: "Flag stale ACKs, duplicate wakes, and missing proof before they become invisible queue drag.",
  },
  {
    surface: "Orchestrator state cards",
    use: "Turn blocker summaries into plain-English painpoint nudges with trace IDs.",
  },
  {
    surface: "Heartbeat and Signals",
    use: "Separate info-only pulse noise from action-needed painpoints.",
  },
  {
    surface: "Fishbowl and Boardroom handoffs",
    use: "Spot unclear owners, repeated asks, and handoff loops without assigning authority.",
  },
  {
    surface: "Agent Observability",
    use: "Feed trend counts for stale ACKs, duplicate wakes, missing proof, and noisy threads.",
  },
  {
    surface: "Admin Orchestrator UX",
    use: "Show the nudge as red-lane evidence below the source message, not as source-of-truth state.",
  },
] as const;

const ORCHESTRATOR_ISSUE_MAP = [
  {
    issue: "Properties overload or hard-to-read status blocks",
    bucket: "noisy_thread",
    nudge: "Collapse secondary metadata and keep the main chat message as the first read.",
    verifier: "Count visible metadata fields per message and compare against the primary message length.",
  },
  {
    issue: "Simple-English summary is too short and loses context",
    bucket: "missing_proof",
    nudge: "Ask for the source receipt, PR, commit, or dispatch pointer to stay visible with the summary.",
    verifier: "Check that every short summary carries a source pointer or proof ID.",
  },
  {
    issue: "Blockers visible but no active owning job",
    bucket: "unclear_owner",
    nudge: "Surface the next owner and next expected receipt beside the blocker.",
    verifier: "Compare active blocker count against active job and owner fields.",
  },
  {
    issue: "Backlog exists but Orchestrator shows zero active jobs",
    bucket: "queue_hydration_failure",
    nudge: "Mirror the backlog counts into PinballWake JobHunt Mirror and wake the existing Jobs Worker after verifier-backed receipt_bridge output.",
    verifier: "Compare active jobs against actionable todos, open/in_progress todos, and recent dispatch or Boardroom work.",
  },
  {
    issue: "Repeated heartbeat noise hides useful work",
    bucket: "noisy_thread",
    nudge: "Collapse repeated heartbeat receipts into a latest-state line unless action is needed.",
    verifier: "Count repeated heartbeat turns without a material status change.",
  },
  {
    issue: "WakePass or review handoff is stale",
    bucket: "stale_ack",
    nudge: "Flag the stale handoff as a painpoint, then run the WakePass ACK verifier.",
    verifier: "Check latest ACK timestamp against the handoff TTL.",
  },
  {
    issue: "Done/completed state lacks proof",
    bucket: "missing_proof",
    nudge: "Keep the done state visually quiet until a proof pointer exists.",
    verifier: "Check for a commit, PR, run ID, receipt ID, or source pointer.",
  },
] as const;

const WORKER_NUDGE_MAP = [
  {
    worker: "Continuous Improver",
    watches: ["quiet improvement loop", "no recent improvement proposal", "repeated same bottleneck"],
    bucket: "unclear_owner",
    nudge: "Ask for the next tiny improvement candidate and expected proof, not a broad redesign.",
    verifier: "Check for a recent improvement proposal, experiment result, or shipped follow-up.",
  },
  {
    worker: "Job Manager",
    watches: ["blockers without active jobs", "jobs without next action", "orphaned todos"],
    bucket: "unclear_owner",
    nudge: "Ask for the owning job, next safe action, and expected receipt.",
    verifier: "Compare active blockers against active jobs and assigned owner fields.",
  },
  {
    worker: "Reviewer",
    watches: ["ready PRs without review ACK", "stale review handoff", "review requested but no receipt"],
    bucket: "stale_ack",
    nudge: "Ask for review ACK or a clear blocker receipt.",
    verifier: "Run WakePass ACK check against the PR/review dispatch.",
  },
  {
    worker: "Builder",
    watches: ["implementation started but no commit", "claimed done without proof", "missing PR"],
    bucket: "missing_proof",
    nudge: "Ask for commit, PR, run ID, or blocker receipt.",
    verifier: "Check linked commit, branch, PR, or test result.",
  },
  {
    worker: "Heartbeat Seat",
    watches: ["repeated healthy pulses", "heartbeat noise", "missing PASS/BLOCKER receipt"],
    bucket: "noisy_thread",
    nudge: "Ask for only the material diff or a compact PASS/BLOCKER receipt.",
    verifier: "Compare latest heartbeat content against prior state and count material changes.",
  },
  {
    worker: "Agent Observability",
    watches: ["unexplained worker silence", "missing decision trace", "no reliability trend"],
    bucket: "missing_proof",
    nudge: "Ask for the trace ID, owner, decision, and reliability proof.",
    verifier: "Check observability logs for decision trace, receipt, and worker status.",
  },
] as const;

const QUALITY_GATES = [
  "Do not invent facts, owners, sources, statuses, or proof.",
  "Do not alert from model vibes alone; require source text plus a concrete painpoint cue.",
  "Prefer false negatives over false positives when evidence is weak.",
  "If source_id and source_url are both missing, return a nudge as advisory only and keep requires_verifier=true.",
  "Healthy/completed/info-only controls must stay quiet unless the input explicitly says proof is missing, ACK is stale, ownership is unclear, wake is duplicated, or thread noise is hiding state.",
  "Every alert must name a deterministic verifier before action.",
] as const;

const RECEIPT_BRIDGE_RULES = [
  "NudgeOnly can suggest a receipt request, but it cannot write it, assign ownership, or mark the target done.",
  "A bridge request requires a concrete painpoint plus source evidence.",
  "If the source has no owner, route only to Job Manager for owner resolution.",
  "If proof or ACK is overdue past the TTL, emit an escalation request instead of pretending the work moved.",
  "WakePass or another deterministic verifier must confirm ACK/proof before any trusted state changes.",
] as const;

const RECEIPT_ROUTES = [
  {
    painpoint_type: "stale_ack",
    default_worker: "Reviewer",
    expected_receipt: "ACK received, review started, or blocker receipt with reason.",
    verifier: "Run the WakePass ACK verifier against the source dispatch or PR.",
  },
  {
    painpoint_type: "duplicate_wake",
    default_worker: "Job Manager",
    expected_receipt: "Duplicate wake consolidated or separate targets justified.",
    verifier: "Compare source IDs, target URLs, owners, and timestamps before consolidation.",
  },
  {
    painpoint_type: "unclear_owner",
    default_worker: "Job Manager",
    expected_receipt: "Owning job, next safe action, and expected proof receipt.",
    verifier: "Run the owner resolver against the latest promoted handoff and active jobs.",
  },
  {
    painpoint_type: "missing_proof",
    default_worker: "Builder",
    expected_receipt: "Commit, PR, run ID, receipt ID, or blocker receipt.",
    verifier: "Check linked commit, PR, run ID, receipt ID, or source pointer.",
  },
  {
    painpoint_type: "queue_hydration_failure",
    default_worker: "pinballwake-jobs-worker",
    expected_receipt: "Backlog counted, scoped, mirrored, or routed to the existing Job Worker with next safe action.",
    verifier: "Compare active jobs against actionable todos, open/in_progress todos, and recent dispatch or Boardroom work.",
  },
  {
    painpoint_type: "noisy_thread",
    default_worker: "Heartbeat Seat",
    expected_receipt: "Latest material diff or compact PASS/BLOCKER receipt.",
    verifier: "Compare latest heartbeat content against prior state and count material changes.",
  },
] as const;

type OpenRouterRole = "system" | "user" | "assistant";

interface OpenRouterMessage {
  role: OpenRouterRole;
  content: string;
}

interface OpenRouterChatResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
    finish_reason?: string;
  }>;
  usage?: Record<string, unknown>;
}

export const NUDGEONLY_POLICY = {
  official_name: "NudgeOnlyAPI",
  worker_name: "👉Nudge",
  code_name: "NudgeOnly",
  ecosystem: "PinballWake",
  lane: "red_nudge",
  authority: "nudge_only_no_write_no_truth",
  default_model: DEFAULT_MODEL,
  rollout_status: "official",
  rollout_rule: "Run on candidate painpoints only; never run as a decision maker or completion source.",
  painpoint_catalog: PAINPOINT_CATALOG,
  rollout_surfaces: ROLLOUT_SURFACES,
  orchestrator_issue_map: ORCHESTRATOR_ISSUE_MAP,
  worker_nudge_map: WORKER_NUDGE_MAP,
  quality_gates: QUALITY_GATES,
  receipt_bridge: {
    status: "official",
    route_shape: "worker -> target -> painpoint -> expected receipt -> verifier",
    escalation_rule: "If ACK/proof is still missing after the configured TTL, emit an escalation request for the owning lane.",
    rules: RECEIPT_BRIDGE_RULES,
    routes: RECEIPT_ROUTES,
  },
  tested_proof: {
    live_sweep: "12 cases, 0 API errors, 12 useful traceable outputs, 12/12 signal matches, 12/12 painpoint bucket matches, 0 false positives on healthy control.",
    commits: ["8116ae9", "1221b7a", "6d35130"],
  },
  allowed_actions: [
    "summarise noisy events",
    "flag possible painpoints",
    "suggest deterministic checks",
    "rewrite status in simple English",
    "spot likely duplicate or stale handoffs",
  ],
  prohibited_actions: [
    "merge PRs",
    "close blockers",
    "mark work complete",
    "decide ownership",
    "approve changes",
    "call mutation tools",
    "set source-of-truth state",
  ],
  verifier_rule: "Every nudge must be verified by deterministic code or a trusted lane before action.",
} as const;

function apiKeyFrom(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.OPENROUTER_API_KEY ?? "").trim();
  if (!key) {
    throw new Error("api_key is required unless OPENROUTER_API_KEY is set.");
  }
  return key;
}

export function isNudgeOnlyFreeOpenRouterModel(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return normalized.endsWith(":free") || normalized === "openrouter/free" || normalized.startsWith("openrouter/free/");
}

function isExplicitSpendOptIn(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function decideNudgeOnlyOpenRouterCall(args: {
  model?: unknown;
  allow_paid?: unknown;
} = {}) {
  const model = String(args.model ?? process.env.NUDGEONLY_OPENROUTER_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const freeDefault = isNudgeOnlyFreeOpenRouterModel(model);
  const explicitPaid = isExplicitSpendOptIn(args.allow_paid ?? process.env[NUDGEONLY_OPENROUTER_ALLOW_PAID_FLAG]);
  const costTier = freeDefault ? "free" : "paid_or_unknown";

  return {
    allowed: freeDefault || explicitPaid,
    provider: "OpenRouter",
    model,
    cost_tier: costTier,
    default_allowed: freeDefault,
    reason: freeDefault ? "free_default_allowed" : explicitPaid ? "explicit_paid_allowed" : "paid_or_unknown_blocked",
    allow_paid_flag: freeDefault ? undefined : NUDGEONLY_OPENROUTER_ALLOW_PAID_FLAG,
  } as const;
}

function trimInput(value: unknown): string {
  return String(value ?? "").trim().slice(0, MAX_INPUT_CHARS);
}

function asNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "stale_ack", "duplicate_wake", "unclear_owner", "queue_hydration_failure", "missing_proof"].includes(normalized)) {
      return true;
    }
    if (["false", "no", "none", "unknown", ""].includes(normalized)) {
      return false;
    }
  }
  return Boolean(value);
}

function normalisePainpointType(value: unknown): string {
  const raw = String(value ?? "none").trim().toLowerCase();
  return PAINPOINT_TYPES.find((type) => raw.includes(type)) ?? "none";
}

function ackOnlyWakeProof(value: unknown): { original_wake_id: string | null; reason: string } | null {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const originalWakeId = text.match(/\b(wake-[a-z0-9_-]+(?:-[a-z0-9_-]+)*)\b/i)?.[1] ?? null;
  const startsWithAckWake = /^\s*ack\s+wake-/i.test(text);
  if (startsWithAckWake) {
    return { original_wake_id: originalWakeId, reason: "ack_only_comment" };
  }

  const verifierOnly = /\b(ack-only|verifier-only|verifier receipt|ack proof receipt)\b/i.test(text)
    && /\b(no|not|missing|absent|still)\b.{0,80}\b(executor|terminal|build_attempt|pr_proof|done|receipt)\b/i.test(text);
  if (verifierOnly && originalWakeId) {
    return { original_wake_id: originalWakeId, reason: "verifier_only_comment" };
  }

  return null;
}

function supersededStatusProof(value: unknown): { superseded_by: string | null; reason: string } | null {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const historicalStatus = /\b(blocker root-cause update|pass progress|progress from heartbeat|status update|historical status|old blocker|old pass|superseded status)\b/i.test(text);
  if (!historicalStatus) return null;

  const supersededBy = text.match(/\bsuperseded by\b.{0,180}\b((?:pr|pull request)\s*#?\d+|merged|live proof|production proof|publish mcp server proof|later proof)\b/i)?.[1] ?? null;
  const laterProof = /\b(later production proof|current live .*proof|publish mcp server proof|live .*suppresses?)\b/i.test(text);
  if (supersededBy || laterProof) {
    return { superseded_by: supersededBy, reason: "superseded_status_comment" };
  }

  return null;
}

function asOptionalString(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function asStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function parseTime(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function minutesBetween(start: number | null, end: number | null): number | null {
  if (start === null || end === null || end < start) return null;
  return Math.floor((end - start) / 60000);
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }
}

function normaliseNudge(
  parsed: Record<string, unknown> | null,
  raw: string,
  painpointHint: string,
): Record<string, unknown> {
  const parsedType = normalisePainpointType(parsed?.painpoint_type);
  const hintedType = normalisePainpointType(painpointHint);
  const explicitNoneHint = painpointHint.trim().length > 0 && hintedType === "none";
  const requestedType = explicitNoneHint
    ? "none"
    : hintedType === "none" ? parsedType : hintedType;
  const rawDetected = asBoolean(parsed?.painpoint_detected ?? false);
  const painpointDetected = requestedType === "none"
    ? false
    : rawDetected || parsedType !== "none" || hintedType !== "none";
  const painpointType = painpointDetected ? requestedType : "none";

  return {
    worker: NUDGEONLY_POLICY.worker_name,
    official_name: NUDGEONLY_POLICY.official_name,
    code_name: NUDGEONLY_POLICY.code_name,
    ecosystem: NUDGEONLY_POLICY.ecosystem,
    lane: NUDGEONLY_POLICY.lane,
    authority: NUDGEONLY_POLICY.authority,
    painpoint_detected: painpointDetected,
    painpoint_type: painpointType,
    nudge: String(parsed?.nudge ?? raw).slice(0, 1200),
    suggested_check: String(parsed?.suggested_check ?? "Run a deterministic verifier before taking action.").slice(0, 600),
    confidence: String(parsed?.confidence ?? "low"),
    requires_verifier: true,
    allowed_actions: NUDGEONLY_POLICY.allowed_actions,
    prohibited_actions: NUDGEONLY_POLICY.prohibited_actions,
  };
}

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function evidenceText(args: Record<string, unknown>, nudge: Record<string, unknown>): string {
  return [
    args.event_text,
    args.context,
    args.source_id,
    args.source_url,
    args.target,
    args.owner,
    args.worker,
    args.ack_status,
    args.proof_status,
    nudge.nudge,
    nudge.suggested_check,
    nudge.source_id,
    nudge.source_url,
  ].map((part) => String(part ?? "").toLowerCase()).join(" ");
}

function hasConcreteCue(painpointType: string, text: string): boolean {
  if (painpointType === "none") return false;
  if (painpointType === "stale_ack") return /\b(stale|overdue|missing|absent|no)\b.*\b(ack|receipt|review)\b|\b(ack|receipt|review)\b.*\b(stale|overdue|missing|absent)\b/.test(text);
  if (painpointType === "duplicate_wake") return /\bduplicate|duplicated|same target|same owner|same wake\b/.test(text);
  if (painpointType === "unclear_owner") return /\bunclear owner|no owner|without active job|no active job|orphaned|owner missing|owning job\b/.test(text);
  if (painpointType === "queue_hydration_failure") return /\b(queue hydration failure|0 active jobs|zero active jobs|no active jobs)\b.*\b(backlog|actionable|open|todo|dispatch|boardroom|job)\b|\b(backlog|actionable|open|todo|dispatch|boardroom|job)\b.*\b(0 active jobs|zero active jobs|no active jobs)\b/.test(text);
  if (painpointType === "missing_proof") return /\bmissing proof|no proof|proof missing|without proof|no commit|no pr|no run id|no receipt\b/.test(text);
  if (painpointType === "noisy_thread") return /\bnoise|noisy|repeated|heartbeat|near-duplicate|hides state|collapse\b/.test(text);
  return false;
}

function routeForPainpoint(painpointType: string) {
  return RECEIPT_ROUTES.find((route) => route.painpoint_type === painpointType);
}

function targetFrom(args: Record<string, unknown>, nudge: Record<string, unknown>): string | null {
  return asOptionalString(args.target)
    ?? asOptionalString(args.source_url)
    ?? asOptionalString(nudge.source_url)
    ?? asOptionalString(args.source_id)
    ?? asOptionalString(nudge.source_id);
}

function workerFrom(args: Record<string, unknown>, painpointType: string, routeWorker: string): string {
  const explicitWorker = asOptionalString(args.worker);
  const owner = asOptionalString(args.owner);
  if (painpointType === "queue_hydration_failure") return "pinballwake-jobs-worker";
  if (painpointType === "unclear_owner" || !owner) return "Job Manager";
  return explicitWorker ?? routeWorker;
}

function proofOrAckMissing(args: Record<string, unknown>, painpointType: string): boolean {
  const ackStatus = asStatus(args.ack_status);
  const proofStatus = asStatus(args.proof_status);
  const ackMissing = !ackStatus || ["missing", "absent", "stale", "overdue", "failed", "none"].includes(ackStatus);
  const proofMissing = !proofStatus || ["missing", "absent", "stale", "overdue", "failed", "none"].includes(proofStatus);
  if (painpointType === "stale_ack") return ackMissing;
  if (painpointType === "missing_proof") return proofMissing;
  return ackMissing || proofMissing;
}

function bridgeStatus(args: Record<string, unknown>, painpointType: string): string {
  const ttlMinutes = asNumber(args.ttl_minutes, 60);
  const createdAt = parseTime(args.created_at);
  const now = parseTime(args.now) ?? Date.now();
  const ageMinutes = minutesBetween(createdAt, now);
  const missing = proofOrAckMissing(args, painpointType);
  const shouldEscalate = missing && ageMinutes !== null && ageMinutes >= ttlMinutes;
  return shouldEscalate ? "escalation_request" : "receipt_request";
}

async function openRouterPost<T>(apiKey: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${OPENROUTER_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-OpenRouter-Title": NUDGEONLY_POLICY.official_name,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as Record<string, unknown> | undefined;
    const msg = (err?.message as string) ?? `HTTP ${res.status}`;
    throw new Error(`OpenRouter NudgeOnlyAPI error: ${msg}`);
  }
  return data as T;
}

export async function nudgeonlyPolicy(_args: Record<string, unknown>): Promise<unknown> {
  return NUDGEONLY_POLICY;
}

export async function nudgeonlyReceiptBridge(args: Record<string, unknown>): Promise<unknown> {
  const nudge = recordFrom(args.nudge_result);
  const painpointType = normalisePainpointType(args.painpoint_type ?? nudge.painpoint_type ?? args.painpoint_hint);
  const detected = asBoolean(args.painpoint_detected ?? nudge.painpoint_detected ?? painpointType);
  const sourceId = asOptionalString(args.source_id) ?? asOptionalString(nudge.source_id);
  const sourceUrl = asOptionalString(args.source_url) ?? asOptionalString(nudge.source_url);
  const target = targetFrom(args, nudge);
  const route = routeForPainpoint(painpointType);
  const text = evidenceText(args, nudge);
  const hasSourceEvidence = Boolean(sourceId || sourceUrl || target);
  const hasCue = hasConcreteCue(painpointType, text);
  const ackOnlyProof = ackOnlyWakeProof(args.event_text ?? args.context ?? nudge.nudge);
  const supersededProof = supersededStatusProof(text);
  const traceInput = JSON.stringify({
    painpoint_type: painpointType,
    source_id: sourceId,
    source_url: sourceUrl,
    target,
    owner: asOptionalString(args.owner),
    worker: asOptionalString(args.worker),
    nudge_trace_id: asOptionalString(args.nudge_trace_id) ?? asOptionalString(nudge.trace_id),
  });
  const bridgeId = `nudgebridge_${shortHash(traceInput)}`;

  if (ackOnlyProof) {
    return {
      bridge_id: bridgeId,
      bridge_status: "suppress",
      worker: NUDGEONLY_POLICY.worker_name,
      official_name: NUDGEONLY_POLICY.official_name,
      code_name: NUDGEONLY_POLICY.code_name,
      ecosystem: NUDGEONLY_POLICY.ecosystem,
      authority: NUDGEONLY_POLICY.authority,
      painpoint_detected: false,
      painpoint_type: "none",
      suppressed_painpoint_type: painpointType,
      suppression: {
        ...ackOnlyProof,
        source_id: sourceId,
        source_url: sourceUrl,
        target,
      },
      reason: "ACK-only or verifier-only WakePass comments are proof metadata for the original wake, not fresh wake requests.",
      quality_gate: "duplicate ACK wake suppression",
      requires_verifier: true,
      allowed_actions: ["record suppress receipt", "attach proof metadata to original wake"],
      prohibited_actions: NUDGEONLY_POLICY.prohibited_actions,
    };
  }

  if (supersededProof) {
    return {
      bridge_id: bridgeId,
      bridge_status: "suppress",
      worker: NUDGEONLY_POLICY.worker_name,
      official_name: NUDGEONLY_POLICY.official_name,
      code_name: NUDGEONLY_POLICY.code_name,
      ecosystem: NUDGEONLY_POLICY.ecosystem,
      authority: NUDGEONLY_POLICY.authority,
      painpoint_detected: false,
      painpoint_type: "none",
      suppressed_painpoint_type: painpointType,
      suppression: {
        ...supersededProof,
        source_id: sourceId,
        source_url: sourceUrl,
        target,
      },
      reason: "Historical heartbeat PASS/BLOCKER status that is superseded by later proof is proof metadata, not a fresh blocker.",
      quality_gate: "superseded status suppression",
      requires_verifier: true,
      allowed_actions: ["record suppress receipt", "attach proof metadata to superseding proof"],
      prohibited_actions: NUDGEONLY_POLICY.prohibited_actions,
    };
  }

  if (!detected || painpointType === "none") {
    return {
      bridge_id: bridgeId,
      bridge_status: "quiet",
      painpoint_detected: false,
      painpoint_type: "none",
      reason: "No painpoint was detected, so no worker receipt request was created.",
      quality_gate: "healthy controls stay quiet",
      requires_verifier: true,
    };
  }

  if (!route || !hasSourceEvidence || !hasCue) {
    return {
      bridge_id: bridgeId,
      bridge_status: "advisory_only",
      painpoint_detected: detected,
      painpoint_type: painpointType,
      reason: "The bridge did not find enough deterministic evidence to route a worker receipt request.",
      missing: {
        source_evidence: !hasSourceEvidence,
        concrete_cue: !hasCue,
      },
      quality_gate: "prefer false negatives over false positives",
      requires_verifier: true,
    };
  }

  const owner = asOptionalString(args.owner);
  const worker = workerFrom(args, painpointType, route.default_worker);
  const status = bridgeStatus(args, painpointType);
  const nudgeTraceId = asOptionalString(args.nudge_trace_id) ?? asOptionalString(nudge.trace_id);
  const request = {
    worker,
    owner: owner ?? null,
    target,
    painpoint_type: painpointType,
    expected_receipt: route.expected_receipt,
    verifier: route.verifier,
    receipt_line: `${worker} -> ${target} -> ${painpointType} -> ${route.expected_receipt} -> ${route.verifier}`,
  };

  return {
    bridge_id: bridgeId,
    bridge_status: status,
    worker: NUDGEONLY_POLICY.worker_name,
    official_name: NUDGEONLY_POLICY.official_name,
    code_name: NUDGEONLY_POLICY.code_name,
    ecosystem: NUDGEONLY_POLICY.ecosystem,
    authority: NUDGEONLY_POLICY.authority,
    painpoint_detected: true,
    painpoint_type: painpointType,
    request,
    escalation: status === "escalation_request"
      ? {
          escalate_to: "WakePass",
          reason: "ACK or proof is still missing after the configured TTL.",
          verifier: route.verifier,
        }
      : null,
    evidence: {
      bridge_id: bridgeId,
      nudge_trace_id: nudgeTraceId,
      source_id: sourceId,
      source_url: sourceUrl,
      target,
      verifier_required: true,
      verifier_rule: NUDGEONLY_POLICY.verifier_rule,
      quality_gates: RECEIPT_BRIDGE_RULES,
    },
    requires_verifier: true,
    allowed_actions: ["emit worker receipt request", "emit escalation request", "run deterministic verifier"],
    prohibited_actions: NUDGEONLY_POLICY.prohibited_actions,
  };
}

export async function nudgeonlyApi(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = apiKeyFrom(args);
  const eventText = trimInput(args.event_text);
  if (!eventText) throw new Error("event_text is required.");

  const context = trimInput(args.context);
  const painpointHint = trimInput(args.painpoint_hint);
  const sourceId = trimInput(args.source_id);
  const sourceUrl = trimInput(args.source_url);
  const providerDecision = decideNudgeOnlyOpenRouterCall({
    model: args.model,
    allow_paid: args.allow_paid,
  });
  if (!providerDecision.allowed) {
    throw new Error(
      `NudgeOnly OpenRouter model ${providerDecision.model} is paid or unknown. Set ${NUDGEONLY_OPENROUTER_ALLOW_PAID_FLAG}=1 or pass allow_paid=true to use non-free models.`,
    );
  }
  const model = providerDecision.model;
  const maxTokens = Math.min(asNumber(args.max_tokens, DEFAULT_MAX_TOKENS), 500);
  const inputDigest = shortHash(JSON.stringify({
    event_text: eventText,
    context,
    painpoint_hint: painpointHint,
    source_id: sourceId,
    source_url: sourceUrl,
  }));
  const traceId = `nudgeonly_${inputDigest}`;

  const system = [
    `You are ${NUDGEONLY_POLICY.worker_name}, the ${NUDGEONLY_POLICY.official_name} worker.`,
    "You are a red-lane, low-authority helper for painpoint hints only.",
    "You must never decide, approve, merge, close, mark done, assign ownership, or set truth.",
    "You must never invent facts, owners, statuses, proof, source IDs, or source URLs.",
    "Quality is more important than coverage. Prefer false negatives over false positives when evidence is weak.",
    "Do not use hidden reasoning. Spend tokens on the final JSON fields.",
    "Use exactly one painpoint_type from: stale_ack, duplicate_wake, unclear_owner, queue_hydration_failure, noisy_thread, missing_proof, none.",
    "If the event is healthy or completed and has no explicit stale, duplicate, unclear owner, queue hydration failure, noisy thread, or missing proof signal, return painpoint_detected=false and painpoint_type=none.",
    "The suggested_check must be concrete and name the source type, such as WakePass, dispatch, PR, issue, proof pointer, or heartbeat count.",
    "Use only cautious language: possible, likely, suggest checking, may need.",
    "Return JSON only. Do not include markdown.",
  ].join(" ");

  const user = JSON.stringify({
    task: "Classify this event as a painpoint nudge only.",
    required_output: {
      painpoint_detected: "boolean",
      painpoint_type: "short string such as stale_ack, duplicate_wake, unclear_owner, queue_hydration_failure, noisy_thread, missing_proof, none",
      nudge: "one or two specific plain-English sentences naming the possible painpoint",
      suggested_check: "one specific deterministic check a trusted lane should run",
      confidence: "low | medium | high",
    },
    hard_limits: NUDGEONLY_POLICY.prohibited_actions,
    trace_id: traceId,
    source_id: sourceId,
    source_url: sourceUrl,
    event_text: eventText,
    context,
    painpoint_hint: painpointHint,
  });

  const messages: OpenRouterMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  const result = await openRouterPost<OpenRouterChatResponse>(apiKey, "/chat/completions", {
    model,
    messages,
    temperature: 0.1,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
  });

  const raw = result.choices?.[0]?.message?.content ?? "";
  const parsed = extractJsonObject(raw);

  return {
    ...normaliseNudge(parsed, raw, painpointHint),
    trace_id: traceId,
    source_id: sourceId || null,
    source_url: sourceUrl || null,
    input_digest: inputDigest,
    evidence: {
      trace_id: traceId,
      input_digest: inputDigest,
      source_id: sourceId || null,
      source_url: sourceUrl || null,
      router: "OpenRouter",
      requested_model: model,
      resolved_model: result.model ?? model,
      provider_decision: providerDecision,
      openrouter_id: result.id ?? null,
      verifier_required: true,
      verifier_rule: NUDGEONLY_POLICY.verifier_rule,
      authority: NUDGEONLY_POLICY.authority,
    },
    model: result.model ?? model,
    openrouter_id: result.id ?? null,
    finish_reason: result.choices?.[0]?.finish_reason ?? null,
    usage: result.usage ?? null,
  };
}
