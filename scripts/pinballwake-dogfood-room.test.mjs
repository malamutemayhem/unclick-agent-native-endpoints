import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateDogfoodRoom } from "./pinballwake-dogfood-room.mjs";

describe("PinballWake dogfood room", () => {
  it("passes when all required signals are observed", () => {
    const result = evaluateDogfoodRoom({
      scenario: "merge room lifts full-pass PR",
      steps: [{ name: "open PR", status: "passed" }],
      observations: [{ name: "post_merge_green", status: "passed" }],
      requiredSignals: ["post_merge_green"],
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "passed");
  });

  it("creates a repair packet when a dogfood step fails", () => {
    const result = evaluateDogfoodRoom({
      scenario: "publish room smoke",
      steps: [{ name: "admin route", status: "failed" }],
    });

    assert.equal(result.ok, false);
    assert.equal(result.result, "blocker");
    assert.equal(result.packet.worker, "forge");
  });
});
