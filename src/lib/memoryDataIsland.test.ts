// src/lib/memoryDataIsland.test.ts

import { describe, test, expect } from "vitest";
import {
  buildDataIsland,
  dataIslandToJson,
  parseDataIsland,
  verifyManifest,
  __consts__,
  type DataIslandInput,
} from "./memoryDataIsland";

const NOW = new Date("2026-05-15T12:00:00Z");

function baseInput(overrides: Partial<DataIslandInput> = {}): DataIslandInput {
  return {
    profileCard: { user_id: "user-1", display_name: "Chris" },
    facts: [
      { id: "f1", text: "Loves Alaskan Malamutes", created_at: "2026-05-10T00:00:00Z", topics: ["personal"] },
      { id: "f2", text: "Default-deny on metered AI calls", created_at: "2026-05-15T00:00:00Z", topics: ["unclick", "security"] },
    ],
    sessions: [
      { id: "s1", summary: "Overnight UnClick fleet run", started_at: "2026-05-15T00:00:00Z", topics: ["unclick", "fleet-runner"] },
    ],
    extras: { library_snapshots: { foo: "bar" } },
    ...overrides,
  };
}

describe("buildDataIsland", () => {
  test("builds a well-formed island with correct manifest counts", () => {
    const island = buildDataIsland(baseInput(), NOW);
    expect(island.manifest.data_island_version).toBe(__consts__.DATA_ISLAND_VERSION);
    expect(island.manifest.exported_at).toBe(NOW.toISOString());
    expect(island.manifest.user_id).toBe("user-1");
    expect(island.manifest.counts.facts).toBe(2);
    expect(island.manifest.counts.sessions).toBe(1);
    expect(island.manifest.counts.extras).toBe(1);
  });

  test("collects unique topics from facts + sessions, sorted", () => {
    const island = buildDataIsland(baseInput(), NOW);
    expect(island.manifest.topics).toEqual(["fleet-runner", "personal", "security", "unclick"]);
  });

  test("shelves include extras keys with extras. prefix", () => {
    const island = buildDataIsland(baseInput(), NOW);
    expect(island.manifest.shelves).toContain("profileCard");
    expect(island.manifest.shelves).toContain("facts");
    expect(island.manifest.shelves).toContain("sessions");
    expect(island.manifest.shelves).toContain("extras.library_snapshots");
  });

  test("rejects missing profileCard.user_id", () => {
    expect(() =>
      buildDataIsland(baseInput({ profileCard: { user_id: "" } as any }), NOW),
    ).toThrow(/user_id is required/);
  });

  test("rejects non-array facts/sessions", () => {
    expect(() => buildDataIsland(baseInput({ facts: "x" as any }), NOW)).toThrow(/facts must be an array/);
    expect(() => buildDataIsland(baseInput({ sessions: "x" as any }), NOW)).toThrow(/sessions must be an array/);
  });

  test("rejects 'manifest' as an extras key", () => {
    expect(() =>
      buildDataIsland(baseInput({ extras: { manifest: { foo: 1 } } }), NOW),
    ).toThrow(/reserved/);
  });

  test("empty extras still produces a valid island", () => {
    const island = buildDataIsland(baseInput({ extras: {} }), NOW);
    expect(island.manifest.counts.extras).toBe(0);
    expect(island.extras).toEqual({});
  });
});

describe("dataIslandToJson / parseDataIsland round-trip", () => {
  test("round-trips exactly", () => {
    const island = buildDataIsland(baseInput(), NOW);
    const json = dataIslandToJson(island);
    const back = parseDataIsland(json);
    expect(back).toEqual(island);
  });

  test("compact serialisation is shorter than pretty", () => {
    const island = buildDataIsland(baseInput(), NOW);
    expect(dataIslandToJson(island, false).length).toBeLessThan(dataIslandToJson(island, true).length);
  });

  test("parseDataIsland rejects invalid JSON", () => {
    expect(() => parseDataIsland("not json")).toThrow(SyntaxError);
  });

  test("parseDataIsland rejects unsupported version", () => {
    const island = buildDataIsland(baseInput(), NOW);
    const bad = { ...island, manifest: { ...island.manifest, data_island_version: "v99" } };
    expect(() => parseDataIsland(JSON.stringify(bad))).toThrow(/unsupported data_island_version/);
  });

  test("parseDataIsland rejects missing manifest / profileCard / arrays", () => {
    expect(() => parseDataIsland(JSON.stringify({}))).toThrow(/manifest/);
    const island = buildDataIsland(baseInput(), NOW);
    expect(() => parseDataIsland(JSON.stringify({ ...island, profileCard: undefined }))).toThrow(/profileCard/);
    expect(() => parseDataIsland(JSON.stringify({ ...island, facts: "x" }))).toThrow(/facts/);
    expect(() => parseDataIsland(JSON.stringify({ ...island, sessions: "x" }))).toThrow(/sessions/);
  });
});

describe("verifyManifest", () => {
  test("returns ok on a freshly built island", () => {
    const r = verifyManifest(buildDataIsland(baseInput(), NOW));
    expect(r).toEqual({ ok: true });
  });

  test("detects mismatched facts count", () => {
    const island = buildDataIsland(baseInput(), NOW);
    const tampered = { ...island, manifest: { ...island.manifest, counts: { ...island.manifest.counts, facts: 99 } } };
    const r = verifyManifest(tampered);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/facts/);
  });

  test("detects mismatched user_id", () => {
    const island = buildDataIsland(baseInput(), NOW);
    const tampered = { ...island, profileCard: { ...island.profileCard, user_id: "other" } };
    const r = verifyManifest(tampered);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/user_id/);
  });

  test("detects mismatched extras count", () => {
    const island = buildDataIsland(baseInput(), NOW);
    const tampered = { ...island, extras: {} };
    const r = verifyManifest(tampered);
    expect(r.ok).toBe(false);
  });
});
