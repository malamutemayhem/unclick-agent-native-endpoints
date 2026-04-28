// Nightly memory-health scorer.
//
// pg_cron is not enabled on this project, so the schedule lives at
// the edge-function layer. Wire the Supabase dashboard cron UI to
// fire this function at 02:00 UTC daily. Once pg_cron is available,
// the schedule can move into SQL (see 20260420010000_memory_health.sql).
//
// Flow:
//   1. List distinct api_key_hashes from memory-bearing tables.
//   2. For each hash, call mc_score_memory_health(p_api_key_hash)
//      which upserts mc_memory_health.
//   3. Return a small JSON summary for observability.

// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async () => {
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: factRows, error: factListErr } = await supabase
    .from("mc_extracted_facts")
    .select("api_key_hash")
    .eq("status", "active");

  if (factListErr) {
    return json({ error: factListErr.message }, 500);
  }

  const { data: summaryRows, error: summaryListErr } = await supabase
    .from("mc_session_summaries")
    .select("api_key_hash");

  if (summaryListErr) {
    return json({ error: summaryListErr.message }, 500);
  }

  const hashes = Array.from(
    new Set(
      [...(factRows ?? []), ...(summaryRows ?? [])]
        .map((r: any) => r.api_key_hash)
        .filter(Boolean),
    ),
  );

  const results: Array<{ api_key_hash: string; ok: boolean; error?: string }> = [];
  for (const h of hashes) {
    const { error } = await supabase.rpc("mc_score_memory_health", {
      p_api_key_hash: h,
    });
    results.push({
      api_key_hash: h,
      ok: !error,
      error: error?.message,
    });
  }

  return json({
    scored: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    total: results.length,
    results,
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
