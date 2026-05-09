import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateRollbackRoom } from "./pinballwake-rollback-room.mjs";

describe("PinballWake rollback room", () => {
  it("does nothing without failure signals", () => {
    const result = evaluateRollbackRoom({ pr: { number: 527 }, failureSignals: [] });
    assert.equal(result.result, "no_rollback_needed");
  });

  it("is advisory by default when failures exist", () => {
    const result = evaluateRollbackRoom({
      pr: { number: 527 },
      mergeCommit: "abc123",
      failureSignals: [{ kind: "deploy", detail: "production deploy failed" }],
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "rollback_advisory");
    assert.equal(result.approval_required, true);
  });

  it("blocks execute mode without explicit approval", () => {
    const result = evaluateRollbackRoom({
      pr: { number: 527 },
      mergeCommit: "abc123",
      failureSignals: [{ kind: "deploy", detail: "outage" }],
      execute: true,
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "rollback_approval_required");
  });

  it("authorizes an execute packet only with explicit approval", () => {
    const result = evaluateRollbackRoom({
      pr: { number: 527 },
      mergeCommit: "abc123",
      failureSignals: [{ kind: "deploy", detail: "outage" }],
      execute: true,
      approval: "rollback-approved",
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "rollback_execute_authorized");
    assert.match(result.packet.chip, /527/);
  });
});
