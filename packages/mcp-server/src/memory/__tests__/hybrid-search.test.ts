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

// ─── 2a. Keyword fallback asOf filtering ─────────────────────────────────────

class FakeQuery {
  calls: Array<{ method: string; args: unknown[] }> = [];

  constructor(public table: string) {}

  select(...args: unknown[]) { return this.call("select", args); }
  eq(...args: unknown[]) { return this.call("eq", args); }
  is(...args: unknown[]) { return this.call("is", args); }
  ilike(...args: unknown[]) { return this.call("ilike", args); }
  or(...args: unknown[]) { return this.call("or", args); }
  lte(...args: unknown[]) { return this.call("lte", args); }
  order(...args: unknown[]) { return this.call("order", args); }
  limit(...args: unknown[]) { return this.call("limit", args); }

  then<TResult1 = { data: unknown[] }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[] }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: [] }).then(onfulfilled, onrejected);
  }

  private call(method: string, args: unknown[]) {
    this.calls.push({ method, args });
    return this;
  }
}

class FakeClient {
  queries: FakeQuery[] = [];

  from(table: string) {
    const query = new FakeQuery(table);
    this.queries.push(query);
    return query;
  }
}

describe("keyword fallback asOf cutoff", () => {
  test("filters fallback facts by valid time and sessions by created_at", async () => {
    const { SupabaseBackend } = await import("../supabase.js");
    const client = new FakeClient();
    const backend = Object.create(SupabaseBackend.prototype) as {
      client: FakeClient;
      tenancy: { mode: "byod" };
      tables: { extracted_facts: string; session_summaries: string };
      keywordFallback: (query: string, maxResults: number, asOf?: string) => Promise<unknown[]>;
    };
    backend.client = client;
    backend.tenancy = { mode: "byod" };
    backend.tables = {
      extracted_facts: "extracted_facts",
      session_summaries: "session_summaries",
    };

    const asOf = "2025-04-01T00:00:00Z";
    const results = await backend.keywordFallback("UnClick", 3, asOf);
    assert.deepEqual(results, []);

    const factQuery = client.queries.find((q) => q.table === "extracted_facts");
    const sessionQuery = client.queries.find((q) => q.table === "session_summaries");
    assert.ok(factQuery, "facts query should run");
    assert.ok(sessionQuery, "session query should run");
    assert.ok(
      factQuery.calls.some((c) => c.method === "lte" && c.args[0] === "valid_from" && c.args[1] === asOf),
      "facts fallback should not return facts created after asOf"
    );
    assert.ok(
      factQuery.calls.some(
        (c) => c.method === "or" && c.args[0] === `valid_to.is.null,valid_to.gt.${asOf}`
      ),
      "facts fallback should honor valid_to when asOf is provided"
    );
    assert.ok(
      sessionQuery.calls.some((c) => c.method === "lte" && c.args[0] === "created_at" && c.args[1] === asOf),
      "session fallback should not return summaries created after asOf"
    );
  });
});

// ─── 2b. Keyword-fallback regression (P0) ─────────────────────────────────────
//
// Reproduces the production bug: a fact with NULL embedding whose proper-noun
// content does not survive plainto_tsquery('english', ...) tokenization.
// Hybrid returns []. ILIKE fallback must surface the row anyway.

