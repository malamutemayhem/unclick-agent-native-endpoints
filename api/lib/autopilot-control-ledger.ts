import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const AUTOPILOT_EVENT_TYPES = [
  "claim",
  "lease_grant",
  "lease_refresh",
  "lease_expired",
  "lane_check",
  "lane_violation",
  "release",
  "build_start",
  "build_end",
  "proof_request",
  "proof_result",
  "ack",
  "blocker",
  "merge_decision",
  "watch_start",
  "watch_end",
  "dispatch",
  "pick",
  "todo_state_change",
] as const;

export type AutopilotEventType = (typeof AUTOPILOT_EVENT_TYPES)[number];

export const AUTOPILOT_REF_KINDS = ["todo", "pr", "dispatch", "agent", "run"] as const;
export type AutopilotRefKind = (typeof AUTOPILOT_REF_KINDS)[number];

export interface AutopilotEventInput {
  apiKeyHash: string;
  eventType: AutopilotEventType | string;
  actorAgentId: string;
  refKind: AutopilotRefKind | string;
  refId: string;
  payload?: Record<string, unknown>;
  now?: Date;
}

export interface AutopilotEventRow {
  api_key_hash: string;
  event_type: AutopilotEventType;
  actor_agent_id: string;
  ref_kind: AutopilotRefKind;
  ref_id: string;
  payload: Record<string, unknown>;
  idempotency_key: string;
  created_at: string;
}

export interface TodoLedgerPlanInput {
  todoId: string;
  actorAgentId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  now?: Date;
}

export interface FishbowlPostLedgerInput {
  actorAgentId: string;
  messageId: string;
  threadId?: string | null;
  text: string;
  tags?: string[] | null;
  recipients?: string[] | null;
  now?: Date;
}

export interface AutoPilotKitRecommendationLedgerInput {
  actorAgentId: string;
  refId: string;
  refKind?: AutopilotRefKind | string;
  source?: string;
  recommendations?: Array<Record<string, unknown>> | null;
  now?: Date;
}

const EVENT_TYPE_SET = new Set<string>(AUTOPILOT_EVENT_TYPES);
const REF_KIND_SET = new Set<string>(AUTOPILOT_REF_KINDS);
const SENSITIVE_KEY_RE = /(api[_-]?key|secret|token|password|credential|authorization|cookie)/i;
const SENSITIVE_TEXT_RE =
  /(authorization:\s*bearer\s+\S+|uc_[a-f0-9]{16,}|sk-[a-z0-9_-]{12,}|gh[pousr]_[a-z0-9_]{20,})/i;

function compact(value: unknown, max = 500): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function fiveSecondBucket(date: Date): string {
  return String(Math.floor(date.getTime() / 5000));
}

function normalizeEventType(value: string): AutopilotEventType {
  if (!EVENT_TYPE_SET.has(value)) throw new Error(`Unsupported autopilot event_type: ${value}`);
  return value as AutopilotEventType;
}

function normalizeRefKind(value: string): AutopilotRefKind {
  if (!REF_KIND_SET.has(value)) throw new Error(`Unsupported autopilot ref_kind: ${value}`);
  return value as AutopilotRefKind;
}

function sanitizeUnknown(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY_RE.test(key)) {
    throw new Error(`Autopilot event payload contains sensitive key: ${key}`);
  }
  if (typeof value === "string") {
    const text = compact(value);
    if (SENSITIVE_TEXT_RE.test(text)) {
      throw new Error(`Autopilot event payload contains sensitive text in: ${key}`);
    }
    return text;
  }
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUnknown(key, item));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        sanitizeUnknown(childKey, childValue),
      ]),
    );
  }
  return undefined;
}

function sanitizePayload(payload: Record<string, unknown> = {}): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      throw new Error(`Autopilot event payload contains sensitive key: ${key}`);
    }
    const safeValue = sanitizeUnknown(key, value);
    if (safeValue !== undefined) {
      sanitized[key] = safeValue;
    }
  }
  return sanitized;
}

export function buildAutopilotEventRow(input: AutopilotEventInput): AutopilotEventRow {
  const now = input.now ?? new Date();
  const eventType = normalizeEventType(input.eventType);
  const refKind = normalizeRefKind(input.refKind);
  if (!input.apiKeyHash) throw new Error("api_key_hash required");
  const actorAgentId = compact(input.actorAgentId, 128);
  const refId = compact(input.refId, 160);
  if (!actorAgentId) throw new Error("actor_agent_id required");
  if (!refId) throw new Error("ref_id required");

  const payload = sanitizePayload(input.payload ?? {});
  const payloadHash = sha256(stableJson(payload));
  const idempotencyKey = [
    eventType,
    refKind,
    refId,
    actorAgentId,
    payloadHash,
    fiveSecondBucket(now),
  ].join(":");

  return {
    api_key_hash: input.apiKeyHash,
    event_type: eventType,
    actor_agent_id: actorAgentId,
    ref_kind: refKind,
    ref_id: refId,
    payload,
    idempotency_key: idempotencyKey,
    created_at: now.toISOString(),
  };
}

