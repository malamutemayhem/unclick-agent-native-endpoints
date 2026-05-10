// NudgeOnlyAPI is the PinballWake red-lane helper for painpoint hints only.
// It can summarize, flag, and suggest checks, but it must never decide or write.

import { createHash } from "node:crypto";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "liquid/lfm-2.5-1.2b-instruct:free";
const DEFAULT_MAX_TOKENS = 260;
const MAX_INPUT_CHARS = 6000;
const PAINPOINT_TYPES = [
  "stale_ack",
  "duplicate_wake",
  "unclear_owner",
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
    if (["true", "yes", "stale_ack", "duplicate_wake", "unclear_owner", "missing_proof"].includes(normalized)) {
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

export async function nudgeonlyApi(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = apiKeyFrom(args);
  const eventText = trimInput(args.event_text);
  if (!eventText) throw new Error("event_text is required.");

  const context = trimInput(args.context);
  const painpointHint = trimInput(args.painpoint_hint);
  const sourceId = trimInput(args.source_id);
  const sourceUrl = trimInput(args.source_url);
  const model = String(args.model ?? process.env.NUDGEONLY_OPENROUTER_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;
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
    "Do not use hidden reasoning. Spend tokens on the final JSON fields.",
    "Use exactly one painpoint_type from: stale_ack, duplicate_wake, unclear_owner, noisy_thread, missing_proof, none.",
    "If the event is healthy or completed and has no explicit stale, duplicate, unclear owner, noisy thread, or missing proof signal, return painpoint_detected=false and painpoint_type=none.",
    "The suggested_check must be concrete and name the source type, such as WakePass, dispatch, PR, issue, proof pointer, or heartbeat count.",
    "Use only cautious language: possible, likely, suggest checking, may need.",
    "Return JSON only. Do not include markdown.",
  ].join(" ");

  const user = JSON.stringify({
    task: "Classify this event as a painpoint nudge only.",
    required_output: {
      painpoint_detected: "boolean",
      painpoint_type: "short string such as stale_ack, duplicate_wake, unclear_owner, noisy_thread, missing_proof, none",
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
