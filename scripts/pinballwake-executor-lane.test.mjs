// scripts/pinballwake-executor-lane.test.mjs

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { processExecutorPacket, processScopePackTestOnlyExecutorPacket, __testing__ } from "./pinballwake-executor-lane.mjs";
import { makePacket } from "./pinballwake-executor-packet.mjs";

function freshPacket(overrides = {}) {
  return makePacket({
    heartbeat_tick_id: "tick-1",
    requesting_seat_id: "pinballwake-job-runner",
    todo_id: "11957893",
    intent: "modify",
    owned_files: ["scripts/pinballwake-buildbait-room.mjs"],
    acceptance: { test_command: "node --test scripts/x.test.mjs", expected_exit_code: 0 },
    head_sha_at_request: "abc12345",
    ...overrides,
  });
}

const FRESH_HEARTBEAT = { tickId: "tick-1", emittedAt: new Date().toISOString() };

describe("processExecutorPacket gate failures", () => {
  test("HOLD when packet is invalid (caught by CommonSensePass)", async () => {
    const r = await processExecutorPacket({
      packet: freshPacket({ intent: "delete" }),
      heartbeat: FRESH_HEARTBEAT,
    });
    assert.equal(r.receipt_type, __testing__.RECEIPT_TYPE_HOLD);
    assert.match(r.hold_reason, /^gate_blocked:packet_invalid:invalid_intent/);
  });

  test("HOLD on stale heartbeat", async () => {
    const r = await processExecutorPacket({
      packet: freshPacket({ heartbeat_tick_id: "tick-OLD" }),
      heartbeat: FRESH_HEARTBEAT,
    });
    assert.equal(r.receipt_type, __testing__.RECEIPT_TYPE_HOLD);
    assert.match(r.hold_reason, /^gate_blocked:heartbeat_stale/);
  });
});

describe("processExecutorPacket test_only intent", () => {
  test("PASS on test_only without an executor function", async () => {
    const r = await processExecutorPacket({
      packet: freshPacket({ intent: "test_only" }),
      heartbeat: FRESH_HEARTBEAT,
      fileExists: async () => true,
    });
    assert.equal(r.receipt_type, __testing__.RECEIPT_TYPE_PASS);
    assert.equal(r.evidence.intent, "test_only");
    assert.equal(r.evidence.pr_url, null);
  });

  test("HOLD on test_only when heartbeat is explicitly required and absent", async () => {
    const r = await processExecutorPacket({
      packet: freshPacket({ intent: "test_only" }),
      requireHeartbeat: true,
      fileExists: async () => true,
    });
    assert.equal(r.receipt_type, __testing__.RECEIPT_TYPE_HOLD);
    assert.match(r.hold_reason, /^gate_blocked:heartbeat_missing/);
  });
});

describe("processScopePackTestOnlyExecutorPacket", () => {
  test("builds and processes a sanitized test_only packet from ScopePack", async () => {
    const now = new Date("2026-05-16T14:58:00.000Z");
    const result = await processScopePackTestOnlyExecutorPacket({
      todo: { id: "todo-scopepack" },
      scopePack: {
        owned_files: ["scripts/pinballwake-executor-lane.mjs"],
        acceptance: ["packet bridge passes"],
        verification: ["node --test scripts/pinballwake-executor-lane.test.mjs"],
      },
      heartbeat: { tickId: "tick-1", emittedAt: now.toISOString() },
      headShaAtRequest: "abc12345",
      fileExists: async () => true,
      now,
    });

    assert.equal(result.ok, true);
    assert.equal(result.packet.intent, "test_only");
    assert.equal(result.packet.todo_id, "todo-scopepack");
    assert.equal(result.receipt.receipt_type, __testing__.RECEIPT_TYPE_PASS);
    assert.equal(result.receipt.sanitized, true);
  });

  test("returns sanitized HOLD when ScopePack packet build fails", async () => {
    const now = new Date("2026-05-16T14:58:00.000Z");
    const result = await processScopePackTestOnlyExecutorPacket({
      todo: { id: "todo-protected" },
      scopePack: {
        owned_files: ["vercel.json"],
        acceptance: ["packet bridge blocks protected paths"],
      },
      heartbeat: { tickId: "tick-1", emittedAt: now.toISOString() },
      headShaAtRequest: "abc12345",
      now,
    });

    assert.equal(result.ok, false);
    assert.equal(result.receipt.receipt_type, __testing__.RECEIPT_TYPE_HOLD);
    assert.match(result.receipt.hold_reason, /^packet_build_failed:/);
    assert.equal(result.receipt.sanitized, true);
  });
});

