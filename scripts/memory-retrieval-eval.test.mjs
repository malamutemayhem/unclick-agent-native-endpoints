// scripts/memory-retrieval-eval.test.mjs

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TYPED_LINK_REPLAY_FIXTURES,
  parseJsonl,
  runMemoryRetrievalEval,
  scoreRetrievalFixture,
} from "./memory-retrieval-eval.mjs";

describe("memory retrieval eval", () => {
  test("parses JSONL fixtures", () => {
    const rows = parseJsonl(`
{"query":"Find PR #888","expected_refs":["pr:888"],"expected_relation":"ships"}
{"query":"Find todo","expected_refs":["todo:abc"]}
`);

    assert.equal(rows.length, 2);
    assert.equal(rows[0].query, "Find PR #888");
    assert.deepEqual(rows[1].expected_refs, ["todo:abc"]);
  });

  test("scores top1, hit@k, Jaccard@k, relation, and latency", () => {
    const report = scoreRetrievalFixture({
      fixture: {
        id: "pr-proof",
        query: "Find typed-link PR",
        expected_refs: ["PR:888"],
        expected_relation: "ships",
      },
      results: [
        { ref: "pr:888", relation: "ships", score: 0.99 },
        { ref: "todo:gbrain", relation: "parent", score: 0.7 },
      ],
      k: 2,
      latencyMs: 12.3456,
    });

    assert.equal(report.top1_hit, true);
    assert.equal(report.hit_at_k, true);
    assert.equal(report.jaccard_at_k, 0.5);
    assert.equal(report.relation_hit, true);
    assert.equal(report.latency_ms, 12.346);
    assert.equal(report.ok, true);
  });

  test("fails when an expected relation is absent from the matching result", () => {
    const report = scoreRetrievalFixture({
      fixture: {
        query: "Find typed-link PR",
        expected_refs: ["pr:888"],
        expected_relation: "ships",
      },
      results: [{ ref: "pr:888", relation: "mentions", score: 0.99 }],
      k: 1,
    });

    assert.equal(report.hit_at_k, true);
    assert.equal(report.relation_hit, false);
    assert.equal(report.ok, false);
  });

  test("rejects seeded replay results as live proof by default", async () => {
    await assert.rejects(
      () => runMemoryRetrievalEval(),
      /seeded_replay_results_not_live_proof/,
    );
  });

  test("can run seeded typed-link replay fixtures when explicitly allowed", async () => {
    const report = await runMemoryRetrievalEval({ allowSeededResults: true });

    assert.equal(report.aggregate.passed, true);
    assert.equal(report.aggregate.query_count, 5);
    assert.equal(report.aggregate.top1_accuracy, 1);
    assert.equal(report.aggregate.hit_at_k, 1);
    assert.equal(report.aggregate.relation_accuracy, 1);
    assert.deepEqual(
      DEFAULT_TYPED_LINK_REPLAY_FIXTURES.map((fixture) => fixture.id),
      ["pr-recall", "todo-recall", "receipt-recall", "tool-recall", "file-recall"],
    );
  });

  test("can use a supplied deterministic runner", async () => {
    const report = await runMemoryRetrievalEval({
      fixtures: [
        {
          id: "tool",
          query: "Which tool searches typed links?",
          expected_refs: ["tool:search_typed_links"],
        },
      ],
      runner: async () => ({
        latency_ms: 3,
        results: [{ ref: "tool:search_typed_links", score: 1 }],
      }),
      k: 1,
    });

    assert.equal(report.aggregate.passed, true);
    assert.equal(report.per_query[0].top1_hit, true);
    assert.equal(report.aggregate.mean_latency_ms, 3);
  });
});
