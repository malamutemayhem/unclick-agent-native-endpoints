import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateCloseSupersedeRoom } from "./pinballwake-close-supersede-room.mjs";

function greenPr(input = {}) {
  return {
    number: 508,
    title: "copy chip",
    statusCheckRollup: [{ name: "CI", status: "COMPLETED", conclusion: "SUCCESS" }],
    ...input,
  };
}

describe("PinballWake close/supersede room", () => {
  it("keeps owner-marked primary PRs", () => {
    const result = evaluateCloseSupersedeRoom({ pr: greenPr({ owner_decision: "primary" }) });
    assert.equal(result.result, "keep");
  });

  it("marks covered PRs ready to close", () => {
    const result = evaluateCloseSupersedeRoom({ pr: greenPr(), mainContainsChange: true, supersededBy: 486 });
    assert.equal(result.result, "ready_to_close");
    assert.match(result.close_comment, /486/);
  });

  it("creates an owner packet for survivor overlap decisions", () => {
    const result = evaluateCloseSupersedeRoom({ pr: greenPr(), supersededBy: 486 });
    assert.equal(result.result, "hold_rebase_or_close");
    assert.equal(result.packet.worker, "owner/xpass");
  });
});