describe("processExecutorPacket modify intent", () => {
  test("HOLD when executor is not provided", async () => {
    const r = await processExecutorPacket({
      packet: freshPacket(),
      heartbeat: FRESH_HEARTBEAT,
      fileExists: async () => true,
    });
    assert.equal(r.receipt_type, __testing__.RECEIPT_TYPE_HOLD);
    assert.equal(r.hold_reason, "executor_not_provided");
  });

  test("HOLD when executor throws", async () => {
    const r = await processExecutorPacket({
      packet: freshPacket(),
      heartbeat: FRESH_HEARTBEAT,
      fileExists: async () => true,
      executor: async () => {
        throw new Error("simulated apply failure");
      },
    });
    assert.equal(r.receipt_type, __testing__.RECEIPT_TYPE_HOLD);
    assert.equal(r.hold_reason, "executor_threw");
    assert.match(r.evidence.error_message, /simulated apply failure/);
  });

  test("HOLD when executor returns ok:false", async () => {
    const r = await processExecutorPacket({
      packet: freshPacket(),
      heartbeat: FRESH_HEARTBEAT,
      fileExists: async () => true,
      executor: async () => ({ ok: false, exit_code: 1, output: "tests failed: 1 failure" }),
    });
    assert.equal(r.receipt_type, __testing__.RECEIPT_TYPE_HOLD);
    assert.equal(r.hold_reason, "executor_reported_failure");
    assert.equal(r.evidence.exit_code, 1);
    assert.match(r.evidence.output, /tests failed/);
  });

  test("PASS when executor returns ok:true with PR + sha + run id", async () => {
    const r = await processExecutorPacket({
      packet: freshPacket(),
      heartbeat: FRESH_HEARTBEAT,
      fileExists: async () => true,
      executor: async () => ({
        ok: true,
        pr_url: "https://github.com/malamutemayhem/unclick/pull/800",
        head_sha_after: "def67890",
        test_run_id: "node-test-2026-05-15T03:04Z",
        test_exit_code: 0,
      }),
    });
    assert.equal(r.receipt_type, __testing__.RECEIPT_TYPE_PASS);
    assert.equal(r.evidence.head_sha_before, "abc12345");
    assert.equal(r.evidence.head_sha_after, "def67890");
    assert.equal(r.evidence.pr_url, "https://github.com/malamutemayhem/unclick/pull/800");
    assert.equal(r.evidence.test_run_id, "node-test-2026-05-15T03:04Z");
    assert.equal(r.evidence.test_exit_code, 0);
    assert.equal(r.next_action, "reviewer_safety_pass");
    assert.equal(r.xpass_advisory, true);
  });

  test("receipts carry packet_id when present", async () => {
    const packet = freshPacket({ packet_id: "pkt-fixed-id" });
    const passR = await processExecutorPacket({
      packet,
      heartbeat: FRESH_HEARTBEAT,
      fileExists: async () => true,
      executor: async () => ({ ok: true, head_sha_after: "x" }),
    });
    assert.equal(passR.packet_id, "pkt-fixed-id");

    const holdR = await processExecutorPacket({
      packet: { ...packet, intent: "bogus" },
      heartbeat: FRESH_HEARTBEAT,
    });
    assert.equal(holdR.packet_id, "pkt-fixed-id");
  });
});
