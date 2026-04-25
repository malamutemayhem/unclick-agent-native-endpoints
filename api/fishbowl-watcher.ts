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
 *
 * Dedup: each emission checks for a recent identical-action signal so we
 * never spam (30 min for missed check-ins, 60 min for digests).
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

const CHECKIN_DEDUP_WINDOW_MS = 30 * 60 * 1000;
const MENTION_DIGEST_DEDUP_WINDOW_MS = 60 * 60 * 1000;
const MENTION_AGE_THRESHOLD_MS = 10 * 60 * 1000;

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

  return res.status(200).json({
    checkin_signals_emitted: checkinSignalsEmitted,
    digest_signals_emitted: digestSignalsEmitted,
    overdue_candidates: candidates.length,
    tenants_with_unread_mentions: unreadCounts.size,
  });
}
