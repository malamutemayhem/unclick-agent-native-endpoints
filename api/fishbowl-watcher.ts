/**
 * Boardroom Watcher (B1) - Vercel cron, every 15 minutes.
 *
 * Responsibilities:
 *   1. Dead-man's-switch: agents whose next_checkin_at has passed without a
 *      fresh pulse get a single mc_signals row per missed window so the human
 *      gets nudged via existing Signals delivery.
 *   2. Unread mention digest: if a tenant has unread Boardroom signals at
 *      severity action_needed older than 10 minutes, emit a digest signal so
 *      the human gets a second nudge if the original push was dismissed.
 *   3. Stale status cleanup: clear old Now Playing text after 30 minutes so
 *      stale workers do not look like they are still actively holding a lane.
 *   4. Worker self-healing todo lease sweep: expired Boardroom todo leases
 *      emit a deduped action_needed signal without exposing lease tokens.
 *
 * Dedup: each emission checks for a recent identical-action signal so we
 * never spam (30 min for missed check-ins and worker self-healing, 60 min
 * for digests).
 *
 * Auth: Bearer ${CRON_SECRET}, same shape as signals-dispatch.ts.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import {
  createQueuedDispatch,
  createReclaimSignal,
  createTimeBucket,
  decideStaleLease,
  type AgentDispatch,
  type DispatchSource,
} from "../packages/mcp-server/src/reliability.js";

export interface ProfileRow {
  api_key_hash: string;
  agent_id: string;
  emoji: string;
  display_name: string | null;
  last_seen_at: string | null;
  current_status: string | null;
  current_status_updated_at: string | null;
  next_checkin_at: string | null;
}

interface SignalRow {
  api_key_hash: string;
  action: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface DispatchRow {
  api_key_hash: string;
  dispatch_id: string;
  source: DispatchSource;
  target_agent_id: string;
  task_ref: string | null;
  status: string;
  lease_owner: string | null;
  lease_expires_at: string | null;
  last_real_action_at: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface FishbowlMessageAckRow {
  id: string;
  text: string | null;
  thread_id: string | null;
  created_at: string;
  author_agent_id: string | null;
}

const CHECKIN_DEDUP_WINDOW_MS = 30 * 60 * 1000;
const MENTION_DIGEST_DEDUP_WINDOW_MS = 60 * 60 * 1000;
const MENTION_AGE_THRESHOLD_MS = 10 * 60 * 1000;
const STATUS_STALE_WINDOW_MS = 30 * 60 * 1000;
const WORKER_SELF_HEALING_SIGNAL_DEDUP_WINDOW_MS = 30 * 60 * 1000;
export const CHECKIN_ACTIVE_GRACE_MS = 30 * 60 * 1000;
export const CHECKIN_OVERDUE_SUPPRESS_MS = 12 * 60 * 60 * 1000;
export const CHECKIN_DORMANT_SUPPRESS_MS = 7 * 24 * 60 * 60 * 1000;
export const CHECKIN_ACK_LEASE_SECONDS = 600;
const STALE_DISPATCH_RECLAIM_LIMIT = 50;
const WORKER_SELF_HEALING_TODO_SWEEP_LIMIT = 50;
export const WAKEPASS_REROUTE_LEASE_SECONDS = 600;

interface WakepassRerouteTarget {
  agentId: string;
  recipient: string;
  role: "coordinator";
  reason: string;
}

export interface WakepassReroutePlan {
  dispatch: AgentDispatch;
  target: WakepassRerouteTarget;
  messageText: string;
  signal: {
    action: "handoff_ack_rerouted";
    severity: "info";
    summary: string;
    payload: Record<string, unknown>;
  };
}

export interface WorkerSelfHealingTodoState {
  id: string;
  status: string;
  assigned_to_agent_id?: string | null;
  lease_token?: string | null;
  lease_expires_at?: string | null;
  reclaim_count?: number | null;
}

interface WorkerSelfHealingTodoSweepRow extends WorkerSelfHealingTodoState {
  api_key_hash: string;
}

export type WorkerSelfHealingAction =
  | "active_lease_preserved"
  | "expired_lease_reclaimable"
  | "stale_worker_action_needed"
  | "no_action";

export interface WorkerSelfHealingDecision {
  action: WorkerSelfHealingAction;
  todo_id: string;
  assigned_to_agent_id: string | null;
  lease_token: string | null;
  lease_expires_at: string | null;
  reclaim_count: number;
  next_reclaim_count: number;
  latest_handoff_receipt_id: string | null;
  reason: string;
  profile_agent_id?: string | null;
  next_checkin_at?: string | null;
  last_seen_at?: string | null;
}

export type WorkerSelfHealingSignalAction =
  | "worker_self_healing_active_lease"
  | "worker_self_healing_reclaimable_lease"
  | "worker_self_healing_stale_worker";

export interface WorkerSelfHealingSignal {
  action: WorkerSelfHealingSignalAction;
  severity: "info" | "action_needed";
  summary: string;
  payload: Record<string, unknown>;
}

export interface WorkerSelfHealingSignalInsertRow {
  api_key_hash: string;
  tool: "fishbowl";
  action: WorkerSelfHealingSignalAction;
  severity: WorkerSelfHealingSignal["severity"];
  summary: string;
  deep_link: string;
  payload: Record<string, unknown>;
}

export interface WorkerSelfHealingTodoSignalPlan {
  signal: WorkerSelfHealingSignal;
  insert: WorkerSelfHealingSignalInsertRow;
}

export function isMissedCheckinCandidate(profile: ProfileRow, nowMs: number): boolean {
  if (!profile.next_checkin_at) return false;
  const dueMs = new Date(profile.next_checkin_at).getTime();
  if (Number.isNaN(dueMs)) return false;
  if (dueMs >= nowMs) return false;
  if (nowMs - dueMs >= CHECKIN_OVERDUE_SUPPRESS_MS) return false;
  const seenMs = profile.last_seen_at ? new Date(profile.last_seen_at).getTime() : 0;
  if (Number.isNaN(seenMs)) return false;
  if (seenMs > 0 && nowMs - seenMs <= CHECKIN_ACTIVE_GRACE_MS) return false;
  if (seenMs > 0 && nowMs - seenMs >= CHECKIN_DORMANT_SUPPRESS_MS) return false;
  return seenMs < dueMs;
}

export function buildMissedCheckinDispatch(
  profile: ProfileRow,
  nowMs: number,
): AgentDispatch {
  const now = new Date(nowMs);
  const dueMs = profile.next_checkin_at
    ? new Date(profile.next_checkin_at).getTime()
    : nowMs;
  const overdueMinutes = Number.isFinite(dueMs)
    ? Math.max(1, Math.round((nowMs - dueMs) / 60_000))
    : 1;
  const dispatch = createQueuedDispatch({
    apiKeyHash: profile.api_key_hash,
    source: "wakepass",
    targetAgentId: profile.agent_id,
    taskRef: `fishbowl-checkin:${profile.agent_id}:${profile.next_checkin_at ?? "unknown"}`,
    timeBucket: createTimeBucket(now, CHECKIN_ACK_LEASE_SECONDS),
    payload: {
      ack_required: true,
      route_attempted: "fishbowl-watcher",
      wake_reason: "missed_next_checkin",
      wake_urgency: "high",
      ack_fail_after_seconds: CHECKIN_ACK_LEASE_SECONDS,
      agent_id: profile.agent_id,
      emoji: profile.emoji,
      display_name: profile.display_name,
      next_checkin_at: profile.next_checkin_at,
      last_seen_at: profile.last_seen_at,
      overdue_minutes: overdueMinutes,
    },
    createdAt: now,
  });

  return {
    ...dispatch,
    status: "leased",
    leaseOwner: profile.agent_id,
    leaseExpiresAt: new Date(nowMs + CHECKIN_ACK_LEASE_SECONDS * 1000).toISOString(),
  };
}

export function planWorkerSelfHealingDecision(params: {
  todo: WorkerSelfHealingTodoState;
  profile?: ProfileRow | null;
  latestHandoffReceiptId?: string | null;
  nowMs: number;
}): WorkerSelfHealingDecision {
  const todo = params.todo;
  const assignedToAgentId = nonEmptyString(todo.assigned_to_agent_id);
  const leaseToken = nonEmptyString(todo.lease_token);
  const leaseExpiresAt = nonEmptyString(todo.lease_expires_at);
  const reclaimCountValue = Number(todo.reclaim_count ?? 0);
  const reclaimCount = Number.isFinite(reclaimCountValue)
    ? Math.max(0, reclaimCountValue)
    : 0;
  const latestHandoffReceiptId = nonEmptyString(params.latestHandoffReceiptId);
  const base = {
    todo_id: todo.id,
    assigned_to_agent_id: assignedToAgentId,
    lease_token: leaseToken,
    lease_expires_at: leaseExpiresAt,
    reclaim_count: reclaimCount,
    latest_handoff_receipt_id: latestHandoffReceiptId,
  };

  if (leaseToken && leaseExpiresAt) {
    const staleDecision = decideStaleLease(
      {
        status: "leased",
        leaseExpiresAt,
        lastRealActionAt: null,
      },
      new Date(params.nowMs),
    );

    if (!staleDecision.isStale) {
      return {
        ...base,
        action: "active_lease_preserved",
        next_reclaim_count: reclaimCount,
        reason: "active_lease_not_expired",
      };
    }

    return {
      ...base,
      action: "expired_lease_reclaimable",
      next_reclaim_count: reclaimCount + 1,
      reason: "lease_expired",
    };
  }

  if (params.profile && isMissedCheckinCandidate(params.profile, params.nowMs)) {
    return {
      ...base,
      action: "stale_worker_action_needed",
      next_reclaim_count: reclaimCount,
      profile_agent_id: params.profile.agent_id,
      next_checkin_at: params.profile.next_checkin_at,
      last_seen_at: params.profile.last_seen_at,
      reason: "missed_next_checkin_without_active_lease",
    };
  }

  return {
    ...base,
    action: "no_action",
    next_reclaim_count: reclaimCount,
    reason: "no_stale_worker_or_reclaimable_lease",
  };
}

function workerSelfHealingSignalPayload(decision: WorkerSelfHealingDecision) {
  const payload: Record<string, unknown> = {
    todo_id: decision.todo_id,
    assigned_to_agent_id: decision.assigned_to_agent_id,
    has_lease_token: Boolean(decision.lease_token),
    lease_expires_at: decision.lease_expires_at,
    reclaim_count: decision.reclaim_count,
    next_reclaim_count: decision.next_reclaim_count,
    latest_handoff_receipt_id: decision.latest_handoff_receipt_id,
    reason: decision.reason,
  };

  if (decision.profile_agent_id) {
    payload.profile_agent_id = decision.profile_agent_id;
  }
  if (decision.next_checkin_at) {
    payload.next_checkin_at = decision.next_checkin_at;
  }
  if (decision.last_seen_at) {
    payload.last_seen_at = decision.last_seen_at;
  }

  return payload;
}

export function buildWorkerSelfHealingSignal(
  decision: WorkerSelfHealingDecision,
): WorkerSelfHealingSignal | null {
  if (decision.action === "active_lease_preserved") {
    return {
      action: "worker_self_healing_active_lease",
      severity: "info",
      summary: `Todo ${decision.todo_id} has an active worker lease through ${
        decision.lease_expires_at ?? "unknown"
      }.`,
      payload: workerSelfHealingSignalPayload(decision),
    };
  }

  if (decision.action === "expired_lease_reclaimable") {
    return {
      action: "worker_self_healing_reclaimable_lease",
      severity: "action_needed",
      summary: `Todo ${decision.todo_id} has an expired worker lease and can be reclaimed.`,
      payload: workerSelfHealingSignalPayload(decision),
    };
  }

  if (decision.action === "stale_worker_action_needed") {
    return {
      action: "worker_self_healing_stale_worker",
      severity: "action_needed",
      summary: `Worker ${
        decision.profile_agent_id ?? decision.assigned_to_agent_id ?? "unknown"
      } missed the next check-in for todo ${decision.todo_id} without an active lease.`,
      payload: workerSelfHealingSignalPayload(decision),
    };
  }

  return null;
}

export function planWorkerSelfHealingTodoSignal(params: {
  apiKeyHash: string;
  decision: WorkerSelfHealingDecision;
  emittedAt: string;
  deepLink?: string;
}): WorkerSelfHealingTodoSignalPlan | null {
  const apiKeyHash = nonEmptyString(params.apiKeyHash);
  const emittedAt = nonEmptyString(params.emittedAt);
  if (!apiKeyHash || !emittedAt) return null;

  const signal = buildWorkerSelfHealingSignal(params.decision);
  if (!signal) return null;

  return {
    signal,
    insert: {
      api_key_hash: apiKeyHash,
      tool: "fishbowl",
      action: signal.action,
      severity: signal.severity,
      summary: signal.summary,
      deep_link: params.deepLink ?? `/admin/jobs#todo-${params.decision.todo_id}`,
      payload: {
        ...signal.payload,
        emitted_at: emittedAt,
      },
    },
  };
}

export function hasRecentWorkerSelfHealingTodoSignal(
  signals: Array<{ action: string; payload: Record<string, unknown> | null }>,
  plan: WorkerSelfHealingTodoSignalPlan,
): boolean {
  const todoId = plan.insert.payload.todo_id;
  return signals.some((signal) => (
    signal.action === plan.insert.action &&
    signal.payload?.todo_id === todoId
  ));
}

function dispatchToDbRow(dispatch: AgentDispatch) {
  return {
    api_key_hash: dispatch.apiKeyHash,
    dispatch_id: dispatch.dispatchId,
    source: dispatch.source,
    target_agent_id: dispatch.targetAgentId,
    task_ref: dispatch.taskRef ?? null,
    status: dispatch.status,
    lease_owner: dispatch.leaseOwner ?? null,
    lease_expires_at: dispatch.leaseExpiresAt ?? null,
    last_real_action_at: dispatch.lastRealActionAt ?? null,
    payload: dispatch.payload ?? null,
    created_at: dispatch.createdAt,
    updated_at: dispatch.updatedAt,
  };
}

function normalizeToken(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function compactText(value: unknown, max = 240): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function ackTokenForDispatch(row: DispatchRow): string | null {
  const payload = row.payload ?? {};
  return (
    nonEmptyString(payload.wake_event_id) ||
    nonEmptyString(payload.dispatch_id) ||
    nonEmptyString(row.task_ref)
  );
}

export function messageAcknowledgesDispatch(
  row: DispatchRow,
  message: FishbowlMessageAckRow,
): boolean {
  const text = String(message.text ?? "").trim();
  if (!/^ACK\b/i.test(text)) return false;

  const handoffMessageId = nonEmptyString(row.payload?.handoff_message_id);
  if (handoffMessageId && message.thread_id === handoffMessageId) return true;

  const ackToken = ackTokenForDispatch(row);
  if (!ackToken) return false;
  if (!text.includes(ackToken)) return false;

  if (!handoffMessageId) return true;

  return message.thread_id === null;
}

function newestFirst(a: ProfileRow, b: ProfileRow): number {
  const aMs = Date.parse(String(a.last_seen_at ?? ""));
  const bMs = Date.parse(String(b.last_seen_at ?? ""));
  return (Number.isFinite(bMs) ? bMs : 0) - (Number.isFinite(aMs) ? aMs : 0);
}

export function isWakepassAutoRerouteEligible(row: DispatchRow): boolean {
  const payload = row.payload ?? {};
  const kind = normalizeToken(payload.kind);
  const wakeReason = normalizeToken(payload.wake_reason);
  if (kind === "wakepass_auto_reroute") return false;
  if (wakeReason === "missed_next_checkin") return false;

  if (kind === "todo_assignment") return true;
  if (kind === "message_handoff") {
    const tags = Array.isArray(payload.tags) ? payload.tags.map(normalizeToken) : [];
    const summary = normalizeToken(payload.summary);
    return (
      tags.includes("needs-doing") ||
      tags.includes("queuepush") ||
      summary.includes("queuepush") ||
      /\bpr\s*#?\d+\b/.test(summary)
    );
  }

  const text = normalizeToken(
    [
      row.task_ref,
      payload.title,
      payload.summary,
      payload.chip,
      payload.task_ref,
    ].join(" "),
  );
  return (
    text.includes("queuepush") ||
    text.includes("owner decision") ||
    text.includes("owner-lift") ||
    text.includes("owner lift") ||
    /\bpr\s*#?\d+\b/.test(text)
  );
}

export function resolveWakepassRerouteTarget(profiles: ProfileRow[] = []): WakepassRerouteTarget {
  const coordinatorCandidates = profiles
    .filter((profile) => {
      const agentId = normalizeToken(profile.agent_id);
      const emoji = String(profile.emoji ?? "").trim();
      const name = normalizeToken(profile.display_name);
      return (
        agentId === "master" ||
        agentId.includes("coordinator") ||
        name.includes("coordinator") ||
        emoji === "🧭"
      );
    })
    .sort((a, b) => {
      const aIsMaster = normalizeToken(a.agent_id) === "master" ? 1 : 0;
      const bIsMaster = normalizeToken(b.agent_id) === "master" ? 1 : 0;
      if (aIsMaster !== bIsMaster) return bIsMaster - aIsMaster;
      return newestFirst(a, b);
    });

  const selected = coordinatorCandidates[0];
  if (selected) {
    return {
      agentId: selected.agent_id,
      recipient: selected.emoji || selected.agent_id,
      role: "coordinator",
      reason: "worker_registry_coordinator",
    };
  }

  return {
    agentId: "master",
    recipient: "🧭",
    role: "coordinator",
    reason: "default_coordinator",
  };
}

export function buildWakepassAutoReroutePlan({
  row,
  signal,
  profiles = [],
  nowMs,
}: {
  row: DispatchRow;
  signal: NonNullable<ReturnType<typeof buildDispatchReclaimSignal>>;
  profiles?: ProfileRow[];
  nowMs: number;
}): WakepassReroutePlan | null {
  if (signal.action !== "handoff_ack_missing") return null;
  if (!isWakepassAutoRerouteEligible(row)) return null;

  const now = new Date(nowMs);
  const target = resolveWakepassRerouteTarget(profiles);
  const originalPayload = row.payload ?? {};
  const title = compactText(originalPayload.title || originalPayload.summary || row.task_ref || row.dispatch_id, 160);
  const dispatch = createQueuedDispatch({
    apiKeyHash: row.api_key_hash,
    source: "wakepass",
    targetAgentId: target.agentId,
    taskRef: `wakepass-reroute:${row.dispatch_id}`,
    timeBucket: createTimeBucket(now, WAKEPASS_REROUTE_LEASE_SECONDS),
    payload: {
      kind: "wakepass_auto_reroute",
      ack_required: true,
      route_attempted: "wakepass-auto-reroute",
      reroute_reason: "missed_ack",
      reroute_target_role: target.role,
      reroute_target_agent_id: target.agentId,
      reroute_target_reason: target.reason,
      original_dispatch_id: row.dispatch_id,
      original_source: row.source,
      original_target_agent_id: row.target_agent_id,
      original_task_ref: row.task_ref,
      original_payload_kind: originalPayload.kind ?? null,
      title,
      summary: compactText(signal.summary, 220),
      next_action: "Coordinator should reroute to a live worker or reply PASS/BLOCKER/HOLD.",
      stale_seconds: signal.payload.stale_seconds ?? null,
    },
    createdAt: now,
  });

  const leasedDispatch: AgentDispatch = {
    ...dispatch,
    status: "leased",
    leaseOwner: target.agentId,
    leaseExpiresAt: new Date(nowMs + WAKEPASS_REROUTE_LEASE_SECONDS * 1000).toISOString(),
  };

  const messageText = [
    "WakePass auto-reroute",
    `Original target: ${row.target_agent_id}`,
    `Reason: missed ACK for ${title}`,
    "Coordinator action: reroute to a live worker or reply PASS/BLOCKER/HOLD.",
    `Source dispatch: ${row.dispatch_id}`,
  ].join("\n");

  return {
    dispatch: leasedDispatch,
    target,
    messageText,
    signal: {
      action: "handoff_ack_rerouted",
      severity: "info",
      summary: `WakePass auto-rerouted missed ACK from ${row.target_agent_id} to ${target.agentId}`,
      payload: {
        ...signal.payload,
        rerouted: true,
        reroute_dispatch_id: leasedDispatch.dispatchId,
        reroute_target_agent_id: target.agentId,
        reroute_target_role: target.role,
        reroute_target_reason: target.reason,
      },
    },
  };
}

export function isReclaimableDispatchCandidate(row: DispatchRow, nowMs: number): boolean {
  return decideStaleLease(
    {
      status: row.status as AgentDispatch["status"],
      leaseExpiresAt: row.lease_expires_at,
      lastRealActionAt: row.last_real_action_at,
    },
    new Date(nowMs),
  ).isStale;
}

export function isMissedCheckinDispatch(row: DispatchRow): boolean {
  const payload = row.payload ?? {};
  return (
    normalizeToken(payload.wake_reason) === "missed_next_checkin" ||
    normalizeToken(row.task_ref).startsWith("fishbowl-checkin:")
  );
}

export function buildDispatchReclaimSignal(row: DispatchRow, nowMs: number) {
  const staleDecision = decideStaleLease(
    {
      status: row.status as AgentDispatch["status"],
      leaseExpiresAt: row.lease_expires_at,
      lastRealActionAt: row.last_real_action_at,
    },
    new Date(nowMs),
  );

  if (!staleDecision.isStale) return null;

  if (isMissedCheckinDispatch(row)) {
    return {
      action: "stale_dispatch_reclaimed" as const,
      summary: `Reclaimed stale missed check-in dispatch for ${row.target_agent_id}`,
      payload: {
        dispatch_id: row.dispatch_id,
        source: row.source,
        target_agent_id: row.target_agent_id,
        task_ref: row.task_ref ?? null,
        stale_seconds: staleDecision.staleSeconds,
        ...(row.payload ?? {}),
      },
    };
  }

  return createReclaimSignal(
    {
      dispatchId: row.dispatch_id,
      source: row.source,
      targetAgentId: row.target_agent_id,
      taskRef: row.task_ref ?? undefined,
      payload: row.payload ?? {},
    },
    staleDecision.staleSeconds,
  );
}

export function shouldMarkDispatchStaleAfterReclaimSignalInsert(
  signalErr: { message?: string } | null | undefined,
): boolean {
  return !signalErr;
}

async function listProfilesForTenant(
  supabase: ReturnType<typeof createClient>,
  apiKeyHash: string,
): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from("mc_fishbowl_profiles")
    .select("api_key_hash, agent_id, emoji, display_name, last_seen_at, current_status, current_status_updated_at, next_checkin_at")
    .eq("api_key_hash", apiKeyHash);
  if (error) {
    console.error("[fishbowl-watcher] profile lookup for reroute failed:", error.message);
    return [];
  }
  return (data ?? []) as ProfileRow[];
}

async function findDispatchAckMessage(
  supabase: ReturnType<typeof createClient>,
  row: DispatchRow,
): Promise<FishbowlMessageAckRow | null> {
  const createdMs = Date.parse(String(row.created_at ?? ""));
  let query = supabase
    .from("mc_fishbowl_messages")
    .select("id, text, thread_id, created_at, author_agent_id")
    .eq("api_key_hash", row.api_key_hash)
    .ilike("text", "ACK%")
    .order("created_at", { ascending: false })
    .limit(100);

  if (Number.isFinite(createdMs)) {
    query = query.gte("created_at", row.created_at);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[fishbowl-watcher] ACK message lookup failed:", error.message);
    return null;
  }

  return (
    ((data ?? []) as FishbowlMessageAckRow[]).find((message) =>
      messageAcknowledgesDispatch(row, message),
    ) ?? null
  );
}

async function completeDispatchFromAckMessage(
  supabase: ReturnType<typeof createClient>,
  row: DispatchRow,
  message: FishbowlMessageAckRow,
  nowIso: string,
): Promise<boolean> {
  let updateQuery = supabase
    .from("mc_agent_dispatches")
    .update({
      status: "completed",
      lease_owner: null,
      lease_expires_at: null,
      last_real_action_at: message.created_at,
      updated_at: nowIso,
      payload: {
        ...(row.payload ?? {}),
        ack_message_id: message.id,
        ack_message_created_at: message.created_at,
        ack_detected_at: nowIso,
        ack_matcher: "fishbowl_wake_event_id",
      },
    })
    .eq("api_key_hash", row.api_key_hash)
    .eq("dispatch_id", row.dispatch_id)
    .eq("status", row.status)
    .eq("updated_at", row.updated_at);

  updateQuery = row.lease_owner
    ? updateQuery.eq("lease_owner", row.lease_owner)
    : updateQuery.is("lease_owner", null);
  updateQuery = row.lease_expires_at
    ? updateQuery.eq("lease_expires_at", row.lease_expires_at)
    : updateQuery.is("lease_expires_at", null);

  const { data, error } = await updateQuery.select("dispatch_id").maybeSingle();
  if (error) {
    console.error("[fishbowl-watcher] ACK dispatch completion failed:", error.message);
    return false;
  }
  return Boolean(data);
}

async function ensureDefaultBoardroomRoomId(
  supabase: ReturnType<typeof createClient>,
  apiKeyHash: string,
): Promise<string | null> {
  const { data: existingRoom, error: existingErr } = await supabase
    .from("mc_fishbowl_rooms")
    .select("id")
    .eq("api_key_hash", apiKeyHash)
    .eq("slug", "default")
    .maybeSingle();
  if (existingErr) {
    console.error("[fishbowl-watcher] default room lookup for reroute failed:", existingErr.message);
    return null;
  }
  if (existingRoom?.id) return existingRoom.id as string;

  const { data: newRoom, error: roomErr } = await supabase
    .from("mc_fishbowl_rooms")
    .insert({ api_key_hash: apiKeyHash, slug: "default", name: "Boardroom" })
    .select("id")
    .single();
  if (roomErr) {
    console.error("[fishbowl-watcher] default room create for reroute failed:", roomErr.message);
    return null;
  }
  return (newRoom?.id as string | undefined) ?? null;
}

async function postWakepassRerouteMessage(
  supabase: ReturnType<typeof createClient>,
  row: DispatchRow,
  plan: WakepassReroutePlan,
  nowIso: string,
): Promise<void> {
  const roomId = await ensureDefaultBoardroomRoomId(supabase, row.api_key_hash);
  if (!roomId) return;

  const { error } = await supabase.from("mc_fishbowl_messages").insert({
    api_key_hash: row.api_key_hash,
    room_id: roomId,
    author_emoji: "🧭",
    author_name: "WakePass",
    author_agent_id: "wakepass-auto-reroute",
    recipients: [plan.target.recipient],
    text: plan.messageText,
    tags: ["needs-doing", "wakepass", "reroute"],
    created_at: nowIso,
  });
  if (error) {
    console.error("[fishbowl-watcher] reroute message insert failed:", error.message);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Database service unavailable" });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  let checkinSignalsEmitted = 0;
  let checkinDispatchesEmitted = 0;
  let checkinTimersCleared = 0;
  let staleDispatchesReclaimed = 0;
  let staleDispatchesAcked = 0;
  let staleDispatchesRerouted = 0;
  let staleDispatchRerouteFailures = 0;
  let workerSelfHealingSignalsEmitted = 0;
  let workerSelfHealingSignalsDeduped = 0;
  let digestSignalsEmitted = 0;
  let staleStatusesCleared = 0;

  // ── 1. Dead-man's-switch sweep ──────────────────────────────────────────
  const { data: overdueProfiles, error: profileErr } = await supabase
    .from("mc_fishbowl_profiles")
    .select("api_key_hash, agent_id, emoji, display_name, last_seen_at, current_status, current_status_updated_at, next_checkin_at")
    .lt("next_checkin_at", nowIso)
    .not("next_checkin_at", "is", null);

  if (profileErr) {
    console.error("[fishbowl-watcher] profile fetch error:", profileErr.message);
    return res.status(500).json({ error: profileErr.message });
  }

  const candidates = ((overdueProfiles ?? []) as ProfileRow[]).filter((p) =>
    isMissedCheckinCandidate(p, nowMs),
  );

  for (const profile of candidates) {
    const dedupCutoff = new Date(nowMs - CHECKIN_DEDUP_WINDOW_MS).toISOString();
    const { data: recentSignals } = await supabase
      .from("mc_signals")
      .select("api_key_hash, action, payload, created_at")
      .eq("api_key_hash", profile.api_key_hash)
      .eq("tool", "fishbowl")
      .eq("action", "checkin_missed")
      .gt("created_at", dedupCutoff);

    const alreadyEmitted = ((recentSignals ?? []) as SignalRow[]).some((s) => {
      const payload = (s.payload ?? {}) as Record<string, unknown>;
      return payload.agent_id === profile.agent_id;
    });
    if (alreadyEmitted) continue;

    const dueMs = new Date(profile.next_checkin_at as string).getTime();
    const overdueMin = Math.max(1, Math.round((nowMs - dueMs) / 60_000));
    const summary = `🪪 ${profile.emoji} missed expected check-in (was due ${overdueMin} min ago)`;
    const dispatch = buildMissedCheckinDispatch(profile, nowMs);

    const { error: dispatchErr } = await supabase
      .from("mc_agent_dispatches")
      .upsert(dispatchToDbRow(dispatch), { onConflict: "api_key_hash,dispatch_id" });
    if (dispatchErr) {
      console.error(
        "[fishbowl-watcher] missed checkin dispatch upsert error:",
        dispatchErr.message,
      );
      continue;
    }
    checkinDispatchesEmitted++;

    const { error: insertErr } = await supabase.from("mc_signals").insert({
      api_key_hash: profile.api_key_hash,
      tool: "fishbowl",
      action: "checkin_missed",
      severity: "action_needed",
      summary,
      deep_link: "/admin/boardroom",
      payload: {
        agent_id: profile.agent_id,
        emoji: profile.emoji,
        display_name: profile.display_name,
        next_checkin_at: profile.next_checkin_at,
        last_seen_at: profile.last_seen_at,
        overdue_minutes: overdueMin,
        dispatch_id: dispatch.dispatchId,
      },
    });
    if (insertErr) {
      console.error(
        "[fishbowl-watcher] checkin signal insert error:",
        insertErr.message,
      );
    } else {
      checkinSignalsEmitted++;
      const { error: clearCheckinErr } = await supabase
        .from("mc_fishbowl_profiles")
        .update({ next_checkin_at: null })
        .eq("api_key_hash", profile.api_key_hash)
        .eq("agent_id", profile.agent_id)
        .eq("next_checkin_at", profile.next_checkin_at);
      if (clearCheckinErr) {
        console.error(
          "[fishbowl-watcher] missed checkin timer clear error:",
          clearCheckinErr.message,
        );
      } else {
        checkinTimersCleared++;
      }
    }
  }

  // ── 2. WakePass missed-ACK reclaim sweep ────────────────────────────────
  const { data: staleDispatchRows, error: staleDispatchErr } = await supabase
    .from("mc_agent_dispatches")
    .select(
      "api_key_hash, dispatch_id, source, target_agent_id, task_ref, status, lease_owner, lease_expires_at, last_real_action_at, payload, created_at, updated_at",
    )
    .eq("status", "leased")
    .not("lease_expires_at", "is", null)
    .lt("lease_expires_at", nowIso)
    .order("lease_expires_at", { ascending: true })
    .limit(STALE_DISPATCH_RECLAIM_LIMIT);

  if (staleDispatchErr) {
    console.error("[fishbowl-watcher] stale dispatch fetch error:", staleDispatchErr.message);
    return res.status(500).json({ error: staleDispatchErr.message });
  }

  const profileCache = new Map<string, ProfileRow[]>();

  for (const row of (staleDispatchRows ?? []) as DispatchRow[]) {
    if (!isReclaimableDispatchCandidate(row, nowMs)) continue;
    const ackMessage = await findDispatchAckMessage(supabase, row);
    if (ackMessage) {
      const completed = await completeDispatchFromAckMessage(
        supabase,
        row,
        ackMessage,
        nowIso,
      );
      if (completed) staleDispatchesAcked++;
      continue;
    }
    const signal = buildDispatchReclaimSignal(row, nowMs);
    if (!signal) continue;

    let signalToInsert: {
      action: string;
      severity: "action_needed" | "info";
      summary: string;
      payload: Record<string, unknown>;
    } = {
      action: signal.action,
      severity: signal.action === "handoff_ack_missing" ? "action_needed" : "info",
      summary: signal.summary,
      payload: signal.payload,
    };

    if (signal.action === "handoff_ack_missing") {
      let profiles = profileCache.get(row.api_key_hash);
      if (!profiles) {
        profiles = await listProfilesForTenant(supabase, row.api_key_hash);
        profileCache.set(row.api_key_hash, profiles);
      }

      const reroutePlan = buildWakepassAutoReroutePlan({
        row,
        signal,
        profiles,
        nowMs,
      });

      if (reroutePlan) {
        const { error: rerouteErr } = await supabase
          .from("mc_agent_dispatches")
          .upsert(dispatchToDbRow(reroutePlan.dispatch), {
            onConflict: "api_key_hash,dispatch_id",
          });

        if (rerouteErr) {
          staleDispatchRerouteFailures++;
          console.error(
            "[fishbowl-watcher] missed ACK reroute dispatch upsert error:",
            rerouteErr.message,
          );
        } else {
          await postWakepassRerouteMessage(supabase, row, reroutePlan, nowIso);
          staleDispatchesRerouted++;
          signalToInsert = reroutePlan.signal;
        }
      }
    }

    const { error: signalErr } = await supabase.from("mc_signals").insert({
      api_key_hash: row.api_key_hash,
      tool: "wakepass",
      action: signalToInsert.action,
      severity: signalToInsert.severity,
      summary: signalToInsert.summary,
      deep_link: "/admin/boardroom",
      payload: signalToInsert.payload,
    });
    if (!shouldMarkDispatchStaleAfterReclaimSignalInsert(signalErr)) {
      console.error(
        "[fishbowl-watcher] stale dispatch signal insert error:",
        signalErr?.message ?? "unknown error",
      );
      continue;
    }

    let reclaimQuery = supabase
      .from("mc_agent_dispatches")
      .update({
        status: "stale",
        lease_owner: null,
        lease_expires_at: null,
        updated_at: nowIso,
      })
      .eq("api_key_hash", row.api_key_hash)
      .eq("dispatch_id", row.dispatch_id)
      .eq("status", row.status)
      .eq("updated_at", row.updated_at);
    reclaimQuery = row.lease_owner
      ? reclaimQuery.eq("lease_owner", row.lease_owner)
      : reclaimQuery.is("lease_owner", null);
    reclaimQuery = row.lease_expires_at
      ? reclaimQuery.eq("lease_expires_at", row.lease_expires_at)
      : reclaimQuery.is("lease_expires_at", null);

    const { data: reclaimed, error: reclaimErr } = await reclaimQuery
      .select("dispatch_id")
      .maybeSingle();
    if (reclaimErr) {
      console.error("[fishbowl-watcher] stale dispatch reclaim error:", reclaimErr.message);
      continue;
    }
    if (!reclaimed) continue;

    staleDispatchesReclaimed++;
  }

  // 3. Worker self-healing todo lease signal sweep.
  const { data: staleTodoLeaseRows, error: staleTodoLeaseErr } = await supabase
    .from("mc_fishbowl_todos")
    .select("id, api_key_hash, status, assigned_to_agent_id, lease_token, lease_expires_at, reclaim_count")
    .in("status", ["open", "in_progress"])
    .not("lease_expires_at", "is", null)
    .lt("lease_expires_at", nowIso)
    .order("lease_expires_at", { ascending: true })
    .limit(WORKER_SELF_HEALING_TODO_SWEEP_LIMIT);

  if (staleTodoLeaseErr) {
    console.error(
      "[fishbowl-watcher] worker self-healing todo fetch error:",
      staleTodoLeaseErr.message,
    );
    return res.status(500).json({ error: staleTodoLeaseErr.message });
  }

  for (const todo of (staleTodoLeaseRows ?? []) as WorkerSelfHealingTodoSweepRow[]) {
    const decision = planWorkerSelfHealingDecision({
      todo,
      profile: null,
      latestHandoffReceiptId: null,
      nowMs,
    });
    const plan = planWorkerSelfHealingTodoSignal({
      apiKeyHash: todo.api_key_hash,
      decision,
      emittedAt: nowIso,
    });
    if (!plan) continue;

    const dedupCutoff = new Date(
      nowMs - WORKER_SELF_HEALING_SIGNAL_DEDUP_WINDOW_MS,
    ).toISOString();
    const { data: recentTodoSignals, error: recentTodoSignalErr } = await supabase
      .from("mc_signals")
      .select("action, payload, created_at")
      .eq("api_key_hash", todo.api_key_hash)
      .eq("tool", "fishbowl")
      .eq("action", plan.insert.action)
      .gt("created_at", dedupCutoff);

    if (recentTodoSignalErr) {
      console.error(
        "[fishbowl-watcher] worker self-healing dedupe fetch error:",
        recentTodoSignalErr.message,
      );
      continue;
    }

    if (
      hasRecentWorkerSelfHealingTodoSignal(
        (recentTodoSignals ?? []) as SignalRow[],
        plan,
      )
    ) {
      workerSelfHealingSignalsDeduped++;
      continue;
    }

    const { error: workerSignalErr } = await supabase
      .from("mc_signals")
      .insert(plan.insert);
    if (workerSignalErr) {
      console.error(
        "[fishbowl-watcher] worker self-healing signal insert error:",
        workerSignalErr.message,
      );
    } else {
      workerSelfHealingSignalsEmitted++;
    }
  }

  // ── 4. Unread mention digest ────────────────────────────────────────────
  const mentionAgeCutoff = new Date(nowMs - MENTION_AGE_THRESHOLD_MS).toISOString();
  const { data: unreadMentions } = await supabase
    .from("mc_signals")
    .select("api_key_hash")
    .eq("tool", "fishbowl")
    .eq("action", "message_posted")
    .eq("severity", "action_needed")
    .is("read_at", null)
    .lt("created_at", mentionAgeCutoff);

  const unreadCounts = new Map<string, number>();
  for (const row of (unreadMentions ?? []) as { api_key_hash: string }[]) {
    unreadCounts.set(row.api_key_hash, (unreadCounts.get(row.api_key_hash) ?? 0) + 1);
  }

  for (const [apiKeyHash, count] of unreadCounts.entries()) {
    const dedupCutoff = new Date(nowMs - MENTION_DIGEST_DEDUP_WINDOW_MS).toISOString();
    const { data: recentDigest } = await supabase
      .from("mc_signals")
      .select("id")
      .eq("api_key_hash", apiKeyHash)
      .eq("tool", "fishbowl")
      .eq("action", "mention_digest")
      .gt("created_at", dedupCutoff)
      .limit(1);

    if ((recentDigest ?? []).length > 0) continue;

    const summary = `📬 ${count} unread Boardroom mention${count === 1 ? "" : "s"} to you`;
    const { error: digestErr } = await supabase.from("mc_signals").insert({
      api_key_hash: apiKeyHash,
      tool: "fishbowl",
      action: "mention_digest",
      severity: "action_needed",
      summary,
      deep_link: "/admin/boardroom",
      payload: { unread_count: count },
    });
    if (digestErr) {
      console.error(
        "[fishbowl-watcher] digest signal insert error:",
        digestErr.message,
      );
    } else {
      digestSignalsEmitted++;
    }
  }

  // ── 5. Stale Now Playing cleanup ─────────────────────────────────────────
  const staleStatusCutoff = new Date(nowMs - STATUS_STALE_WINDOW_MS).toISOString();
  const { data: staleStatusProfiles, error: staleStatusErr } = await supabase
    .from("mc_fishbowl_profiles")
    .select("api_key_hash, agent_id, emoji, display_name, last_seen_at, current_status, current_status_updated_at, next_checkin_at")
    .not("current_status", "is", null)
    .or(`current_status_updated_at.is.null,current_status_updated_at.lt.${staleStatusCutoff}`);

  if (staleStatusErr) {
    console.error("[fishbowl-watcher] stale status fetch error:", staleStatusErr.message);
    return res.status(500).json({ error: staleStatusErr.message });
  }

  const staleStatusCandidates = ((staleStatusProfiles ?? []) as ProfileRow[]).filter((p) => {
    if (!p.current_status) return false;
    if (!p.current_status_updated_at) return true;
    const statusMs = new Date(p.current_status_updated_at).getTime();
    if (Number.isNaN(statusMs) || nowMs - statusMs < STATUS_STALE_WINDOW_MS) return false;
    return true;
  });

  for (const profile of staleStatusCandidates) {
    let clearQuery = supabase
      .from("mc_fishbowl_profiles")
      .update({ current_status: null, current_status_updated_at: nowIso })
      .eq("api_key_hash", profile.api_key_hash)
      .eq("agent_id", profile.agent_id);
    clearQuery = profile.current_status_updated_at
      ? clearQuery.eq("current_status_updated_at", profile.current_status_updated_at)
      : clearQuery.is("current_status_updated_at", null);
    const { error: clearErr } = await clearQuery;

    if (clearErr) {
      console.error("[fishbowl-watcher] stale status clear error:", clearErr.message);
    } else {
      staleStatusesCleared++;
    }
  }

  return res.status(200).json({
    checkin_signals_emitted: checkinSignalsEmitted,
    checkin_dispatches_emitted: checkinDispatchesEmitted,
    checkin_timers_cleared: checkinTimersCleared,
    stale_dispatches_reclaimed: staleDispatchesReclaimed,
    stale_dispatches_acked: staleDispatchesAcked,
    stale_dispatches_rerouted: staleDispatchesRerouted,
    stale_dispatch_reroute_failures: staleDispatchRerouteFailures,
    worker_self_healing_signals_emitted: workerSelfHealingSignalsEmitted,
    worker_self_healing_signals_deduped: workerSelfHealingSignalsDeduped,
    digest_signals_emitted: digestSignalsEmitted,
    stale_statuses_cleared: staleStatusesCleared,
    overdue_candidates: candidates.length,
    worker_self_healing_candidates: (staleTodoLeaseRows ?? []).length,
    tenants_with_unread_mentions: unreadCounts.size,
    stale_status_candidates: staleStatusCandidates.length,
  });
}
