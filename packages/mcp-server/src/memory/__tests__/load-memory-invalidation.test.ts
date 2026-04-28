/**
 * Regression test for Fishbowl todo 0bc231c4: load_memory must exclude
 * invalidated facts so it stays in parity with search_memory.
 *
 * search_memory_hybrid filters `invalidated_at IS NULL`; before this fix,
 * get_startup_context did not, so an invalidated fact still surfaced in
 * the active_facts payload returned to load_memory and the agent would
 * happily report a fact the user had explicitly told memory to forget.
 *
 * Two assertions:
 *
 *   1. Static check (always runs): the canonical SQL functions in
 *      supabase/migrations contain `invalidated_at IS NULL` inside the
 *      active_facts CTE for both managed (`mc_get_startup_context`) and
 *      BYOD (`get_startup_context`). This is the regression seam --
 *      anyone replacing the function without the filter trips this test.
 *
 *   2. Live integration check (skipped without creds): seeds a fact via
 *      addFact, invalidates it, calls getStartupContext, asserts the
 *      fact is absent from the returned active_facts.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, "../../../../../supabase/migrations");

function loadLatestDefinition(fnName: string): string {
  // The function may have been redefined across multiple migrations
  // (CREATE OR REPLACE). Walk every migration in lexicographic order
  // and keep the most recent body that contains the function header.
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  let latest = "";
  const headerRegex = new RegExp(
    `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${fnName}\\s*\\(`,
    "i",
  );
  for (const f of files) {
    const sql = readFileSync(join(migrationsDir, f), "utf8");
    const match = headerRegex.exec(sql);
    if (!match) continue;
    // Capture from the header to the next $$ LANGUAGE marker.
    const tail = sql.slice(match.index);
    const end = tail.search(/\$\$\s+LANGUAGE/i);
    latest = end >= 0 ? tail.slice(0, end) : tail;
  }
  return latest;
}

function activeFactsBlock(body: string, table: string): string {
  // Slice out the SELECT ... FROM <table> ... LIMIT 50 block that builds
  // active_facts. The filter we care about lives inside this block.
  const idx = body.indexOf(`FROM ${table}`);
  assert.ok(idx > 0, `expected to find FROM ${table} in function body`);
  // Walk forward to LIMIT 50 (the active_facts CTE is bounded).
  const end = body.indexOf("LIMIT 50", idx);
  assert.ok(end > idx, `expected LIMIT 50 after FROM ${table}`);
  return body.slice(idx, end);
}

describe("load_memory invalidation parity (static)", () => {
  test("mc_get_startup_context excludes invalidated rows from active_facts", () => {
    const body = loadLatestDefinition("mc_get_startup_context");
    assert.ok(body.length > 0, "mc_get_startup_context definition not found in migrations");
    const block = activeFactsBlock(body, "mc_extracted_facts");
    assert.match(
      block,
      /invalidated_at\s+IS\s+NULL/i,
      "mc_get_startup_context active_facts SELECT must filter invalidated_at IS NULL",
    );
  });

  test("get_startup_context (BYOD) excludes invalidated rows from active_facts", () => {
    const body = loadLatestDefinition("get_startup_context");
    assert.ok(body.length > 0, "get_startup_context definition not found in migrations");
    const block = activeFactsBlock(body, "extracted_facts");
    assert.match(
      block,
      /invalidated_at\s+IS\s+NULL/i,
      "get_startup_context active_facts SELECT must filter invalidated_at IS NULL",
    );
  });
});

const LIVE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe("load_memory invalidation parity (live)", { skip: !LIVE }, () => {
  test("invalidated fact is absent from getStartupContext active_facts", async () => {
    const { SupabaseBackend } = await import("../supabase.js");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const backend = new (SupabaseBackend as any)();
    const sessionId = `test-load-mem-inv-${Date.now()}`;
    const factText = `load-mem-invalidation-${Date.now()}`;

    const { id } = await backend.addFact({
      fact: factText,
      category: "test",
      confidence: 0.95,
      source_session_id: sessionId,
    });

    // Sanity: fact appears in active_facts before invalidation.
    const before = (await backend.getStartupContext(5)) as { active_facts?: Array<{ fact: string }> };
    const beforeFacts = (before.active_facts ?? []).map((f) => f.fact);
    assert.ok(beforeFacts.includes(factText), "newly inserted fact should appear in active_facts");

    await backend.invalidateFact({ fact_id: id, reason: "regression test", session_id: sessionId });

    const after = (await backend.getStartupContext(5)) as { active_facts?: Array<{ fact: string }> };
    const afterFacts = (after.active_facts ?? []).map((f) => f.fact);
    assert.ok(
      !afterFacts.includes(factText),
      "invalidated fact must NOT appear in active_facts (parity with search_memory)",
    );
  });
});
