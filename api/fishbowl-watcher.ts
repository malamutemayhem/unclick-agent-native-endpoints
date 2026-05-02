/**
 * Fishbowl Watcher (B1) - Vercel cron, every 15 minutes.
 *
 * Two responsibilities:
 *   1. Dead-man's-switch: agents whose next_checkin_at has passed without a
 *      fresh pulse get a single mc_signals row per missed window so the human
 *      gets nudged via existing Signals delivery.
 *   2. Unread mention digest: if a tenant has unread fishbowl signals at
 *      severity action_needed older than 10 minutes, emit a digest signal so
 *      the human gets a second nudge if the original push was dismissed.
 *   3. Stale status cleanup: clear old Now Playing text after 30 minutes so
 *      stale workers do not look like they are still actively holding a lane.
 *
 * Dedup: each emission checks for a recent identical-action signal so we
 * never spam (30 min for missed check-ins, 60 min for digests).
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

const CHECKIN_DEDUP_WINDOW_MS = 30 * 60 * 1000;
const MENTION_DIGEST_DEDUP_WINDOW_MS = 60 * 60 * 1000;
const MENTION_AGE_THRESHOLD_MS = 10 * 60 * 1000;
const STATUS_STALE_WINDOW_MS = 30 * 60 * 1000;
export const CHECKIN_ACK_LEASE_SECONDS = 600;
const STALE_DISPATCH_RECLAIM_LIMIT = 50;

export function isMissedCheckinCandidate(profile: ProfileRow, nowMs: number): boolean {
  if (!profile.next_checkin_at) return false;
  const dueMs = new Date(profile.next_checkin_at).getTime();
  if (Number.isNaN(dueMs)) return false;
  if (dueMs >= nowMs) return false;
  const seenMs = profile.last_seen_at ? new Date(profile.last_seen_at).getTime() : 0;
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
  let staleDispatchesReclaimed = 0;
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
      deep_link: "/admin/fishbowl",
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

  for (const row of (staleDispatchRows ?? []) as DispatchRow[]) {
    if (!isReclaimableDispatchCandidate(row, nowMs)) continue;
    const signal = buildDispatchReclaimSignal(row, nowMs);
    if (!signal) continue;

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

    const { error: signalErr } = await supabase.from("mc_signals").insert({
      api_key_hash: row.api_key_hash,
      tool: "wakepass",
      action: signal.action,
      severity: signal.action === "handoff_ack_missing" ? "action_needed" : "info",
      summary: signal.summary,
      deep_link: "/admin/fishbowl",
      payload: signal.payload,
    });
    if (signalErr) {
      console.error("[fishbowl-watcher] stale dispatch signal insert error:", signalErr.message);
    } else {
      staleDispatchesReclaimed++;
    }
  }

  // ── 3. Unread mention digest ────────────────────────────────────────────
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

    const summary = `📬 ${count} unread fishbowl mention${count === 1 ? "" : "s"} to you`;
    const { error: digestErr } = await supabase.from("mc_signals").insert({
      api_key_hash: apiKeyHash,
      tool: "fishbowl",
      action: "mention_digest",
      severity: "action_needed",
      summary,
      deep_link: "/admin/fishbowl",
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

  // ── 4. Stale Now Playing cleanup ─────────────────────────────────────────
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
    stale_dispatches_reclaimed: staleDispatchesReclaimed,
    digest_signals_emitted: digestSignalsEmitted,
    stale_statuses_cleared: staleStatusesCleared,
    overdue_candidates: candidates.length,
    tenants_with_unread_mentions: unreadCounts.size,
    stale_status_candidates: staleStatusCandidates.length,
  });
}
