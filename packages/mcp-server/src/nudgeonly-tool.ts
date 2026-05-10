// NudgeOnlyAPI is the PinballWake red-lane helper for painpoint hints only.
// It can summarize, flag, and suggest checks, but it must never decide or write.

import { createHash } from "node:crypto";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "openrouter/free";
const DEFAULT_MAX_TOKENS = 260;
const MAX_INPUT_CHARS = 6000;

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

function normaliseNudge(parsed: Record<string, unknown> | null, raw: string): Record<string, unknown> {
  return {
    worker: NUDGEONLY_POLICY.worker_name,
    official_name: NUDGEONLY_POLICY.official_name,
    code_name: NUDGEONLY_POLICY.code_name,
    ecosystem: NUDGEONLY_POLICY.ecosystem,
    lane: NUDGEONLY_POLICY.lane,
    authority: NUDGEONLY_POLICY.authority,
    painpoint_detected: Boolean(parsed?.painpoint_detected ?? false),
    painpoint_type: String(parsed?.painpoint_type ?? "unknown"),
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
  const model = String(args.model ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;
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
    "Use only cautious language: possible, likely, suggest checking, may need.",
    "Return JSON only. Do not include markdown.",
  ].join(" ");

  const user = JSON.stringify({
    task: "Classify this event as a painpoint nudge only.",
    required_output: {
      painpoint_detected: "boolean",
      painpoint_type: "short string such as stale_ack, duplicate_wake, unclear_owner, noisy_thread, missing_proof, none",
      nudge: "one or two plain-English sentences",
      suggested_check: "one deterministic check a trusted lane should run",
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
    ...normaliseNudge(parsed, raw),
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