describe("acceptance: keyword fallback restores search when hybrid returns []", () => {
  test("ILIKE fallback finds proper-noun fact with NULL embedding", async () => {
    const url = process.env.TEST_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.log("    [skipped] set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to run");
      return;
    }
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    const factText = "Test owner is Chris Byrne for P0 search-memory regression";
    const { data: inserted, error: insertErr } = await supabase
      .from("extracted_facts")
      .insert({
        fact: factText,
        category: "test",
        confidence: 0.9,
        status: "active",
        source_type: "test",
        decay_tier: "hot",
        // Deliberately leave embedding NULL to simulate legacy / un-backfilled rows
      })
      .select("id")
      .single();
    assert.ok(!insertErr, `insert failed: ${insertErr?.message}`);
    const factId = (inserted as { id: string }).id;

    try {
      // Force the keyword path by removing OPENAI_API_KEY: searchMemory will
      // skip the hybrid lane and exercise keywordFallback directly.
      const savedOpenAI = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      try {
        const { SupabaseBackend } = await import("../supabase.js");
        const backend = new SupabaseBackend({
          url,
          serviceRoleKey: key,
          tenancy: { mode: "byod" },
        });
        const results = (await backend.searchMemory("Chris", 10)) as Array<{ id: string }>;
        assert.ok(Array.isArray(results), "fallback should return an array");
        const ids = results.map((r) => r.id);
        assert.ok(
          ids.includes(factId),
          `Expected fact ${factId} via ILIKE fallback. Got ${ids.length} rows: ${JSON.stringify(results.slice(0, 3))}`
        );
        console.log(`    [passed] keyword fallback surfaced fact at position ${ids.indexOf(factId) + 1}`);
      } finally {
        if (savedOpenAI !== undefined) process.env.OPENAI_API_KEY = savedOpenAI;
      }
    } finally {
      await supabase.from("extracted_facts").delete().eq("id", factId);
    }
  });

  // Phrase-query regression: a multi-word query like "active Fishbowl topic"
  // used to ILIKE the literal whole string and miss any fact whose words were
  // present but interleaved with other words. The fix tokenizes the query and
  // ANDs each token; if AND returns nothing it degrades to OR-of-tokens.
  test("multi-word query finds facts containing all tokens in any order (AND mode)", async () => {
    const url = process.env.TEST_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.log("    [skipped] set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to run");
      return;
    }
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    const factText = "Current Fishbowl thread tracks the active topic for Phase 1.1 hotfix";
    const { data: inserted, error: insertErr } = await supabase
      .from("extracted_facts")
      .insert({
        fact: factText,
        category: "test",
        confidence: 0.9,
        status: "active",
        source_type: "test",
        decay_tier: "hot",
      })
      .select("id")
      .single();
    assert.ok(!insertErr, `insert failed: ${insertErr?.message}`);
    const factId = (inserted as { id: string }).id;

    try {
      const savedOpenAI = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      try {
        const { SupabaseBackend } = await import("../supabase.js");
        const backend = new SupabaseBackend({ url, serviceRoleKey: key, tenancy: { mode: "byod" } });
        // All three tokens appear in the fact, but not as a contiguous phrase.
        const results = (await backend.searchMemory("active Fishbowl topic", 10)) as Array<{ id: string }>;
        const ids = results.map((r) => r.id);
        assert.ok(
          ids.includes(factId),
          `Expected fact ${factId} via tokenized AND. Got: ${JSON.stringify(results.slice(0, 3))}`
        );
      } finally {
        if (savedOpenAI !== undefined) process.env.OPENAI_API_KEY = savedOpenAI;
      }
    } finally {
      await supabase.from("extracted_facts").delete().eq("id", factId);
    }
  });

  test("OR fallback surfaces best partial match when no fact contains every token", async () => {
    const url = process.env.TEST_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.log("    [skipped] set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to run");
      return;
    }
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    // Fact contains "architecture" but not "thread". Query is "architecture
    // thread nonexistent" so AND-of-tokens returns []; OR-of-tokens should
    // still surface this row because it matches one token.
    const factText = "Memory architecture uses six layers including bitemporal facts";
    const { data: inserted, error: insertErr } = await supabase
      .from("extracted_facts")
      .insert({
        fact: factText,
        category: "test",
        confidence: 0.8,
        status: "active",
        source_type: "test",
        decay_tier: "hot",
      })
      .select("id")
      .single();
    assert.ok(!insertErr, `insert failed: ${insertErr?.message}`);
    const factId = (inserted as { id: string }).id;

    try {
      const savedOpenAI = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      try {
        const { SupabaseBackend } = await import("../supabase.js");
        const backend = new SupabaseBackend({ url, serviceRoleKey: key, tenancy: { mode: "byod" } });
        const results = (await backend.searchMemory("architecture thread zzznonexistentzzz", 10)) as Array<{ id: string }>;
        const ids = results.map((r) => r.id);
        assert.ok(
          ids.includes(factId),
          `Expected fact ${factId} via OR-of-tokens fallback. Got: ${JSON.stringify(results.slice(0, 3))}`
        );
      } finally {
        if (savedOpenAI !== undefined) process.env.OPENAI_API_KEY = savedOpenAI;
      }
    } finally {
      await supabase.from("extracted_facts").delete().eq("id", factId);
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
