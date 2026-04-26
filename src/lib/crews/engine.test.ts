import { describe, it, expect, vi, beforeEach } from "vitest";

const { supabaseUpdates, makeBuilder } = vi.hoisted(() => {
  const updates: { table: string; patch: Record<string, unknown> }[] = [];

  function makeBuilder(table: string) {
    const state: {
      op: "select" | "update" | "insert";
      patch: Record<string, unknown> | undefined;
      filters: Record<string, unknown>;
      inFilter: { col: string; vals: string[] } | null;
    } = { op: "select", patch: undefined, filters: {}, inFilter: null };

    const resolve = async () => {
      if (state.op === "update") {
        updates.push({ table, patch: state.patch ?? {} });
        return { data: null, error: null };
      }
      if (state.op === "insert") {
        return { data: null, error: null };
      }
      if (table === "mc_crews") {
        return {
          data: { agent_ids: ["B-uuid", "A-uuid", "C-uuid"], template: "council" },
          error: null,
        };
      }
      if (table === "mc_agents") {
        if (state.inFilter) {
          // Postgres-style: returns rows in arbitrary order, NOT the order of agent_ids.
          return {
            data: [
              { id: "A-uuid", slug: "a", name: "A", category: "thinking", seed_prompt: null },
              { id: "B-uuid", slug: "b", name: "B", category: "thinking", seed_prompt: null },
              { id: "C-uuid", slug: "c", name: "C", category: "thinking", seed_prompt: null },
            ],
            error: null,
          };
        }
        if (state.filters.slug === "chairman") {
          return {
            data: {
              id: "chairman-uuid",
              slug: "chairman",
              name: "Chairman",
              category: "meta",
              seed_prompt: null,
            },
            error: null,
          };
        }
      }
      if (table === "mc_extracted_facts") {
        return { data: [], error: null };
      }
      return { data: null, error: null };
    };

    const b = {
      select: (_cols?: string) => { state.op = "select"; return b; },
      update: (patch: Record<string, unknown>) => { state.op = "update"; state.patch = patch; return b; },
      insert: (_rows: unknown) => { state.op = "insert"; return b; },
      eq: (col: string, val: unknown) => { state.filters[col] = val; return b; },
      in: (col: string, vals: string[]) => { state.inFilter = { col, vals }; return b; },
      order: () => b,
      limit: () => b,
      single: () => resolve(),
      maybeSingle: () => resolve(),
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        resolve().then(onF, onR),
    };
    return b;
  }

  return { supabaseUpdates: updates, makeBuilder };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: (table: string) => makeBuilder(table) }),
}));

import { runCouncilEngine, reorderAgentsByIds, computeConfigHash } from "./engine";

beforeEach(() => {
  supabaseUpdates.length = 0;
});

describe("reorderAgentsByIds", () => {
  it("restores stored order even when fetched rows arrive scrambled", () => {
    const stored = ["B", "A", "C"];
    const fetched = [
      { id: "A", name: "Alice" },
      { id: "B", name: "Bob" },
      { id: "C", name: "Carol" },
    ];
    expect(reorderAgentsByIds(stored, fetched).map((a) => a.id)).toEqual(["B", "A", "C"]);
  });

  it("drops ids that the server did not return", () => {
    const stored = ["A", "B", "C"];
    const fetched = [{ id: "A" }, { id: "C" }];
    expect(reorderAgentsByIds(stored, fetched).map((a) => a.id)).toEqual(["A", "C"]);
  });
});

describe("computeConfigHash", () => {
  it("is deterministic for the same inputs", () => {
    const h1 = computeConfigHash({
      templateKey: "uxpass.v1",
      templateVersion: "1.0.0",
      resolvedAgentIds: ["a", "b", "c"],
    });
    const h2 = computeConfigHash({
      templateKey: "uxpass.v1",
      templateVersion: "1.0.0",
      resolvedAgentIds: ["a", "b", "c"],
    });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes when roster order changes", () => {
    const base = {
      templateKey: "uxpass.v1",
      templateVersion: "1.0.0",
      resolvedAgentIds: ["a", "b", "c"],
    };
    const swapped = { ...base, resolvedAgentIds: ["b", "a", "c"] };
    expect(computeConfigHash(base)).not.toBe(computeConfigHash(swapped));
  });
});

describe("runCouncilEngine roster snapshot", () => {
  it("snapshots resolved_agent_ids in stored crew order with chairman appended", async () => {
    const sampler = vi.fn(async () => ({ content: "ok", tokensIn: 10, tokensOut: 10 }));

    await runCouncilEngine({
      runId: "run-1",
      crewId: "crew-1",
      apiKeyHash: "hash",
      taskPrompt: "test prompt",
      tokenBudget: 100000,
      supabaseUrl: "http://stub",
      serviceRoleKey: "stub",
      sampler,
      supportsSampling: true,
      templateVersion: "1.0.0",
    });

    const snapshot = supabaseUpdates.find(
      (u) => u.table === "mc_crew_runs" && Array.isArray(u.patch.resolved_agent_ids),
    );
    expect(snapshot, "expected a run-row update with resolved_agent_ids").toBeDefined();
    expect(snapshot!.patch.resolved_agent_ids).toEqual([
      "B-uuid",
      "A-uuid",
      "C-uuid",
      "chairman-uuid",
    ]);
    expect(snapshot!.patch.template_key).toBe("council");
    expect(snapshot!.patch.template_version).toBe("1.0.0");
    expect(snapshot!.patch.config_hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
