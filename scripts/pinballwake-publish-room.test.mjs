import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluatePublishRoom } from "./pinballwake-publish-room.mjs";

function run(workflowName, input = {}) {
  return { workflowName, status: "completed", conclusion: "success", ...input };
}

describe("PinballWake publish room", () => {
  it("publishes only after workflows, deployment, and smoke are green", () => {
    const result = evaluatePublishRoom({
      pr: { number: 527, title: "feat: rooms" },
      mergeCommit: "abc123",
      runs: [run("CI"), run("Publish MCP server")],
      deployments: [{ name: "Vercel", state: "READY", url: "https://example.test" }],
      smokeChecks: [{ name: "admin route", status: "passed" }],
      requireSmoke: true,
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "published");
    assert.equal(result.receipt.status, "published");
  });

  it("waits for missing or pending publish signals", () => {
    const result = evaluatePublishRoom({
      pr: { number: 527 },
      mergeCommit: "abc123",
      runs: [run("CI", { status: "in_progress", conclusion: "" })],
      deployments: [],
      requireDeployment: true,
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "waiting");
    assert.equal(result.pending.length > 0, true);
  });

  it("creates a repair packet on publish failure", () => {
    const result = evaluatePublishRoom({
      pr: { number: 527 },
      mergeCommit: "abc123",
      runs: [run("CI", { conclusion: "failure" }), run("Publish MCP server")],
      deployments: [{ name: "Vercel", state: "READY" }],
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "publish_failed");
    assert.equal(result.repair_packet.worker, "forge");
  });
});
