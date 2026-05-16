// scripts/pinballwake-commonsense-pass.test.mjs

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { commonSensePass, DEFAULT_HEARTBEAT_MAX_AGE_MS } from "./pinballwake-commonsense-pass.mjs";
import { makePacket } from "./pinballwake-executor-packet.mjs";

function basePacket(overrides = {}) {
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

describe("commonSensePass", () => {
  test("PASS on a well-formed packet from an allowed requester", async () => {
    const r = await commonSensePass({ packet: basePacket() });
    assert.equal(r.ok, true);
  });

  test("HOLD on invalid packet (schema)", async () => {
    const r = await commonSensePass({ packet: basePacket({ intent: "delete" }) });
    assert.equal(r.ok, false);
    assert.match(r.reason, /^packet_invalid:invalid_intent/);
  });

  test("HOLD on requester not in allowlist", async () => {
    const r = await commonSensePass({
      packet: basePacket({ requesting_seat_id: "some-random-seat" }),
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "authority_not_allowed");
    assert.equal(r.seat, "some-random-seat");
  });

  test("HOLD on heartbeat tick mismatch", async () => {
    const r = await commonSensePass({
      packet: basePacket({ heartbeat_tick_id: "tick-stale" }),
      heartbeat: { tickId: "tick-fresh", emittedAt: new Date().toISOString() },
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "heartbeat_stale");
  });

  test("HOLD when heartbeat is required but absent", async () => {
    const r = await commonSensePass({
      packet: basePacket({ intent: "test_only" }),
      requireHeartbeat: true,
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "heartbeat_missing");
  });

  test("HOLD on heartbeat too old even when tick matches", async () => {
    const now = new Date("2026-05-15T03:00:00Z");
    const oldEmitted = new Date(now.getTime() - DEFAULT_HEARTBEAT_MAX_AGE_MS - 60_000).toISOString();
    const r = await commonSensePass({
      packet: basePacket({ heartbeat_tick_id: "tick-1" }),
      heartbeat: { tickId: "tick-1", emittedAt: oldEmitted },
      now,
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "heartbeat_stale");
  });

  test("HOLD on protected path defence-in-depth (even if schema let it through)", async () => {
    // Directly construct a "packet" that bypasses the schema validator's path check.
    // We bypass by clearing the owned_files schema validation here intentionally.
    const packet = basePacket({ owned_files: ["scripts/x.mjs"] });
    // Now poke at it post-construction to simulate runtime contamination.
    packet.owned_files = ["scripts/x.mjs", "vercel.json"];
    const r = await commonSensePass({ packet });
    assert.equal(r.ok, false);
    // The packet validator catches this first; reason carries the packet_invalid prefix.
    assert.match(r.reason, /(packet_invalid:owned_file_protected|protected_path)/);
  });

  test("HOLD when owned file missing on modify intent", async () => {
    const r = await commonSensePass({
      packet: basePacket({ intent: "modify", owned_files: ["scripts/does-not-exist.mjs"] }),
      fileExists: async () => false,
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "owned_file_missing_on_modify");
    assert.equal(r.file, "scripts/does-not-exist.mjs");
  });

  test("PASS when owned file missing but intent is create", async () => {
    const r = await commonSensePass({
      packet: basePacket({
        intent: "create",
        owned_files: ["scripts/brand-new-helper.mjs"],
      }),
      fileExists: async () => false,
    });
    assert.equal(r.ok, true);
  });

  test("HOLD on empty test_command string", async () => {
    const r = await commonSensePass({
      packet: basePacket({ acceptance: { test_command: "   " } }),
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "acceptance_test_command_must_be_non_empty_string");
  });

  test("HOLD on dangerous test_command", async () => {
    const r = await commonSensePass({
      packet: basePacket({ acceptance: { test_command: "node test.mjs; rm -rf /" } }),
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "acceptance_test_command_unsafe");
  });

  test("PASS with criteria-only acceptance (no test_command)", async () => {
    const r = await commonSensePass({
      packet: basePacket({ acceptance: { criteria: ["lints", "types"] } }),
    });
    assert.equal(r.ok, true);
  });
});
