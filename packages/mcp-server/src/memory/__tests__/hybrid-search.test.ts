/**
 * Tests for hybrid RRF search logic.
 *
 * Run: npx tsx --test src/memory/__tests__/hybrid-search.test.ts
 * (from packages/mcp-server directory)
 *
 * Tests:
 *   1. RRF scoring math (pure function, no DB required)
 *   2. embedText graceful null return when OPENAI_API_KEY absent
 *   3. Acceptance test: semantic query finds fact that keyword search misses
 *      (requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + OPENAI_API_KEY)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

// ─── 1. RRF scoring math ──────────────────────────────────────────────────────
//
// The SQL computes RRF inline; this TypeScript mirror lets us verify the math
// without a database. The SQL and this function must stay in sync.

interface RRFInput {
  kwRank?: number;  // 1-based rank in keyword lane (undefined = not in keyword top-50)
  vecRank?: number; // 1-based rank in vector lane (undefined = not in vector top-50)
  confidence: number;
  ageDays: number;
  k?: number;       // RRF constant (default 60)
}

function computeRRFScore(input: RRFInput): {
  rrf: number;
  final: number;
} {
  const k = input.k ?? 60;
  const kwContrib = input.kwRank !== undefined ? 1 / (k + input.kwRank) : 0;
  const vecContrib = input.vecRank !== undefined ? 1 / (k + input.vecRank) : 0;
  const rrf = kwContrib + vecContrib;
  const recency = Math.exp(-input.ageDays / 90);
  const final = rrf * input.confidence * recency;
  return { rrf, final };
}

describe("RRF scoring math", () => {
  test("row in both lanes scores higher than row in one lane", () => {
    const both = computeRRFScore({ kwRank: 1, vecRank: 1, confidence: 1, ageDays: 0 });
    const kwOnly = computeRRFScore({ kwRank: 1, confidence: 1, ageDays: 0 });
    const vecOnly = computeRRFScore({ vecRank: 1, confidence: 1, ageDays: 0 });
    assert.ok(both.rrf > kwOnly.rrf, "both > kw-only");
    assert.ok(both.rrf > vecOnly.rrf, "both > vec-only");
  });

  test("RRF rank 1 beats rank 50 in same lane", () => {
    const top = computeRRFScore({ kwRank: 1, confidence: 1, ageDays: 0 });
    const bottom = computeRRFScore({ kwRank: 50, confidence: 1, ageDays: 0 });
    assert.ok(top.rrf > bottom.rrf);
  });

  test("recency decay: 0-day-old > 90-day-old > 180-day-old", () => {
    const base = { kwRank: 1, confidence: 1, k: 60 };
    const fresh = computeRRFScore({ ...base, ageDays: 0 });
    const mid = computeRRFScore({ ...base, ageDays: 90 });
    const old = computeRRFScore({ ...base, ageDays: 180 });
    assert.ok(fresh.final > mid.final, "fresh > mid");
    assert.ok(mid.final > old.final, "mid > old");
    // 90-day decay factor should be ~1/e ≈ 0.368
    assert.ok(Math.abs(mid.final / fresh.final - Math.exp(-1)) < 0.001, "90d decay ≈ 1/e");
  });

  test("confidence 0.9 row can beat confidence 1.0 row with better RRF", () => {
    // A result ranked 1st in both lanes at 0.9 confidence should beat a result
    // ranked 50th in one lane at 1.0 confidence with same recency.
    const highRRF = computeRRFScore({ kwRank: 1, vecRank: 1, confidence: 0.9, ageDays: 0 });
    const lowRRF = computeRRFScore({ kwRank: 50, confidence: 1.0, ageDays: 0 });
    assert.ok(highRRF.final > lowRRF.final);
  });

  test("RRF k=60 exact values for rank 1", () => {
    // 1/(60+1) = 0.016393...
    const score = computeRRFScore({ kwRank: 1, confidence: 1, ageDays: 0 });
    assert.ok(Math.abs(score.rrf - 1 / 61) < 1e-10);
  });

  test("row absent from both lanes scores 0", () => {
    const score = computeRRFScore({ confidence: 1, ageDays: 0 });
    assert.equal(score.rrf, 0);
    assert.equal(score.final, 0);
  });
});

// ─── 2. embedText returns null when key absent ────────────────────────────────

describe("embedText", () => {
  test("returns null when OPENAI_API_KEY is not set", async () => {
    // Ensure the env var is absent for this test
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      // Dynamic import so it picks up the (now absent) env var at call time
      const { embedText } = await import("../embeddings.js");
      const result = await embedText("test query");
      assert.equal(result, null);
    } finally {
      if (saved !== undefined) process.env.OPENAI_API_KEY = saved;
    }
  });
});

// ─── 3. Acceptance test (LOCOMO-style) ────────────────────────────────────────
//
// Requires real credentials. Skipped automatically when env vars are absent.
// This is the key regression test: a query that previously returned [] should
// now return the expected fact in top-5 after backfill.

describe("acceptance: hybrid search finds semantically similar fact", () => {
  test("'preference for functional programming' found by 'avoids OOP' query", async () => {
    const url = process.env.TEST_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!url || !key || !openaiKey) {
      console.log("    [skipped] set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY to run");
      return;
    }

    const { createClient } = await import("@supabase/supabase-js");
    const { embedText, EMBEDDING_MODEL } = await import("../embeddings.js");

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Insert a test fact
    const factText = "User strongly prefers functional programming over object-oriented patterns";
    const { data: inserted, error: insertErr } = await supabase
      .from("extracted_facts")
      .insert({
        fact: factText,
        category: "preference",
        confidence: 0.95,
        status: "active",
        source_type: "test",
        decay_tier: "hot",
      })
      .select("id")
      .single();
    assert.ok(!insertErr, `insert failed: ${insertErr?.message}`);
    const factId = (inserted as { id: string }).id;

    try {
      // Embed the fact
      const factEmbedding = await embedText(factText);
      assert.ok(factEmbedding, "failed to embed fact");
      await supabase
        .from("extracted_facts")
        .update({
          embedding: JSON.stringify(factEmbedding),
          embedding_model: EMBEDDING_MODEL,
          embedding_created_at: new Date().toISOString(),
        })
        .eq("id", factId);

      // Search with a semantically related but keyword-different query
      const query = "avoids class hierarchies and OOP";
      const queryEmbedding = await embedText(query);
      assert.ok(queryEmbedding, "failed to embed query");

      const { data: results, error: searchErr } = await supabase.rpc(
        "search_memory_hybrid",
        {
          search_query: query,
          query_embedding: queryEmbedding,
          max_results: 5,
        }
      );
      assert.ok(!searchErr, `hybrid search failed: ${searchErr?.message}`);
      assert.ok(Array.isArray(results), "results should be array");

      const ids = (results as Array<{ id: string }>).map((r) => r.id);
      assert.ok(ids.includes(factId),
        `Expected fact ${factId} in top-5. Got: ${JSON.stringify(results)}`
      );
      console.log(`    [passed] fact found at position ${ids.indexOf(factId) + 1} of ${ids.length}`);
    } finally {
      // Clean up
      await supabase.from("extracted_facts").delete().eq("id", factId);
    }
  });
});
