/**
 * POST /api/memory/embed
 *
 * Generates an OpenAI text-embedding-3-small embedding for a memory row and
 * writes it back to the database. Called by the backfill script and can be
 * triggered on-demand for newly inserted rows.
 *
 * Body: { id: string, table: "mc_extracted_facts" | "mc_session_summaries" |
 *                              "extracted_facts" | "session_summaries",
 *         text: string, force?: boolean }
 *
 * Auth: ADMIN_EMBED_SECRET header (server-side only, never exposed to clients).
 * Returns: { ok: true, skipped?: boolean }
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_TABLES = new Set([
  "mc_extracted_facts",
  "mc_session_summaries",
  "extracted_facts",
  "session_summaries",
]);

const EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_INPUT_CHARS = 32_000;

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

function shouldSkipMemoryEmbedding(text: string): boolean {
  const value = text.trim();
  if (!value) return true;

  const lower = value.toLowerCase();
  if (lower.length < 24) return true;
  if (lower.startsWith("heartbeat_last_state:")) return true;
  if (lower.includes("<heartbeat") || lower.includes("</heartbeat>")) return true;

  return [
    "dont_notify",
    "unclick healthy",
    "no new signals",
    "user is caught up",
    "memory self-echo",
    "fact saved: heartbeat_last_state",
    "only memory self-echo signals",
    "top queue unchanged",
  ].some((needle) => lower.includes(needle));
}

async function getEmbedding(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.slice(0, MAX_INPUT_CHARS),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI embeddings error ${res.status}: ${body}`);
  }
  const data = (await res.json()) as OpenAIEmbeddingResponse;
  const vec = data.data[0]?.embedding;
  if (!vec) throw new Error("OpenAI returned no embedding");
  return vec;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  // Server-side auth - this endpoint must never be callable by end users
  const secret = process.env.ADMIN_EMBED_SECRET;
  if (!secret) {
    return res.status(503).json({ error: "embed endpoint not configured" });
  }
  const provided = req.headers["x-embed-secret"] ?? req.headers["authorization"]?.replace("Bearer ", "");
  if (provided !== secret) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return res.status(503).json({ error: "OPENAI_API_KEY not configured" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  const body = req.body as Record<string, unknown>;
  const id = typeof body?.id === "string" ? body.id : null;
  const table = typeof body?.table === "string" ? body.table : null;
  const text = typeof body?.text === "string" ? body.text : null;
  const force = body?.force === true;

  if (!id || !table || !text) {
    return res.status(400).json({ error: "id, table, and text are required" });
  }
  if (!ALLOWED_TABLES.has(table)) {
    return res.status(400).json({ error: `table must be one of: ${[...ALLOWED_TABLES].join(", ")}` });
  }
  if (shouldSkipMemoryEmbedding(text)) {
    return res.status(200).json({ ok: true, skipped: true, reason: "low_value_memory" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Idempotency: skip if embedding already present (unless force=true)
  if (!force) {
    const { data: existing, error: checkErr } = await supabase
      .from(table)
      .select("embedding")
      .eq("id", id)
      .single();
    if (checkErr) {
      return res.status(500).json({ error: `db check failed: ${checkErr.message}` });
    }
    if ((existing as Record<string, unknown>)?.embedding !== null &&
        (existing as Record<string, unknown>)?.embedding !== undefined) {
      return res.status(200).json({ ok: true, skipped: true });
    }
  }

  let embedding: number[];
  try {
    embedding = await getEmbedding(text, openaiKey);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: msg });
  }

  const { error: updateErr } = await supabase
    .from(table)
    .update({
      embedding: JSON.stringify(embedding),
      embedding_model: EMBEDDING_MODEL,
      embedding_created_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    return res.status(500).json({ error: `db write failed: ${updateErr.message}` });
  }

  return res.status(200).json({ ok: true });
}
