import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateQueueHealthRoom } from "./pinballwake-queue-health-room.mjs";

describe("PinballWake queue health room", () => {
  it("reports idle for an empty queue", () => {
    const result = evaluateQueueHealthRoom({ items: [] });
    assert.equal(result.result, "idle");
  });

  it("identifies review as the top bottleneck", () => {
    const result = evaluateQueueHealthRoom({
      items: [
        { title: "missing Popcorn ACK", reason: "review ack missing" },
        { title: "missing Forge PASS", reason: "review ack missing" },
        { title: "overlap #486/#508", reason: "overlap" },
      ],
    });

    assert.equal(result.bottleneck, "review");
    assert.match(result.recommendation, /ACK/);
  });
});
