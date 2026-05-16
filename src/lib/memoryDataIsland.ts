// src/lib/memoryDataIsland.ts
//
// Memory Data Island export v1 — bundle Memory artifacts (profile-card,
// facts, sessions, etc.) into one portable JSON package with a manifest.
//
// Closes UnClick todo "Memory Data Island Export v1: portable package"
// (child of 9fe82554).
//
// The package is plain JSON (no archive format) so it's easy to inspect,
// transport, and diff. Callers that want a .zip can wrap this output.

const DATA_ISLAND_VERSION = "v1";

export interface ProfileCard {
  user_id: string;
  display_name?: string;
  email?: string;
  created_at?: string;
  [k: string]: unknown;
}

export interface MemoryFact {
  id: string;
  text: string;
  created_at: string;
  topics?: string[];
  [k: string]: unknown;
}

export interface MemorySession {
  id: string;
  summary: string;
  started_at: string;
  ended_at?: string;
  decisions?: string[];
  open_loops?: string[];
  topics?: string[];
  [k: string]: unknown;
}

export interface DataIslandInput {
  profileCard: ProfileCard;
  facts: ReadonlyArray<MemoryFact>;
  sessions: ReadonlyArray<MemorySession>;
  /** Optional bag of additional shelves the caller wants to bundle. */
  extras?: Readonly<Record<string, unknown>>;
}

export interface DataIslandManifest {
  data_island_version: string;
  exported_at: string;
  user_id: string;
  counts: {
    facts: number;
    sessions: number;
    extras: number;
  };
  topics: string[];
  shelves: string[];
}

export interface DataIsland {
  manifest: DataIslandManifest;
  profileCard: ProfileCard;
  facts: ReadonlyArray<MemoryFact>;
  sessions: ReadonlyArray<MemorySession>;
  extras: Readonly<Record<string, unknown>>;
}

export function buildDataIsland(input: DataIslandInput, now: Date = new Date()): DataIsland {
  if (!input || typeof input !== "object") {
    throw new TypeError("buildDataIsland requires an input object");
  }
  if (!input.profileCard || typeof input.profileCard !== "object") {
    throw new TypeError("buildDataIsland: profileCard is required");
  }
  if (!input.profileCard.user_id) {
    throw new TypeError("buildDataIsland: profileCard.user_id is required");
  }
  if (!Array.isArray(input.facts)) {
    throw new TypeError("buildDataIsland: facts must be an array");
  }
  if (!Array.isArray(input.sessions)) {
    throw new TypeError("buildDataIsland: sessions must be an array");
  }

  const topics = collectTopics(input.facts, input.sessions);
  const shelves = ["profileCard", "facts", "sessions"];
  const extras = input.extras ?? {};
  for (const k of Object.keys(extras)) {
    if (k === "manifest") {
      throw new RangeError("buildDataIsland: 'manifest' is a reserved extras key");
    }
    shelves.push(`extras.${k}`);
  }

  const manifest: DataIslandManifest = {
    data_island_version: DATA_ISLAND_VERSION,
    exported_at: now.toISOString(),
    user_id: input.profileCard.user_id,
    counts: {
      facts: input.facts.length,
      sessions: input.sessions.length,
      extras: Object.keys(extras).length,
    },
    topics,
    shelves,
  };

  return {
    manifest,
    profileCard: input.profileCard,
    facts: input.facts,
    sessions: input.sessions,
    extras,
  };
}

/**
 * Serialise to a pretty-printed JSON string for export to disk.
 */
export function dataIslandToJson(island: DataIsland, pretty = true): string {
  if (pretty) return JSON.stringify(island, null, 2);
  return JSON.stringify(island);
}

/**
 * Parse + validate a serialised island. Throws on shape mismatch.
 */
export function parseDataIsland(json: string): DataIsland {
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch (err) {
    throw new SyntaxError(`parseDataIsland: invalid JSON: ${(err as Error).message}`);
  }
  if (!obj || typeof obj !== "object") {
    throw new TypeError("parseDataIsland: not an object");
  }
  const island = obj as Partial<DataIsland>;
  if (!island.manifest || typeof island.manifest !== "object") {
    throw new TypeError("parseDataIsland: missing manifest");
  }
  if (island.manifest.data_island_version !== DATA_ISLAND_VERSION) {
    throw new RangeError(
      `parseDataIsland: unsupported data_island_version ${island.manifest.data_island_version} (this build supports ${DATA_ISLAND_VERSION})`,
    );
  }
  if (!island.profileCard) throw new TypeError("parseDataIsland: missing profileCard");
  if (!Array.isArray(island.facts)) throw new TypeError("parseDataIsland: facts must be an array");
  if (!Array.isArray(island.sessions)) throw new TypeError("parseDataIsland: sessions must be an array");

  return {
    manifest: island.manifest,
    profileCard: island.profileCard as ProfileCard,
    facts: island.facts as MemoryFact[],
    sessions: island.sessions as MemorySession[],
    extras: (island.extras ?? {}) as Record<string, unknown>,
  };
}

/**
 * Verify the manifest counts match the actual array lengths. Useful as a
 * round-trip sanity check after disk read.
 */
export function verifyManifest(island: DataIsland): { ok: true } | { ok: false; reason: string } {
  const c = island.manifest.counts;
  if (c.facts !== island.facts.length) return { ok: false, reason: `manifest.counts.facts (${c.facts}) != facts.length (${island.facts.length})` };
  if (c.sessions !== island.sessions.length) return { ok: false, reason: `manifest.counts.sessions (${c.sessions}) != sessions.length (${island.sessions.length})` };
  const extrasCount = Object.keys(island.extras).length;
  if (c.extras !== extrasCount) return { ok: false, reason: `manifest.counts.extras (${c.extras}) != actual (${extrasCount})` };
  if (island.profileCard.user_id !== island.manifest.user_id) {
    return { ok: false, reason: `manifest.user_id (${island.manifest.user_id}) != profileCard.user_id (${island.profileCard.user_id})` };
  }
  return { ok: true };
}

function collectTopics(facts: ReadonlyArray<MemoryFact>, sessions: ReadonlyArray<MemorySession>): string[] {
  const set = new Set<string>();
  for (const f of facts) for (const t of f.topics ?? []) set.add(t);
  for (const s of sessions) for (const t of s.topics ?? []) set.add(t);
  return [...set].sort();
}

export const __consts__ = { DATA_ISLAND_VERSION };
