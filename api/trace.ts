/**
 * UnClick Trace API
 * Vercel serverless function — append-only trace log for agent activity.
 *
 * POST /api/trace
 *   Authorization: Bearer <unclick_api_key>   (required)
 *   Body: {
 *     run_id:         string (UUID)          required
 *     turn_number?:   number (default 1)
 *     parent_run_id?: string (UUID)
 *     surface?:       string                  e.g. "cowork" | "desktop" | "web" | "code"
 *     model?:         string                  e.g. "claude-opus-4-7"
 *     prompt?:        string                  the user's turn (omit for continuations)
 *     tool_calls?:    Array<{                 jsonb array
 *       name: string,
 *       input?: unknown,
 *       output?: unknown,
 *       duration_ms?: number,
 *       is_error?: boolean
 *     }>
 *     response_text?: string                  the assistant's final surface text
 *     outcome?:       "success" | "error" | "interrupted" | "unknown"
 *     user_reaction?: "thumb_up" | "thumb_down" | "retry" | "correction"
 *     score?:         number (1-5)
 *     error_signal?:  boolean
 *     metadata?:      Record<string, unknown> (tokens, cost, latency, client ver, etc.)
 *   }
 *   Returns: { id, run_id, turn_number }
 *
 * This endpoint is intentionally lenient — missing optional fields are
 * stored as NULL. The only hard requirement is `run_id`, because without
 * a grouping identifier the data is useless for any later analysis.
 *
 * Nothing reads from this yet. It exists so that when we're ready to
 * tune prompts / descriptions / context-assembly rules, we have a real
 * dataset to learn from instead of starting cold.
 *
 * Auth: same pattern as /api/credentials — a Bearer UnClick API key. We
 * hash it (sha256) for segmentation but never persist the raw key.
 *
 * Required env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as crypto from "crypto";

function sha256hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin",  "https://unclick.world");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed." });

  const supabaseUrl    = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: "Server credentials not configured." });
  }

  const authHeader = req.headers.authorization ?? "";
  const apiKey     = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!apiKey) return res.status(401).json({ error: "Authorization header required." });
  if (!apiKey.startsWith("uc_") && !apiKey.startsWith("agt_")) {
    return res.status(400).json({ error: "Invalid api_key format." });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;

  if (!isUuid(body.run_id)) {
    return res.status(400).json({ error: "run_id is required and must be a UUID." });
  }
  if (body.parent_run_id !== undefined && !isUuid(body.parent_run_id)) {
    return res.status(400).json({ error: "parent_run_id must be a UUID if provided." });
  }

  // Build the insert row. Unknown / absent fields go as null so Postgres
  // applies column defaults where they exist.
  const row = {
    run_id:         body.run_id,
    turn_number:    typeof body.turn_number === "number" ? body.turn_number : 1,
    parent_run_id:  body.parent_run_id ?? null,
    api_key_hash:   sha256hex(apiKey),
    surface:        typeof body.surface === "string" ? body.surface : null,
    model:          typeof body.model === "string" ? body.model : null,
    prompt:         typeof body.prompt === "string" ? body.prompt : null,
    tool_calls:     Array.isArray(body.tool_calls) ? body.tool_calls : [],
    response_text:  typeof body.response_text === "string" ? body.response_text : null,
    outcome:        typeof body.outcome === "string" ? body.outcome : null,
    user_reaction:  typeof body.user_reaction === "string" ? body.user_reaction : null,
    score:          typeof body.score === "number" ? body.score : null,
    error_signal:   typeof body.error_signal === "boolean" ? body.error_signal : false,
    metadata:       typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {},
  };

  const tableUrl = `${supabaseUrl}/rest/v1/agent_activity`;
  const headers: Record<string, string> = {
    apikey:          serviceRoleKey,
    Authorization:   `Bearer ${serviceRoleKey}`,
    "Content-Type":  "application/json",
    Prefer:          "return=representation",
  };

  const supaRes = await fetch(tableUrl, {
    method:  "POST",
    headers,
    body:    JSON.stringify(row),
  });

  if (!supaRes.ok) {
    // Fail soft: tracing must never break the caller's flow. Log to stderr
    // (which Vercel captures) and return a 202 with the error details so
    // well-behaved clients can retry on their own schedule.
    const errorText = await supaRes.text().catch(() => "");
    // eslint-disable-next-line no-console
    console.error("agent_activity insert failed", supaRes.status, errorText);
    return res.status(202).json({
      accepted: false,
      status:   supaRes.status,
      message:  "Trace not persisted; upstream error. Will not retry automatically.",
    });
  }

  const data = (await supaRes.json().catch(() => [])) as Array<Record<string, unknown>>;
  const saved = data[0] ?? {};

  return res.status(200).json({
    accepted:     true,
    id:           saved.id ?? null,
    run_id:       row.run_id,
    turn_number:  row.turn_number,
  });
}
