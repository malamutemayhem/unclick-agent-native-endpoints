import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

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
}

interface PreferencesRow {
  api_key_hash: string;
  email_enabled: boolean;
  email_address: string | null;
  phone_push_enabled: boolean;
  telegram_enabled: boolean;
  telegram_chat_id: string | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  min_severity: "info" | "action_needed" | "critical";
  per_tool_overrides: Record<string, unknown> | null;
}

const SEVERITY_RANK: Record<"info" | "action_needed" | "critical", number> = {
  info: 0,
  action_needed: 1,
  critical: 2,
};

function displaySeverity(signal: SignalRow): string {
  const payload = signal.payload ?? {};
  if (signal.tool === "fishbowl" && payload.policy_label === "warning") {
    return "warning";
  }
  return signal.severity;
}

async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[signals-dispatch] RESEND_API_KEY not set, skipping email");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "UnClick Signals <signals@unclick.world>",
        to: [params.to],
        subject: params.subject,
        text: params.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[signals-dispatch] Resend error:", res.status, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[signals-dispatch] network error:", err);
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

  const cutoff = new Date(Date.now() - 35_000).toISOString();
  const { data: signals, error } = await supabase
    .from("mc_signals")
    .select("id, api_key_hash, tool, action, severity, summary, deep_link, payload, created_at")
    .is("read_at", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    console.error("[signals-dispatch] fetch error:", error.message);
    return res.status(500).json({ error: error.message });
  }

  const rows = (signals ?? []) as SignalRow[];
  const pending = rows.filter((s) => {
    const dispatched = (s.payload ?? {}) as Record<string, unknown>;
    return !dispatched.dispatched_at;
  });

  if (pending.length === 0) {
    return res.status(200).json({ dispatched: 0, skipped: 0 });
  }

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

  for (const signal of pending) {
    const prefs = prefsByHash.get(signal.api_key_hash);
    if (!prefs) {
      skipped++;
      continue;
    }

    const minRank = SEVERITY_RANK[prefs.min_severity ?? "info"];
    const sigRank = SEVERITY_RANK[signal.severity] ?? 0;
    if (sigRank < minRank) {
      skipped++;
      continue;
    }

    let sent = false;

    if (prefs.email_enabled && prefs.email_address) {
      const severityLabel = displaySeverity(signal);
      const subjectPrefix =
        signal.severity === "critical"
          ? "Action needed"
          : severityLabel === "warning"
            ? "Warning"
            : "Update";
      const subject = `[UnClick] ${subjectPrefix}: ${signal.summary}`;
      const textBody = [
        signal.summary,
        "",
        `Tool: ${signal.tool}`,
        `Action: ${signal.action}`,
        `Severity: ${severityLabel}`,
        `When: ${signal.created_at}`,
        signal.deep_link ? `Open: https://unclick.world${signal.deep_link}` : "",
        "",
        "Manage signal preferences: https://unclick.world/admin/signals/settings",
      ].filter(Boolean).join("\n");
      const ok = await sendEmail({
        to: prefs.email_address,
        subject,
        text: textBody,
      });
      sent = sent || ok;
    }

    if (prefs.phone_push_enabled) {
      console.log("[signals-dispatch] cowork push pending integration");
    }

    if (prefs.telegram_enabled) {
      console.log("[signals-dispatch] telegram pending Phase 2");
    }

    const newPayload = {
      ...(signal.payload ?? {}),
      dispatched_at: new Date().toISOString(),
      dispatched_channels: [
        sent ? "email" : null,
      ].filter(Boolean),
    };
    await supabase
      .from("mc_signals")
      .update({ payload: newPayload })
      .eq("id", signal.id);

    if (sent) dispatched++;
    else skipped++;
  }

  return res.status(200).json({ dispatched, skipped });
}