export function planTodoLedgerEvents(input: TodoLedgerPlanInput): AutopilotEventInput[] {
  const before = input.before ?? {};
  const after = input.after ?? {};
  const events: AutopilotEventInput[] = [];
  const beforeStatus = typeof before.status === "string" ? before.status : null;
  const afterStatus = typeof after.status === "string" ? after.status : null;
  const beforeAssignee =
    typeof before.assigned_to_agent_id === "string" && before.assigned_to_agent_id.trim()
      ? before.assigned_to_agent_id.trim()
      : null;
  const afterAssignee =
    typeof after.assigned_to_agent_id === "string" && after.assigned_to_agent_id.trim()
      ? after.assigned_to_agent_id.trim()
      : null;

  if (beforeStatus !== afterStatus && afterStatus) {
    events.push({
      apiKeyHash: "",
      eventType: "todo_state_change",
      actorAgentId: input.actorAgentId,
      refKind: "todo",
      refId: input.todoId,
      now: input.now,
      payload: {
        from: beforeStatus,
        to: afterStatus,
        title: after.title ?? before.title ?? "",
      },
    });
  }

  if (beforeAssignee !== afterAssignee) {
    events.push({
      apiKeyHash: "",
      eventType: afterAssignee ? "claim" : "release",
      actorAgentId: input.actorAgentId,
      refKind: "todo",
      refId: input.todoId,
      now: input.now,
      payload: {
        from: beforeAssignee,
        to: afterAssignee,
        status: afterStatus ?? beforeStatus,
      },
    });
  }

  return events;
}

function extractAckFields(text: string): Record<string, string> | null {
  if (!/^ACK\b/i.test(text.trim())) return null;
  const fields: Record<string, string> = {};
  const labels: Record<string, string> = {
    "current chip": "current_chip",
    "next action": "next_action",
    eta: "eta",
    blocker: "blocker",
  };
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([^:]{2,40}):\s*(.+)$/);
    if (!match) continue;
    const key = labels[match[1].trim().toLowerCase()];
    if (key) fields[key] = compact(match[2], 300);
  }
  return Object.keys(fields).length > 0 ? fields : null;
}

export function planFishbowlPostLedgerEvent(input: FishbowlPostLedgerInput): AutopilotEventInput | null {
  const tagSet = new Set((input.tags ?? []).map((tag) => tag.toLowerCase()));
  const ackFields = extractAckFields(input.text);
  const now = input.now;

  if (ackFields) {
    return {
      apiKeyHash: "",
      eventType: "ack",
      actorAgentId: input.actorAgentId,
      refKind: "dispatch",
      refId: input.threadId || input.messageId,
      now,
      payload: {
        ...ackFields,
        message_id: input.messageId,
        thread_id: input.threadId ?? null,
      },
    };
  }

  if (tagSet.has("blocker") || /\bBLOCKER\b/i.test(input.text)) {
    return {
      apiKeyHash: "",
      eventType: "blocker",
      actorAgentId: input.actorAgentId,
      refKind: "run",
      refId: input.threadId || input.messageId,
      now,
      payload: {
        message_id: input.messageId,
        thread_id: input.threadId ?? null,
        reason: compact(input.text, 500),
      },
    };
  }

  if (tagSet.has("needs-doing") || tagSet.has("queuepush") || tagSet.has("wake")) {
    return {
      apiKeyHash: "",
      eventType: "dispatch",
      actorAgentId: input.actorAgentId,
      refKind: "dispatch",
      refId: input.messageId,
      now,
      payload: {
        thread_id: input.threadId ?? null,
        recipients: input.recipients ?? [],
        tags: input.tags ?? [],
      },
    };
  }

  return null;
}

export function planAutoPilotKitRecommendationLedgerEvents(
  input: AutoPilotKitRecommendationLedgerInput,
): AutopilotEventInput[] {
  const recommendations = Array.isArray(input.recommendations) ? input.recommendations : [];
  return recommendations
    .map((recommendation) => {
      const action = compact(recommendation.action, 120);
      const reason = compact(recommendation.reason, 160);
      if (!action || !reason) return null;
      const targetLane = compact(recommendation.target_lane, 120);
      const proofMessageId = compact(recommendation.proof_message_id, 160);
      const affectedAgentIds = Array.isArray(recommendation.affected_agent_ids)
        ? recommendation.affected_agent_ids.map((agentId) => compact(agentId, 128)).filter(Boolean).slice(0, 12)
        : [];

      return {
        apiKeyHash: "",
        eventType: "lane_check",
        actorAgentId: input.actorAgentId,
        refKind: input.refKind ?? "run",
        refId: input.refId,
        now: input.now,
        payload: {
          source: compact(input.source ?? "autopilotkit", 120),
          decision: "advisory",
          advisory: true,
          execute: false,
          recommendation_action: action,
          reason_code: reason,
          target_lane: targetLane || null,
          proof_message_id: proofMessageId || null,
          affected_agent_ids: affectedAgentIds,
        },
      } satisfies AutopilotEventInput;
    })
    .filter((event): event is AutopilotEventInput => event !== null);
}

export async function recordAutopilotEvent(
  supabase: SupabaseClient,
  input: AutopilotEventInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const row = buildAutopilotEventRow(input);
    const { error } = await supabase
      .from("mc_autopilot_events")
      .upsert(row, { onConflict: "api_key_hash,idempotency_key", ignoreDuplicates: true });
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function recordAutopilotEvents(
  supabase: SupabaseClient,
  apiKeyHash: string,
  inputs: AutopilotEventInput[],
): Promise<void> {
  for (const input of inputs) {
    const result = await recordAutopilotEvent(supabase, { ...input, apiKeyHash });
    if (!result.ok) {
      console.warn("[autopilot_events] write skipped:", result.error);
    }
  }
}
