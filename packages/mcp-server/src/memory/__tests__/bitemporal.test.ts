/**
 * Acceptance tests for Chunk 2: bi-temporal schema, provenance, and blob preservation.
 *
 * These tests are skipped unless SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are present.
 * Run with: tsx --test src/memory/__tests__/bitemporal.test.ts
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

// ---- Pure unit helpers (no I/O) ----

function contentHash(text: string): string {
  return createHash("sha256").update(text.trim().toLowerCase()).digest("hex");
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Near-dup collapse: given scored candidates with embeddings, return de-duped set.
// Mirrors the SQL dominated CTE logic.
function nearDupCollapse(
  candidates: Array<{ id: string; score: number; embedding: number[] }>,
  threshold = 0.9,
): string[] {
  const dominated = new Set<string>();
  for (let i = 0; i < candidates.length; i++) {
    for (let j = 0; j < candidates.length; j++) {
      if (i === j) continue;
      const sim = cosine(candidates[i].embedding, candidates[j].embedding);
      if (sim >= threshold) {
        // The lower-scored one is dominated; ties broken by id (LEAST)
        if (
          candidates[j].score < candidates[i].score ||
          (candidates[j].score === candidates[i].score && candidates[j].id > candidates[i].id)
        ) {
          dominated.add(candidates[j].id);
        }
      }
    }
  }
  return candidates.filter((c) => !dominated.has(c.id)).map((c) => c.id);
}

// ---- Unit tests (always run) ----

describe("contentHash", () => {
  it("is stable for identical text", () => {
    const h1 = contentHash("User prefers TypeScript");
    const h2 = contentHash("User prefers TypeScript");
    assert.equal(h1, h2);
  });

  it("normalises whitespace and case", () => {
    const h1 = contentHash("  USER PREFERS TYPESCRIPT  ");
    const h2 = contentHash("user prefers typescript");
    assert.equal(h1, h2);
  });

  it("differs for distinct text", () => {
    assert.notEqual(contentHash("fact A"), contentHash("fact B"));
  });
});

describe("nearDupCollapse (pure)", () => {
  it("keeps both candidates when cosine < threshold", () => {
    // Orthogonal vectors - cosine = 0
    const a = { id: "a", score: 0.9, embedding: [1, 0, 0] };
    const b = { id: "b", score: 0.8, embedding: [0, 1, 0] };
    const kept = nearDupCollapse([a, b]);
    assert.deepEqual(kept.sort(), ["a", "b"]);
  });

  it("drops the lower-scored duplicate when cosine >= 0.9", () => {
    // Nearly identical vectors
    const base = [0.9, 0.1, 0.05];
    const near = [0.91, 0.1, 0.04];
    const a = { id: "a", score: 0.9, embedding: base };
    const b = { id: "b", score: 0.5, embedding: near };
    const kept = nearDupCollapse([a, b]);
    assert.deepEqual(kept, ["a"]);
  });

  it("breaks ties by id (LEAST wins)", () => {
    const v = [1, 0];
    const a = { id: "aaa", score: 0.7, embedding: v };
    const b = { id: "zzz", score: 0.7, embedding: v };
    const kept = nearDupCollapse([a, b]);
    assert.deepEqual(kept, ["aaa"]);
  });

  it("handles single candidate", () => {
    const kept = nearDupCollapse([{ id: "x", score: 1.0, embedding: [1, 0] }]);
    assert.deepEqual(kept, ["x"]);
  });
});

// ---- Integration tests (skipped without live creds) ----

const LIVE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe("Supabase bi-temporal integration", { skip: !LIVE }, () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let _db: any;
  let testSession: string;

  before(async () => {
    const { SupabaseBackend } = await import("../supabase.js");
    _db = new (SupabaseBackend as unknown as new () => unknown)();
    testSession = `test-chunk2-${Date.now()}`;
  });

  it("exact-hash dedup: inserting same fact twice returns same id", async () => {
    const { SupabaseBackend } = await import("../supabase.js");
    const backend = new (SupabaseBackend as any)();
    const factText = `dedup-test-${Date.now()}`;
    const r1 = await backend.addFact({ fact: factText, category: "test", confidence: 0.9, source_session_id: testSession });
    const r2 = await backend.addFact({ fact: factText, category: "test", confidence: 0.9, source_session_id: testSession });
    assert.equal(r1.id, r2.id, "second insert should return existing fact id");
  });

  it("bi-temporal: invalidated fact excluded from search, visible via as_of", async () => {
    const { SupabaseBackend } = await import("../supabase.js");
    const backend = new (SupabaseBackend as any)();
    const factText = `invalidate-test-${Date.now()}`;

    // Insert fact and record timestamp
    const { id } = await backend.addFact({ fact: factText, category: "test", confidence: 0.9, source_session_id: testSession });
    const afterInsert = new Date().toISOString();

    // Invalidate it
    await backend.invalidateFact({ fact_id: id, reason: "test cleanup", session_id: testSession });

    // Search now - should NOT appear
    const nowResults = await backend.searchFacts(factText) as unknown[];
    const ids = (nowResults as Array<{ id: string }>).map((r) => r.id);
    assert.ok(!ids.includes(id), "invalidated fact should not appear in current search");

    // Search as_of before invalidation - should appear
    const pastResults = await backend.searchMemory(factText, 10, afterInsert) as unknown[];
    const pastIds = (pastResults as Array<{ id: string }>).map((r) => r.id);
    assert.ok(pastIds.includes(id), "invalidated fact should appear in as_of query before invalidation");
  });

  it("preserve_as_blob: stores canonical doc and returns fact_ids", async () => {
    if (!process.env.OPENAI_API_KEY) {
      console.log("  skipping preserve_as_blob test (no OPENAI_API_KEY)");
      return;
    }
    const { SupabaseBackend } = await import("../supabase.js");
    const backend = new (SupabaseBackend as any)();
    const blob = `User works at Acme Corp. They prefer TypeScript. They live in Seattle. Session: ${testSession}`;
    const result = await backend.addFact({
      fact: blob,
      category: "blob",
      confidence: 0.9,
      source_session_id: testSession,
      preserve_as_blob: true,
    }) as { id: string; fact_ids?: string[] };
    assert.ok(result.id, "should return canonical doc id");
    assert.ok(Array.isArray(result.fact_ids), "should return extracted fact_ids array");
    assert.ok((result.fact_ids as string[]).length >= 1, "should have extracted at least one atomic fact");
  });

  after(async () => {
    // Best-effort: nothing to clean up since invalidated facts stay in DB
  });
});
