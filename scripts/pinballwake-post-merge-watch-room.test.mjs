import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluatePostMergeWatchRoom } from "./pinballwake-post-merge-watch-room.mjs";

function run(workflowName, input = {}) {
  return {
    workflowName,
    status: "completed",
    conclusion: "success",
    databaseId: Math.floor(Math.random() * 100000),
    url: `https://github.example/${workflowName}`,
    ...input,
  };
}

describe("PinballWake post-merge watch room", () => {
  it("passes when expected post-merge workflows are green", () => {
    const result = evaluatePostMergeWatchRoom({
      pr: { number: 526 },
      mergeCommit: "abc123",
      runs: [run("CI"), run("Publish MCP server")],
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "passed");
    assert.equal(result.reason, "post_merge_green");
  });

  it("waits while expected workflows are pending", () => {
    const result = evaluatePostMergeWatchRoom({
      pr: { number: 526 },
      mergeCommit: "abc123",
      runs: [run("CI", { status: "in_progress", conclusion: "" }), run("Publish MCP server")],
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "waiting");
    assert.equal(result.reason, "post_merge_checks_pending");
    assert.equal(result.pending[0].workflow, "CI");
  });

  it("creates a repair packet on failed post-merge checks", () => {
    const result = evaluatePostMergeWatchRoom({
      pr: { number: 526 },
      mergeCommit: "abc123",
      runs: [run("CI", { conclusion: "failure" }), run("Publish MCP server")],
    });

    assert.equal(result.ok, false);
    assert.equal(result.result, "blocker");
    assert.equal(result.reason, "post_merge_check_failed");
    assert.equal(result.repair_packet.worker, "forge");
    assert.match(result.repair_packet.chip, /526/);
  });

  it("blocks missing merge commit evidence", () => {
    const result = evaluatePostMergeWatchRoom({
      pr: { number: 526 },
      runs: [run("CI")],
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "missing_merge_commit");
  });
});
