import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import webpush from "web-push";

interface SignalRow {
  id: string;
  api_key_hash: string;
  tool: string;
  action: string;
  severity: "info" | "action_needed" | "critical";
  summary: string;
  deep_link: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  held_until: string | null;
}

interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface PreferencesRow {
  api_key_hash: string;
  email_enabled: boolean;
  email_address: string | null;
  phone_push_enabled: boolean;
  telegram_enabled: boolean;
  telegram_chat_id: string | null;
  browser_push_enabled: boolean;
  push_subscription: PushSubscription | null;
  webhook_url: string | null;
  webhook_secret: string | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  min_severity: "info" | "action_needed" | "critical";
  per_tool_overrides: Record<string, unknown> | null;
  routing_rules: Record<string, string[]> | null;
}

interface BatchGroup {
  signals: SignalRow[];
  representative: SignalRow;
  count: number;
}

const SEVERITY_RANK: Record<"info" | "action_needed" | "critical", number> = {
  info: 0,
  action_needed: 1,
  critical: 2,
};

function isInQuietHours(start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const now = new Date();
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (startMin <= endMin) return nowMin >= startMin && nowMin < endMin;
  return nowMin >= startMin || nowMin < endMin;
}

function quietHoursEndAt(end: string): string {
  const [eh, em] = end.split(":").map(Number);
  const d = new Date();
  d.setUTCHours(eh, em, 0, 0);
  if (d.getTime() <= Date.now()) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

function resolveChannels(prefs: PreferencesRow, tool: string, action: string): string[] {
  const rule = prefs.routing_rules?.[`${tool}:${action}`];
  if (rule) return rule;
  const all: string[] = [];
  if (prefs.email_enabled && prefs.email_address) all.push("email");
  if (prefs.telegram_enabled && prefs.telegram_chat_id) all.push("telegram");
  if (prefs.browser_push_enabled && prefs.push_subscription) all.push("browser_push");
  if (prefs.webhook_url) all.push("webhook");
  return all;
}

function buildBatchGroups(signals: SignalRow[]): BatchGroup[] {
  const byKey = new Map<string, SignalRow[]>();
  for (const s of signals) {
    const key = `${s.api_key_hash}:${s.tool}:${s.action}`;
    const arr = byKey.get(key) ?? [];
    arr.push(s);
    byKey.set(key, arr);
  }
  const groups: BatchGroup[] = [];
  for (const sigs of byKey.values()) {
    sigs.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const first = new Date(sigs[0].created_at).getTime();
    const last = new Date(sigs[sigs.length - 1].created_at).getTime();
    if (last - first <= 60_000) {
      groups.push({ signals: sigs, representative: sigs[sigs.length - 1], count: sigs.length });
    } else {
      for (const s of sigs) groups.push({ signals: [s], representative: s, count: 1 });
    }
  }
  return groups;
}

function formatBatchSummary(group: BatchGroup): string {
  const { representative: r, count } = group;
  if (count === 1) return r.summary;
  return `${r.tool} ran ${count} times. Latest: ${r.summary}`;
}

async function sendEmail(params: { to: string; subject: string; text: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "UnClick Signals <signals@unclick.world>",
        to: [params.to],
        subject: params.subject,
        text: params.text,
      }),
    });
    if (!res.ok) {
      console.error("[signals-dispatch] Resend error:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[signals-dispatch] email error:", err);
    return false;
  }
}

async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[signals-dispatch] TELEGRAM_BOT_TOKEN not set");
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
    if (!res.ok) {
      console.error("[signals-dispatch] Telegram error:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[signals-dispatch] Telegram network error:", err);
    return false;
  }
}

async function sendWebhook(
  url: string,
  secret: string | null,
  payload: Record<string, unknown>
): Promise<boolean> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) {
    const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
    headers["X-UnClick-Signature"] = `sha256=${sig}`;
  }
  try {
    const res = await fetch(url, { method: "POST", headers, body });
    if (!res.ok) {
      console.error("[signals-dispatch] webhook error:", res.status, url);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[signals-dispatch] webhook network error:", err);
    return false;
  }
}

