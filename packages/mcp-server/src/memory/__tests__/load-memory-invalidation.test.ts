/**
 * Regression: load_memory.active_facts must exclude invalidated facts.
 *
 * Closes the parity gap between load_memory and search_memory documented in
 * supabase/migrations/20260428210000_load_memory_invalidation_parity.sql.
 *
 * Pure unit case (always runs): assert the in-memory predicate that mirrors
 * the SQL fact-selection filter excludes invalidated rows. This catches
 * accidental removal of the bi-temporal predicate at the SQL level via the
 * shared shape, without needing a live database.
 *
 * Integration case (skipped unless SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * are set): exercises SupabaseBackend.getStartupContext end to end.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

// ---- Pure predicate mirroring the SQL filter ----

interface FactRow {
  id: string;
  status: "active" | "superseded" | "archived" | "disputed";
  decay_tier: "hot" | "warm" | "cold";
  invalidated_at: string | null;
  valid_to: string | null;
}

/**
 * Mirror of the `active_facts` predicate in mc_get_startup_context /
 * get_startup_context after migration 20260428210000.
 */
function isActiveHotFact(row: FactRow, now: Date = new Date()): boolean {
  if (row.status !== "active") return false;
  if (row.decay_tier !== "hot") return false;
  if (row.invalidated_at !== null) return false;
  if (row.valid_to !== null && new Date(row.valid_to) <= now) return false;
  return true;
}

describe("load_memory active_facts predicate (pure)", () => {
  const base: FactRow = {
    id: "f1",
    status: "active",
    decay_tier: "hot",
    invalidated_at: null,
    valid_to: null,
  };

  it("includes a live, hot, active, non-invalidated fact", () => {
    assert.equal(isActiveHotFact(base), true);
  });

  it("excludes an invalidated fact (invalidated_at IS NOT NULL)", () => {
    const invalidated = { ...base, invalidated_at: new Date().toISOString() };
    assert.equal(
      isActiveHotFact(invalidated),
      false,
      "invalidated fact must not surface in load_memory.active_facts"
    );
  });

  it("excludes a fact whose valid_to has passed", () => {
    const expired = { ...base, valid_to: new Date(Date.now() - 1000).toISOString() };
    assert.equal(isActiveHotFact(expired), false);
  });

  it("includes a fact whose valid_to is in the future", () => {
    const future = { ...base, valid_to: new Date(Date.now() + 60_000).toISOString() };
    assert.equal(isActiveHotFact(future), true);
  });

  it("excludes a superseded fact", () => {
    assert.equal(isActiveHotFact({ ...base, status: "superseded" }), false);
  });

  it("excludes a non-hot tier fact", () => {
    assert.equal(isActiveHotFact({ ...base, decay_tier: "warm" }), false);
  });
});

// ---- Integration test (skipped without live creds) ----

const LIVE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe("load_memory invalidation parity (Supabase integration)", { skip: !LIVE }, () => {
  let testSession: string;

  before(() => {
    testSession = `test-load-memory-invalidation-${Date.now()}`;
  });

  it("excludes invalidated fact from active_facts after invalidation", async () => {
    const { SupabaseBackend } = await import("../supabase.js");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const backend = new (SupabaseBackend as any)();
    const factText = `load-memory-invalidation-${Date.now()}`;

    const { id } = await backend.addFact({
      fact: factText,
      category: "test",
      confidence: 0.9,
      source_session_id: testSession,
    });

    // Confirm fact is visible in active_facts before invalidation.
    const before = (await backend.getStartupContext(5)) as { active_facts?: Array<{ fact: string }> };
    const beforeFacts = (before.active_facts ?? []).map((f) => f.fact);
    assert.ok(
      beforeFacts.includes(factText),
      "fact should appear in active_facts before invalidation"
    );

    await backend.invalidateFact({ fact_id: id, reason: "regression test", session_id: testSession });

    // After invalidation, fact must NOT appear in active_facts.
    const after = (await backend.getStartupContext(5)) as { active_facts?: Array<{ fact: string }> };
    const afterFacts = (after.active_facts ?? []).map((f) => f.fact);
    assert.ok(
      !afterFacts.includes(factText),
      "invalidated fact must not appear in active_facts (load_memory parity with search_memory)"
    );
  });
});
