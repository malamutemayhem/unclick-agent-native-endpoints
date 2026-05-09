import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createReleaseNotesRoomReceipt } from "./pinballwake-release-notes-room.mjs";

describe("PinballWake release notes room", () => {
  it("creates a readable release receipt", () => {
    const result = createReleaseNotesRoomReceipt({
      pr: { number: 527, title: "feat: decision rooms", summary: "Adds room gates." },
      mergeCommit: "abc123",
      proof: ["CI passed", "Publish passed"],
      risks: ["Advisory only"],
      nextActions: ["Watch queue"],
    });

    assert.equal(result.ok, true);
    assert.match(result.receipt, /decision rooms/);
    assert.match(result.receipt, /CI passed/);
  });

  it("blocks missing release context", () => {
    const result = createReleaseNotesRoomReceipt({});
    assert.equal(result.ok, false);
    assert.equal(result.reason, "missing_release_context");
  });
});
