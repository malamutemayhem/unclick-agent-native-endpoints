import test from "node:test";
import assert from "node:assert/strict";
import { createHeartbeatGate } from "./heartbeat-gate.js";

test("heartbeat gate blocks overlapping requests", () => {
  const gate = createHeartbeatGate();

  assert.equal(gate.tryAcquire(), true);
  assert.equal(gate.tryAcquire(), false);

  gate.release();

  assert.equal(gate.tryAcquire(), true);
});
