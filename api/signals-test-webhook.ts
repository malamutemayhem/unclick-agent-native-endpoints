import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

async function resolveApiKeyHash(req: VercelRequest, supabaseUrl: string, supabaseKey: string): Promise<string | null> {
  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data } = await supabase.auth.getUser(token);
  if (!data.user) return null;
  const userId = data.user.id;
  const hash = crypto.createHash("sha256").update(userId).digest("hex");
  return hash;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST required" });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: "Database service unavailable" });

  const apiKeyHash = await resolveApiKeyHash(req, supabaseUrl, supabaseKey);
  if (!apiKeyHash) return res.status(401).json({ error: "Authorization header required" });

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: prefs } = await supabase
    .from("mc_signal_preferences")
    .select("webhook_url, webhook_secret")
    .eq("api_key_hash", apiKeyHash)
    .maybeSingle();

  if (!prefs?.webhook_url) return res.status(400).json({ error: "No webhook URL configured" });

  const payload = {
    tool: "UnClick",
    action: "test",
    severity: "info",
    summary: "This is a test signal from UnClick.",
    deep_link: "/admin/signals",
    created_at: new Date().toISOString(),
    batched_count: 1,
    signal_ids: ["test"],
  };
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (prefs.webhook_secret) {
    const sig = crypto.createHmac("sha256", prefs.webhook_secret).update(body).digest("hex");
    headers["X-UnClick-Signature"] = `sha256=${sig}`;
  }

  try {
    const r = await fetch(prefs.webhook_url, { method: "POST", headers, body });
    return res.status(200).json({ ok: r.ok, status: r.status });
  } catch (err) {
    return res.status(502).json({ error: String(err) });
  }
}
