#!/usr/bin/env node

import fs from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

export const DEFAULT_TOP_K = 5;

export const DEFAULT_TYPED_LINK_REPLAY_FIXTURES = [
  {
    id: "pr-recall",
    query: "Which pull request shipped typed-link extraction?",
    expected_refs: ["pr:888"],
    expected_relation: "ships",
  },
  {
    id: "todo-recall",
    query: "Find the gbrain parent todo for typed-link graph work.",
    expected_refs: ["todo:6e125b76-3238-4425-940f-28a287d85f51"],
    expected_relation: "parent",
  },
  {
    id: "receipt-recall",
    query: "Find proof for Memory typed-link direct tool.",
    expected_refs: ["receipt:pr-891"],
    expected_relation: "proof",
  },
  {
    id: "tool-recall",
    query: "Which Memory tool searches typed links?",
    expected_refs: ["tool:search_typed_links"],
    expected_relation: "exposes",
  },
  {
    id: "file-recall",
    query: "Where is typed-link extraction implemented?",
    expected_refs: ["file:packages/mcp-server/src/memory/typed-links.ts"],
    expected_relation: "implements",
  },
];

export const DEFAULT_TYPED_LINK_REPLAY_RESULTS = new Map([
  [
    "Which pull request shipped typed-link extraction?",
    {
      latency_ms: 8,
      results: [
        { ref: "pr:888", relation: "ships", score: 0.99 },
        { ref: "pr:889", relation: "extends", score: 0.82 },
      ],
    },
  ],
  [
    "Find the gbrain parent todo for typed-link graph work.",
    {
      latency_ms: 9,
      results: [
        { ref: "todo:6e125b76-3238-4425-940f-28a287d85f51", relation: "parent", score: 0.98 },
        { ref: "todo:b7023911-cc1d-4535-bcdc-b258cc432b7b", relation: "child", score: 0.7 },
      ],
    },
  ],
  [
    "Find proof for Memory typed-link direct tool.",
    {
      latency_ms: 7,
      results: [
        { ref: "receipt:pr-891", relation: "proof", score: 0.97 },
        { ref: "pr:891", relation: "ships", score: 0.93 },
      ],
    },
  ],
  [
    "Which Memory tool searches typed links?",
    {
      latency_ms: 6,
      results: [
        { ref: "tool:search_typed_links", relation: "exposes", score: 0.99 },
        { ref: "file:packages/mcp-server/src/server.ts", relation: "registers", score: 0.78 },
      ],
    },
  ],
  [
    "Where is typed-link extraction implemented?",
    {
      latency_ms: 10,
      results: [
        { ref: "file:packages/mcp-server/src/memory/typed-links.ts", relation: "implements", score: 0.99 },
        { ref: "file:packages/mcp-server/src/memory/handlers.ts", relation: "uses", score: 0.77 },
      ],
    },
  ],
]);

function normalizeRef(value) {
  return String(value ?? "")
    .trim()
    .replace(/^\/+/, "")
    .toLowerCase();
}

function resultRef(result) {
  if (typeof result === "string") return result;
  return result?.ref ?? result?.source_uri ?? result?.id ?? result?.memory_id ?? "";
}

function asArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName}_must_be_array`);
  }
  return value;
}

export function parseJsonl(text) {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`jsonl_parse_error_line_${index + 1}:${error.message}`);
      }
    });
}

export async function loadJsonlFile(path) {
  return parseJsonl(await fs.readFile(path, "utf8"));
}

export async function loadResultsFile(path) {
  const parsed = JSON.parse(await fs.readFile(path, "utf8"));
  if (Array.isArray(parsed)) {
    return new Map(parsed.map((entry) => [String(entry.query), entry]));
  }
  return new Map(Object.entries(parsed));
}

export function validateFixture(fixture) {
  if (!fixture || typeof fixture !== "object") throw new Error("fixture_must_be_object");
  if (!String(fixture.query || "").trim()) throw new Error("fixture_query_required");
  const expectedRefs = asArray(fixture.expected_refs, "expected_refs")
    .map(normalizeRef)
    .filter(Boolean);
  if (expectedRefs.length === 0) throw new Error("expected_refs_required");
  return {
    ...fixture,
    id: String(fixture.id || fixture.query).trim(),
    query: String(fixture.query).trim(),
    expected_refs: expectedRefs,
    expected_relation: fixture.expected_relation ? String(fixture.expected_relation).trim().toLowerCase() : undefined,
  };
}

export function scoreRetrievalFixture({ fixture, results, k = DEFAULT_TOP_K, latencyMs = 0 }) {
  const checked = validateFixture(fixture);
  const topK = asArray(results ?? [], "results")
    .slice(0, k)
    .map((result, index) => ({
      rank: index + 1,
      ref: normalizeRef(resultRef(result)),
      relation: result?.relation ? String(result.relation).trim().toLowerCase() : undefined,
      score: typeof result?.score === "number" ? result.score : undefined,
    }))
    .filter((result) => result.ref);

  const expected = new Set(checked.expected_refs);
  const observed = new Set(topK.map((result) => result.ref));
  const intersectionCount = [...expected].filter((ref) => observed.has(ref)).length;
  const unionCount = new Set([...expected, ...observed]).size || 1;
  const top1Hit = topK.length > 0 && expected.has(topK[0].ref);
  const hitAtK = intersectionCount > 0;
  const relationHit = checked.expected_relation
    ? topK.some((result) => expected.has(result.ref) && result.relation === checked.expected_relation)
    : null;

  return {
    id: checked.id,
    query: checked.query,
    expected_refs: checked.expected_refs,
    expected_relation: checked.expected_relation,
    top_refs: topK.map((result) => result.ref),
    top1_hit: top1Hit,
    hit_at_k: hitAtK,
    jaccard_at_k: Number((intersectionCount / unionCount).toFixed(4)),
    relation_hit: relationHit,
    latency_ms: Number(latencyMs.toFixed(3)),
    ok: hitAtK && (relationHit !== false),
  };
}

export async function runMemoryRetrievalEval({
  fixtures = DEFAULT_TYPED_LINK_REPLAY_FIXTURES,
  resultSets = DEFAULT_TYPED_LINK_REPLAY_RESULTS,
  runner,
  k = DEFAULT_TOP_K,
  clock = () => performance.now(),
} = {}) {
  const perQuery = [];

  for (const fixture of fixtures.map(validateFixture)) {
    const startedAt = clock();
    const response = runner
      ? await runner(fixture)
      : resultSets.get(fixture.query) ?? resultSets.get(fixture.id) ?? { results: [] };
    const elapsedMs = clock() - startedAt;
    const results = Array.isArray(response) ? response : response?.results ?? [];
    const latencyMs =
      typeof response?.latency_ms === "number"
        ? response.latency_ms
        : typeof response?.latencyMs === "number"
          ? response.latencyMs
          : elapsedMs;

    perQuery.push(scoreRetrievalFixture({ fixture, results, k, latencyMs }));
  }

  const count = perQuery.length || 1;
  const aggregate = {
    query_count: perQuery.length,
    top1_accuracy: Number((perQuery.filter((row) => row.top1_hit).length / count).toFixed(4)),
    hit_at_k: Number((perQuery.filter((row) => row.hit_at_k).length / count).toFixed(4)),
    jaccard_at_k: Number((perQuery.reduce((sum, row) => sum + row.jaccard_at_k, 0) / count).toFixed(4)),
    relation_accuracy: Number(
      (perQuery.filter((row) => row.relation_hit === true).length /
        (perQuery.filter((row) => row.relation_hit !== null).length || 1)).toFixed(4),
    ),
    mean_latency_ms: Number((perQuery.reduce((sum, row) => sum + row.latency_ms, 0) / count).toFixed(3)),
    passed: perQuery.every((row) => row.ok),
  };

  return {
    k,
    aggregate,
    per_query: perQuery,
  };
}

function parseArgs(argv) {
  const args = { k: DEFAULT_TOP_K };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--fixtures") args.fixturesPath = argv[++index];
    else if (arg === "--results") args.resultsPath = argv[++index];
    else if (arg === "--k") args.k = Number.parseInt(argv[++index], 10);
    else if (arg === "--help") args.help = true;
    else throw new Error(`unknown_arg:${arg}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/memory-retrieval-eval.mjs [--fixtures path.jsonl] [--results path.json] [--k 5]");
    return;
  }

  const fixtures = args.fixturesPath ? await loadJsonlFile(args.fixturesPath) : DEFAULT_TYPED_LINK_REPLAY_FIXTURES;
  const resultSets = args.resultsPath ? await loadResultsFile(args.resultsPath) : DEFAULT_TYPED_LINK_REPLAY_RESULTS;
  const report = await runMemoryRetrievalEval({ fixtures, resultSets, k: args.k });
  console.log(JSON.stringify(report, null, 2));
  if (!report.aggregate.passed) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