async function sendBrowserPush(sub: PushSubscription, title: string, body: string, url: string): Promise<boolean> {
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:signals@unclick.world";
  if (!vapidPublic || !vapidPrivate) {
    console.warn("[signals-dispatch] VAPID keys not set");
    return false;
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  try {
    await webpush.sendNotification(sub, JSON.stringify({ title, body, url }));
    return true;
  } catch (err) {
    console.error("[signals-dispatch] browser push error:", err);
    return false;
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

  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() - 35_000).toISOString();
  const { data: signals, error } = await supabase
    .from("mc_signals")
    .select("id, api_key_hash, tool, action, severity, summary, deep_link, payload, created_at, held_until")
    .is("read_at", null)
    .lt("created_at", cutoff)
    .or(`held_until.is.null,held_until.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    console.error("[signals-dispatch] fetch error:", error.message);
    return res.status(500).json({ error: error.message });
  }

  const rows = (signals ?? []) as SignalRow[];
  const pending = rows.filter((s) => {
    const p = (s.payload ?? {}) as Record<string, unknown>;
    return !p.dispatched_at;
  });

  if (pending.length === 0) return res.status(200).json({ dispatched: 0, skipped: 0 });

  const apiKeyHashes = Array.from(new Set(pending.map((s) => s.api_key_hash)));
  const { data: prefsRows } = await supabase
    .from("mc_signal_preferences")
    .select("*")
    .in("api_key_hash", apiKeyHashes);

  const prefsByHash = new Map<string, PreferencesRow>();
  for (const p of (prefsRows ?? []) as PreferencesRow[]) {
    prefsByHash.set(p.api_key_hash, p);
  }

  let dispatched = 0;
  let skipped = 0;

  // Filter by min_severity first, then check quiet hours per user
  const toDispatch: SignalRow[] = [];
  for (const signal of pending) {
    const prefs = prefsByHash.get(signal.api_key_hash);
    if (!prefs) { skipped++; continue; }

    const minRank = SEVERITY_RANK[prefs.min_severity ?? "info"];
    if ((SEVERITY_RANK[signal.severity] ?? 0) < minRank) { skipped++; continue; }

    if (isInQuietHours(prefs.quiet_hours_start, prefs.quiet_hours_end)) {
      const heldUntil = quietHoursEndAt(prefs.quiet_hours_end!);
      await supabase.from("mc_signals").update({ held_until: heldUntil }).eq("id", signal.id);
      skipped++;
      continue;
    }

    toDispatch.push(signal);
  }

  // Build batch groups per user
  const groups = buildBatchGroups(toDispatch);

  for (const group of groups) {
    const prefs = prefsByHash.get(group.representative.api_key_hash)!;
    const r = group.representative;
    const summary = formatBatchSummary(group);
    const channels = resolveChannels(prefs, r.tool, r.action);

    if (channels.includes("in_admin") || channels.length === 0) {
      // Visible in admin UI already; no external notification needed
      for (const s of group.signals) {
        await supabase.from("mc_signals").update({
          payload: { ...(s.payload ?? {}), dispatched_at: new Date().toISOString(), dispatched_channels: ["in_admin"] },
        }).eq("id", s.id);
      }
      skipped += group.count;
      continue;
    }

    const sent: string[] = [];

    if (channels.includes("email") && prefs.email_address) {
      const prefix = r.severity === "critical" ? "Action needed" : "Update";
      const subject = `[UnClick] ${prefix}: ${summary}`;
      const lines = [
        summary,
        "",
        `Tool: ${r.tool}`,
        `Action: ${r.action}`,
        `Severity: ${r.severity}`,
        `When: ${r.created_at}`,
        group.count > 1 ? `Batched: ${group.count} events` : "",
        r.deep_link ? `Open: https://unclick.world${r.deep_link}` : "",
        "",
        "Manage preferences: https://unclick.world/admin/signals/settings",
      ].filter(Boolean).join("\n");
      if (await sendEmail({ to: prefs.email_address, subject, text: lines })) sent.push("email");
    }

    if (channels.includes("telegram") && prefs.telegram_chat_id) {
      const icon = r.severity === "critical" ? "red_circle" : r.severity === "action_needed" ? "large_yellow_circle" : "large_blue_circle";
      const msg = [
        `:${icon}: *${r.tool}* (${r.action})`,
        "",
        summary,
        group.count > 1 ? `_${group.count} events batched_` : "",
        r.deep_link ? `[Open in UnClick](https://unclick.world${r.deep_link})` : "",
      ].filter(Boolean).join("\n");
      if (await sendTelegram(prefs.telegram_chat_id, msg)) sent.push("telegram");
    }

    if (channels.includes("browser_push") && prefs.push_subscription) {
      const pushUrl = r.deep_link ? `https://unclick.world${r.deep_link}` : "https://unclick.world/admin/signals";
      if (await sendBrowserPush(prefs.push_subscription, `UnClick: ${r.tool}`, summary, pushUrl)) {
        sent.push("browser_push");
      }
    }

    if (channels.includes("webhook") && prefs.webhook_url) {
      const webhookPayload = {
        tool: r.tool,
        action: r.action,
        severity: r.severity,
        summary,
        deep_link: r.deep_link,
        created_at: r.created_at,
        batched_count: group.count,
        signal_ids: group.signals.map((s) => s.id),
      };
      if (await sendWebhook(prefs.webhook_url, prefs.webhook_secret ?? null, webhookPayload)) {
        sent.push("webhook");
      }
    }

    const didSend = sent.length > 0;
    for (const s of group.signals) {
      await supabase.from("mc_signals").update({
        payload: {
          ...(s.payload ?? {}),
          dispatched_at: new Date().toISOString(),
          dispatched_channels: sent,
        },
      }).eq("id", s.id);
    }

    if (didSend) dispatched += group.count;
    else skipped += group.count;
  }

  return res.status(200).json({ dispatched, skipped });
}
