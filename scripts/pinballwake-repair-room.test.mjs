import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createRepairRoomPacket } from "./pinballwake-repair-room.mjs";

describe("PinballWake repair room", () => {
  it("returns no_repair_needed without failures", () => {
    const result = createRepairRoomPacket({ failures: [] });
    assert.equal(result.result, "no_repair_needed");
  });

  it("routes CI and publish failures to Forge", () => {
    const result = createRepairRoomPacket({
      pr: { number: 527 },
      failures: [{ workflow: "CI", conclusion: "failure" }],
    });

    assert.equal(result.result, "repair_packet");
    assert.equal(result.packet.worker, "forge");
    assert.equal(result.severity, "high");
  });

  it("routes security failures to Gatekeeper", () => {
    const result = createRepairRoomPacket({
      failures: [{ name: "safety", detail: "security secret leak" }],
    });

    assert.equal(result.packet.worker, "gatekeeper");
    assert.equal(result.severity, "critical");
  });
});
