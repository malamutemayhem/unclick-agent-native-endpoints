import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { healFailedChecks } from "../runner/healer.js";
import type { JudgeSampler } from "../runner/agent.js";
import type { Pack } from "../types.js";

describe("healFailedChecks", () => {
  const originalFetch = globalThis.fetch;
  const config = { supabaseUrl: "https://supabase.test", serviceRoleKey: "service-key" };

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("includes explicit falsy expected values in the healer prompt", async () => {
    const userPrompts: string[] = [];
    const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "GET" && url.includes("testpass_items")) {
        return {
          ok: true,
          json: async () => [
            { check_id: "NULL" },
            { check_id: "FALSE" },
            { check_id: "ZERO" },
            { check_id: "EMPTY" },
          ],
        } as Response;
      }
      return {
        ok: true,
        text: async () => JSON.stringify([{ id: "evidence-1" }]),
      } as Response;
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const sampler: JudgeSampler = async ({ user }) => {
      userPrompts.push(user);
      return { text: JSON.stringify({ verdict: "check", reasoning: "ok" }), model: "test-model" };
    };
    const pack: Pack = {
      id: "healer-falsy-expected",
      name: "Healer Falsy Expected",
      version: "0.1.0",
      description: "",
      items: [
        { id: "NULL", title: "null", category: "deterministic", severity: "low", check_type: "deterministic", tags: [], profiles: ["standard"], expected: null },
        { id: "FALSE", title: "false", category: "deterministic", severity: "low", check_type: "deterministic", tags: [], profiles: ["standard"], expected: false },
        { id: "ZERO", title: "zero", category: "deterministic", severity: "low", check_type: "deterministic", tags: [], profiles: ["standard"], expected: 0 },
        { id: "EMPTY", title: "empty", category: "deterministic", severity: "low", check_type: "deterministic", tags: [], profiles: ["standard"], expected: "" },
      ],
    };

    const healed = await healFailedChecks(config, "run-1", pack, sampler);

    expect(healed).toBe(4);
    expect(userPrompts).toHaveLength(4);
    expect(userPrompts).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Expected: null"),
        expect.stringContaining("Expected: false"),
        expect.stringContaining("Expected: 0"),
        expect.stringContaining('Expected: ""'),
      ]),
    );
  });
});
