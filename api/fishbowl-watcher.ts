/**
 * Fishbowl Watcher (B1 + B2) - Vercel cron, every 15 minutes.
 *
 * Three responsibilities:
 *   1. Dead-man's-switch: agents whose next_checkin_at has passed without a
 *      fresh pulse get a single mc_signals row per missed window so the human
 *      gets nudged via existing Signals delivery.
 *   2. Unread mention digest: if a tenant has unread fishbowl signals at
 *      severity action_needed older than 10 minutes, emit a digest signal so
 *      the human gets a second nudge if the original push was dismissed.
 *   3. Draft escalation (B2): unread important/urgent drafts get escalated
 *      via the recipient's declared wake_route. Urgent escalates after 15
 *      minutes, important after 30. The route is read from
 *      mc_fishbowl_profiles.wake_route_kind / wake_route_config; default
 *      (NULL) falls through to a plain Signal so behavior matches B1.
 *
 * Dedup: each emission checks for a recent identical-action signal so we
 * never spam (30 min for missed check-ins, 60 min for digests, 60 min per
 * draft escalation).
 *
 * Auth: Bearer ${CRON_SECRET}, same shape as signals-dispatch.ts.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

interface ProfileRow {
  api_key_hash: string;
  agent_id: string;
  emoji: string;
  display_name: string | null;
  last_seen_at: string | null;
  next_checkin_at: string | null;
}

interface SignalRow {
  api_key_hash: string;
  action: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

interface DraftRow {
  id: string;
  api_key_hash: string;
  recipient_agent_id: string;
  sender_agent_id: string;
  sender_emoji: string | null;
  text: string;
  priority: "normal" | "important" | "urgent";
  created_at: string;
}

interface RecipientProfileRow {
  api_key_hash: string;
  agent_id: string;
  emoji: string;
  display_name: string | null;
  wake_route_kind: string | null;
  wake_route_config: Record<string, unknown> | null;
}

const CHECKIN_DEDUP_WINDOW_MS = 30 * 60 * 1000;
const MENTION_DIGEST_DEDUP_WINDOW_MS = 60 * 60 * 1000;
const MENTION_AGE_THRESHOLD_MS = 10 * 60 * 1000;

const URGENT_AGE_THRESHOLD_MS = 15 * 60 * 1000;
const IMPORTANT_AGE_THRESHOLD_MS = 30 * 60 * 1000;
const DRAFT_ESCALATION_DEDUP_WINDOW_MS = 60 * 60 * 1000;

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
  let digestSignalsEmitted = 0;

  // ── 1. Dead-man's-switch sweep ──────────────────────────────────────────
  const { data: overdueProfiles, error: profileErr } = await supabase
    .from("mc_fishbowl_profiles")
    .select("api_key_hash, agent_id, emoji, display_name, last_seen_at, next_checkin_at")
    .lt("next_checkin_at", nowIso)
    .not("next_checkin_at", "is", null);

  if (profileErr) {
    console.error("[fishbowl-watcher] profile fetch error:", profileErr.message);
    return res.status(500).json({ error: profileErr.message });
  }

  const candidates = ((overdueProfiles ?? []) as ProfileRow[]).filter((p) => {
    if (!p.next_checkin_at) return false;
    const dueMs = new Date(p.next_checkin_at).getTime();
    if (Number.isNaN(dueMs)) return false;
    if (dueMs >= nowMs) return false;
    const seenMs = p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0;
    return seenMs < dueMs;
  });

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

  // ── 2. Unread mention digest ────────────────────────────────────────────
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

  // ── 3. Draft escalation sweep (B2) ──────────────────────────────────────
  // Find unread, unexpired drafts at priority important/urgent that have
  // aged past their threshold. For each, look up the recipient's wake_route
  // and dispatch via that channel. A Signal is always emitted as the
  // baseline + dedup record; the wake_route adds platform-specific delivery
  // on top when wired.
  const draftAgeCutoff = new Date(nowMs - URGENT_AGE_THRESHOLD_MS).toISOString();
  const { data: candidateDrafts } = await supabase
    .from("mc_fishbowl_drafts")
    .select("id, api_key_hash, recipient_agent_id, sender_agent_id, sender_emoji, text, priority, created_at, expires_at")
    .in("priority", ["important", "urgent"])
    .is("acknowledged_at", null)
    .lt("created_at", draftAgeCutoff)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

  const escalatableDrafts = ((candidateDrafts ?? []) as DraftRow[]).filter((d) => {
    const ageMs = nowMs - new Date(d.created_at).getTime();
    if (d.priority === "urgent") return ageMs >= URGENT_AGE_THRESHOLD_MS;
    if (d.priority === "important") return ageMs >= IMPORTANT_AGE_THRESHOLD_MS;
    return false;
  });

  // Batch fetch recipient profiles per (tenant, agent_id) so we don't issue
  // one supabase call per draft. Group by tenant first to keep queries cheap.
  const draftsByTenant = new Map<string, DraftRow[]>();
  for (const d of escalatableDrafts) {
    const arr = draftsByTenant.get(d.api_key_hash) ?? [];
    arr.push(d);
    draftsByTenant.set(d.api_key_hash, arr);
  }
  const recipientProfileCache = new Map<string, RecipientProfileRow>();
  for (const [tenantHash, drafts] of draftsByTenant.entries()) {
    const recipientIds = Array.from(new Set(drafts.map((d) => d.recipient_agent_id)));
    const { data: profiles } = await supabase
      .from("mc_fishbowl_profiles")
      .select("api_key_hash, agent_id, emoji, display_name, wake_route_kind, wake_route_config")
      .eq("api_key_hash", tenantHash)
      .in("agent_id", recipientIds);
    for (const p of (profiles ?? []) as RecipientProfileRow[]) {
      recipientProfileCache.set(`${p.api_key_hash}:${p.agent_id}`, p);
    }
  }

  let draftEscalationsEmitted = 0;
  let draftWakeRouteDispatches = 0;
  const wakeRouteCounts: Record<string, number> = {};

  for (const draft of escalatableDrafts) {
    // Per-draft dedup: skip if we've already emitted an escalation in the
    // last 60 minutes for this draft_id. This is what stops the watcher
    // from re-poking on every 15-minute tick.
    const dedupCutoff = new Date(nowMs - DRAFT_ESCALATION_DEDUP_WINDOW_MS).toISOString();
    const { data: recentEscalations } = await supabase
      .from("mc_signals")
      .select("payload")
      .eq("api_key_hash", draft.api_key_hash)
      .eq("tool", "fishbowl")
      .eq("action", "draft_escalated")
      .gt("created_at", dedupCutoff);

    const alreadyEscalated = ((recentEscalations ?? []) as { payload: Record<string, unknown> | null }[]).some(
      (s) => (s.payload ?? {}).draft_id === draft.id,
    );
    if (alreadyEscalated) continue;

    const recipient = recipientProfileCache.get(`${draft.api_key_hash}:${draft.recipient_agent_id}`);
    const wakeKind = (recipient?.wake_route_kind ?? "signals_only").toString();
    const wakeConfig = (recipient?.wake_route_config ?? {}) as Record<string, unknown>;

    // Always emit the dedup Signal so existing delivery (push, email, telegram)
    // gets a chance to wake the human even when the wake_route is bespoke.
    const summarySource = draft.text;
    const summary =
      summarySource.length > 200 ? `${summarySource.slice(0, 197)}...` : summarySource;
    const recipientLabel = recipient?.display_name ?? draft.recipient_agent_id;
    const headline =
      draft.priority === "urgent"
        ? `🚨 Urgent draft for ${recipient?.emoji ?? ""} ${recipientLabel} (unread ${Math.round((nowMs - new Date(draft.created_at).getTime()) / 60_000)} min)`
        : `📨 Important draft for ${recipient?.emoji ?? ""} ${recipientLabel} (unread ${Math.round((nowMs - new Date(draft.created_at).getTime()) / 60_000)} min)`;

    const { error: signalErr } = await supabase.from("mc_signals").insert({
      api_key_hash: draft.api_key_hash,
      tool: "fishbowl",
      action: "draft_escalated",
      severity: "action_needed",
      summary: `${headline}: ${summary}`,
      deep_link: `/admin/fishbowl#draft-${draft.id}`,
      payload: {
        draft_id: draft.id,
        recipient_agent_id: draft.recipient_agent_id,
        sender_agent_id: draft.sender_agent_id,
        priority: draft.priority,
        wake_route_kind: wakeKind,
      },
    });
    if (signalErr) {
      console.error("[fishbowl-watcher] draft escalation signal insert error:", signalErr.message);
      continue;
    }
    draftEscalationsEmitted++;
    wakeRouteCounts[wakeKind] = (wakeRouteCounts[wakeKind] ?? 0) + 1;

    // Wake-route dispatch (best-effort, never blocks the loop).
    if (wakeKind === "github_issue" || wakeKind === "github_claude_mention") {
      const dispatched = await dispatchGithubWakeRoute(wakeKind, wakeConfig, draft, recipient);
      if (dispatched) draftWakeRouteDispatches++;
    }
    // 'cowork_scheduled_task', 'signals_only', and 'none' are covered by the
    // Signal above. cowork_scheduled_task is flagged for v2 (see PR body).
  }

  return res.status(200).json({
    checkin_signals_emitted: checkinSignalsEmitted,
    digest_signals_emitted: digestSignalsEmitted,
    overdue_candidates: candidates.length,
    tenants_with_unread_mentions: unreadCounts.size,
    draft_escalations_emitted: draftEscalationsEmitted,
    draft_wake_route_dispatches: draftWakeRouteDispatches,
    draft_candidates: escalatableDrafts.length,
    wake_route_breakdown: wakeRouteCounts,
  });
}

// ── Wake-route dispatch helpers ──────────────────────────────────────────
//
// GitHub-backed wake routes use REST calls (no LLM, no extra deps). They
// require GITHUB_TOKEN in env; when missing, the function returns false so
// the caller knows only the Signal landed. Errors never throw -- the
// Watcher should keep processing other drafts even if one route is broken.

async function dispatchGithubWakeRoute(
  kind: "github_issue" | "github_claude_mention",
  config: Record<string, unknown>,
  draft: DraftRow,
  recipient: RecipientProfileRow | undefined,
): Promise<boolean> {
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
  if (!token) {
    console.warn(
      `[fishbowl-watcher] wake_route ${kind} has no GITHUB_TOKEN; relying on Signal fallback.`,
    );
    return false;
  }
  const repo = typeof config.repo === "string" ? config.repo : "";
  if (!repo) return false;

  const recipientLabel = recipient?.display_name ?? draft.recipient_agent_id;
  const recipientEmoji = recipient?.emoji ?? "";
  const bodyText = [
    draft.text,
    "",
    "---",
    `priority: ${draft.priority}`,
    `from: ${draft.sender_emoji ?? ""} ${draft.sender_agent_id}`,
    `to: ${recipientEmoji} ${recipientLabel}`,
    `draft_id: ${draft.id}`,
    `dropped_at: ${draft.created_at}`,
  ].join("\n");

  try {
    if (kind === "github_issue") {
      const label = typeof config.label === "string" ? config.label : "wake-fishbowl";
      const title = `[wake-${recipientEmoji || "fishbowl"}] ${draft.text.slice(0, 80)}${draft.text.length > 80 ? "..." : ""}`;
      const resp = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, body: bodyText, labels: [label] }),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        console.error(`[fishbowl-watcher] github_issue dispatch failed (${resp.status}): ${text}`);
        return false;
      }
      return true;
    }
    if (kind === "github_claude_mention") {
      const issueNumber = typeof config.issue_number === "number" ? config.issue_number : 0;
      if (!issueNumber) return false;
      const commentBody = `@claude wake: ${recipientEmoji} ${recipientLabel} has an unread ${draft.priority} draft.\n\n${bodyText}`;
      const resp = await fetch(
        `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ body: commentBody }),
        },
      );
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        console.error(`[fishbowl-watcher] github_claude_mention dispatch failed (${resp.status}): ${text}`);
        return false;
      }
      return true;
    }
  } catch (err) {
    console.error(`[fishbowl-watcher] wake_route ${kind} threw: ${(err as Error).message}`);
  }
  return false;
}

