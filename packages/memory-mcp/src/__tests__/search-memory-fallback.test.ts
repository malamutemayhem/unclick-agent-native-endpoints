/**
 * Tests for the search_memory hybrid + ILIKE keyword fallback ported from
 * @unclick/mcp-server.
 *
 * Run from packages/memory-mcp:
 *   npm test
 *
 * The integration test (skipped without TEST_SUPABASE_URL +
 * TEST_SUPABASE_SERVICE_ROLE_KEY) reproduces the production bug: a fact
 * with NULL embedding whose proper-noun content does not survive
 * plainto_tsquery tokenization. Hybrid returns []. ILIKE fallback must
 * surface the row anyway.
 *
 * The unit tests use a recording fake of the supabase-js client so we
 * can verify the tokenization rules and AND/OR mode logic without a
 * database.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

// ─── Recording supabase-js fake ────────────────────────────────────────────
//
// The real supabase-js client returns a thenable QueryBuilder where every
// modifier (.eq, .ilike, .or, .order, .limit, .select) returns the same
// builder. This fake records the modifier chain on each table call so we
// can assert on tokenization, AND/OR mode, and api_key_hash scoping
// without standing up a real database.

interface RecordedCall {
  table: string;
  filters: Array<{ kind: string; args: unknown[] }>;
  result: { data: unknown[]; error: null };
}

function makeFakeClient(opts: { factsRows: unknown[]; sessionsRows: unknown[]; calls: RecordedCall[] }) {
  return {
    from(table: string) {
      const recorded: RecordedCall = {
        table,
        filters: [],
        result: {
          data: table.endsWith("extracted_facts") ? opts.factsRows : opts.sessionsRows,
          error: null,
        },
      };
      opts.calls.push(recorded);

      const builder: Record<string, unknown> = {};
      const chain = (kind: string) =>
        (...args: unknown[]) => {
          recorded.filters.push({ kind, args });
          return builder;
        };
      builder.select = chain("select");
      builder.eq = chain("eq");
      builder.ilike = chain("ilike");
      builder.or = chain("or");
      builder.order = chain("order");
      builder.limit = chain("limit");
      builder.is = chain("is");
      // The keywordFallback awaits the builder directly, so it must be
      // thenable and resolve to the recorded result.
      builder.then = (onFulfilled: (v: typeof recorded.result) => unknown) =>
        Promise.resolve(recorded.result).then(onFulfilled);
      return builder;
    },
  };
}

function loadBackendWithFake(client: unknown, tenancy: { mode: "byod" } | { mode: "managed"; apiKeyHash: string }) {
  // The constructor calls createClient when given url + serviceRoleKey.
  // We bypass that by injecting our fake into the private `sb` field
  // after construction. This keeps the public API unchanged while still
  // exercising the real keywordFallback code.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return import("../supabase.js").then(({ SupabaseBackend }: any) => {
    const instance = Object.create(SupabaseBackend.prototype);
    instance.sb = client;
    instance.tenancy = tenancy;
    instance.tables =
      tenancy.mode === "managed"
        ? { extracted_facts: "mc_extracted_facts", session_summaries: "mc_session_summaries" }
        : { extracted_facts: "extracted_facts", session_summaries: "session_summaries" };
    return instance;
  });
}

describe("keywordFallback tokenization", () => {
  const savedOpenAI = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY; // force keyword path
  });

  afterEach(() => {
    if (savedOpenAI !== undefined) process.env.OPENAI_API_KEY = savedOpenAI;
    else delete process.env.OPENAI_API_KEY;
  });

  it("returns [] when query yields no usable tokens", async () => {
    const calls: RecordedCall[] = [];
    const client = makeFakeClient({ factsRows: [], sessionsRows: [], calls });
    const backend = await loadBackendWithFake(client, { mode: "byod" });

    // All tokens dropped: too short or only metacharacters.
    const result = await backend.searchMemory("a , ( ) :", 10);
    expect(result).toEqual([]);
    // Should never have hit the database since every token was filtered.
    expect(calls.length).toBe(0);
  });

  it("AND mode: every token becomes a chained ilike on each table", async () => {
    const calls: RecordedCall[] = [];
    const client = makeFakeClient({
      factsRows: [
        { id: "f1", fact: "Fishbowl active topic", category: "test", confidence: 0.9, created_at: "2026-01-01" },
      ],
      sessionsRows: [],
      calls,
    });
    const backend = await loadBackendWithFake(client, { mode: "byod" });

    await backend.searchMemory("active Fishbowl topic", 10);

    // First scan: AND mode hits both tables (extracted_facts + session_summaries).
    const factCall = calls.find((c) => c.table === "extracted_facts");
    expect(factCall, "facts table queried").toBeTruthy();
    const ilikes = factCall!.filters.filter((f) => f.kind === "ilike");
    expect(ilikes.length).toBe(3); // active, fishbowl, topic
    const patterns = ilikes.map((f) => f.args[1] as string);
    expect(patterns).toContain("%active%");
    expect(patterns).toContain("%fishbowl%");
    expect(patterns).toContain("%topic%");
    // No `.or` should have been used in AND mode.
    expect(factCall!.filters.find((f) => f.kind === "or")).toBeUndefined();
  });

  it("OR fallback fires only when AND returns [] and tokens >= 2", async () => {
    const calls: RecordedCall[] = [];
    // First two calls (AND scan over facts + sessions) return [].
    // Next two calls (OR scan) return a partial match.
    let callIdx = 0;
    const client = {
      from(table: string) {
        const idx = callIdx++;
        const isAnd = idx < 2;
        const recorded: RecordedCall = {
          table,
          filters: [],
          result: {
            data: isAnd
              ? []
              : table === "extracted_facts"
                ? [{ id: "f-or", fact: "Memory architecture uses six layers", category: "test", confidence: 0.8, created_at: "2026-01-01" }]
                : [],
            error: null,
          },
        };
        calls.push(recorded);
        const builder: Record<string, unknown> = {};
        const chain = (kind: string) =>
          (...args: unknown[]) => {
            recorded.filters.push({ kind, args });
            return builder;
          };
        builder.select = chain("select");
        builder.eq = chain("eq");
        builder.ilike = chain("ilike");
        builder.or = chain("or");
        builder.order = chain("order");
        builder.limit = chain("limit");
        builder.is = chain("is");
        builder.then = (onFulfilled: (v: typeof recorded.result) => unknown) =>
          Promise.resolve(recorded.result).then(onFulfilled);
        return builder;
      },
    };
    const backend = await loadBackendWithFake(client, { mode: "byod" });

    const result = (await backend.searchMemory("architecture thread zzznonexistentzzz", 10)) as Array<{ id: string }>;

    // 4 calls total: AND-facts, AND-sessions, OR-facts, OR-sessions.
    expect(calls.length).toBe(4);
    expect(calls[0].filters.find((f) => f.kind === "ilike")).toBeTruthy(); // AND mode: ilike chain
    expect(calls[2].filters.find((f) => f.kind === "or")).toBeTruthy(); // OR mode: single .or() call
    // Partial match still surfaces.
    expect(result.map((r) => r.id)).toContain("f-or");
  });

  it("does NOT degrade to OR mode when tokens.length < 2", async () => {
    const calls: RecordedCall[] = [];
    const client = makeFakeClient({ factsRows: [], sessionsRows: [], calls });
    const backend = await loadBackendWithFake(client, { mode: "byod" });

    // Single token, no match → AND returns [], should NOT retry as OR.
    const result = await backend.searchMemory("zzznoresults", 10);
    expect(result).toEqual([]);
    // Only the AND scan ran (2 calls: facts + sessions). No OR retry.
    expect(calls.length).toBe(2);
    expect(calls.every((c) => c.filters.find((f) => f.kind === "or") === undefined)).toBe(true);
  });

  it("managed mode adds api_key_hash filter to keyword fallback", async () => {
    const calls: RecordedCall[] = [];
    const client = makeFakeClient({ factsRows: [], sessionsRows: [], calls });
    const backend = await loadBackendWithFake(client, { mode: "managed", apiKeyHash: "test-tenant-hash" });

    await backend.searchMemory("tenant scoping check", 10);

    // Managed mode targets mc_-prefixed tables.
    const factCall = calls.find((c) => c.table === "mc_extracted_facts");
    expect(factCall, "managed mode hits mc_extracted_facts").toBeTruthy();
    const sessCall = calls.find((c) => c.table === "mc_session_summaries");
    expect(sessCall, "managed mode hits mc_session_summaries").toBeTruthy();
    // Each table must be filtered by api_key_hash.
    const factEqs = factCall!.filters.filter((f) => f.kind === "eq");
    expect(factEqs.some((f) => f.args[0] === "api_key_hash" && f.args[1] === "test-tenant-hash")).toBe(true);
    const sessEqs = sessCall!.filters.filter((f) => f.kind === "eq");
    expect(sessEqs.some((f) => f.args[0] === "api_key_hash" && f.args[1] === "test-tenant-hash")).toBe(true);
  });

  it("BYOD mode does NOT add api_key_hash filter", async () => {
    const calls: RecordedCall[] = [];
    const client = makeFakeClient({ factsRows: [], sessionsRows: [], calls });
    const backend = await loadBackendWithFake(client, { mode: "byod" });

    await backend.searchMemory("byod scoping check", 10);

    const factCall = calls.find((c) => c.table === "extracted_facts");
    const eqs = factCall!.filters.filter((f) => f.kind === "eq");
    expect(eqs.some((f) => f.args[0] === "api_key_hash")).toBe(false);
  });
});

// ─── Integration test ──────────────────────────────────────────────────────
//
// Skipped unless TEST_SUPABASE_URL + TEST_SUPABASE_SERVICE_ROLE_KEY are
// set. Reproduces the proper-noun + NULL-embedding case the fallback was
// built to fix.

describe("acceptance: keyword fallback restores search when hybrid returns []", () => {
  it("ILIKE fallback finds proper-noun fact with NULL embedding", async () => {
    const url = process.env.TEST_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.log("    [skipped] set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to run");
      return;
    }
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    const factText = "Test owner is Chris Byrne for memory-mcp keyword-fallback regression";
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
    expect(insertErr, `insert failed: ${insertErr?.message}`).toBeNull();
    const factId = (inserted as { id: string }).id;

    try {
      const savedOpenAI = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      try {
        const { SupabaseBackend } = await import("../supabase.js");
        const backend = new SupabaseBackend({ url, serviceRoleKey: key, tenancy: { mode: "byod" } });
        const results = (await backend.searchMemory("Chris", 10)) as Array<{ id: string }>;
        expect(Array.isArray(results)).toBe(true);
        const ids = results.map((r) => r.id);
        expect(
          ids.includes(factId),
        ).toBe(true);
      } finally {
        if (savedOpenAI !== undefined) process.env.OPENAI_API_KEY = savedOpenAI;
      }
    } finally {
      await supabase.from("extracted_facts").delete().eq("id", factId);
    }
  });
});

// ─── Embeddings helper ────────────────────────────────────────────────────

describe("embedText", () => {
  it("returns null when OPENAI_API_KEY is not set", async () => {
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const { embedText } = await import("../embeddings.js");
      const result = await embedText("test query");
      expect(result).toBeNull();
    } finally {
      if (saved !== undefined) process.env.OPENAI_API_KEY = saved;
    }
  });
});
