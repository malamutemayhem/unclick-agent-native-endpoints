import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateStaleRoom } from "./pinballwake-stale-room.mjs";

describe("PinballWake stale room", () => {
  it("stays clear when nothing is stale", () => {
    const result = evaluateStaleRoom({
      now: "2026-05-05T10:00:00.000Z",
      items: [{ kind: "review", id: "qc", updatedAt: "2026-05-05T09:30:00.000Z" }],
    });

    assert.equal(result.result, "clear");
  });

  it("creates refresh packets for stale items", () => {
    const result = evaluateStaleRoom({
      now: "2026-05-05T10:00:00.000Z",
      items: [{ kind: "review", id: "popcorn-527", worker: "popcorn", updatedAt: "2026-05-05T08:00:00.000Z" }],
    });

    assert.equal(result.result, "stale_found");
    assert.equal(result.packets[0].worker, "popcorn");
    assert.match(result.packets[0].chip, /popcorn-527/);
  });
});
