// scripts/pinballwake-executor-packet.test.mjs

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  isProtectedPath,
  validateExecutorPacket,
  makePacket,
  makeTestOnlyExecutorPacketFromScopePack,
  __consts__,
} from "./pinballwake-executor-packet.mjs";

function basePacket(overrides = {}) {
  return makePacket({
    heartbeat_tick_id: "tick-1",
    requesting_seat_id: "pinballwake-job-runner",
    todo_id: "11957893-9d40-463a-8755-4aa93150850f",
    intent: "modify",
    owned_files: ["scripts/pinballwake-buildbait-room.mjs"],
    acceptance: { test_command: "node --test scripts/x.test.mjs", expected_exit_code: 0 },
    head_sha_at_request: "abc12345",
    ...overrides,
  });
}

describe("isProtectedPath", () => {
  test("protects .env files", () => {
    assert.equal(isProtectedPath(".env"), true);
    assert.equal(isProtectedPath(".env.production"), true);
    assert.equal(isProtectedPath(".env/config"), true);
  });

  test("protects workflows", () => {
    assert.equal(isProtectedPath(".github/workflows/ci.yml"), true);
  });

  test("protects vercel.json and supabase/", () => {
    assert.equal(isProtectedPath("vercel.json"), true);
    assert.equal(isProtectedPath("supabase/migrations/001.sql"), true);
  });

  test("protects secret/key/pem suffixes", () => {
    assert.equal(isProtectedPath("config/api.secret"), true);
    assert.equal(isProtectedPath("certs/server.pem"), true);
  });

  test("protects lockfiles", () => {
    assert.equal(isProtectedPath("package-lock.json"), true);
    assert.equal(isProtectedPath("nested/pkg/pnpm-lock.yaml"), true);
  });

  test("allows normal source files", () => {
    assert.equal(isProtectedPath("scripts/pinballwake-buildbait-room.mjs"), false);
    assert.equal(isProtectedPath("apps/jobsmith/src/lib/voiceProfile.ts"), false);
    assert.equal(isProtectedPath("docs/autopilot-executor-lane.md"), false);
  });

  test("treats empty/missing as protected (fail-safe)", () => {
    assert.equal(isProtectedPath(""), true);
    assert.equal(isProtectedPath(null), true);
    assert.equal(isProtectedPath(undefined), true);
  });
});

describe("validateExecutorPacket", () => {
  test("PASS on a well-formed packet", () => {
    const r = validateExecutorPacket(basePacket());
    assert.equal(r.ok, true);
  });

  test("rejects missing packet", () => {
    assert.deepEqual(validateExecutorPacket(null), { ok: false, reason: "missing_packet" });
    assert.deepEqual(validateExecutorPacket(undefined), { ok: false, reason: "missing_packet" });
    assert.deepEqual(validateExecutorPacket("string"), { ok: false, reason: "missing_packet" });
  });

  test("rejects each missing required field", () => {
    for (const field of __consts__.REQUIRED_FIELDS) {
      const p = basePacket();
      // overwrite to empty string to trip the check
      p[field] = "";
      const r = validateExecutorPacket(p);
      assert.equal(r.ok, false, `expected ${field} to fail`);
      assert.equal(r.reason, "missing_field");
      assert.equal(r.field, field);
    }
  });

  test("rejects wrong version", () => {
    const p = basePacket();
    p.executor_packet_version = "v99";
    const r = validateExecutorPacket(p);
    assert.equal(r.ok, false);
    assert.equal(r.reason, "unsupported_version");
  });

  test("rejects invalid intent", () => {
    const r = validateExecutorPacket(basePacket({ intent: "delete" }));
    assert.equal(r.ok, false);
    assert.equal(r.reason, "invalid_intent");
  });

  test("rejects empty owned_files", () => {
    const r = validateExecutorPacket(basePacket({ owned_files: [] }));
    assert.equal(r.ok, false);
    assert.equal(r.reason, "missing_owned_files");
  });

  test("rejects too many owned_files", () => {
    const many = Array.from({ length: __consts__.MAX_OWNED_FILES + 1 }, (_, i) => `scripts/f${i}.mjs`);
    const r = validateExecutorPacket(basePacket({ owned_files: many }));
    assert.equal(r.ok, false);
    assert.equal(r.reason, "too_many_owned_files");
  });

  test("rejects protected file in owned_files", () => {
    const r = validateExecutorPacket(basePacket({ owned_files: ["scripts/x.mjs", "vercel.json"] }));
    assert.equal(r.ok, false);
    assert.equal(r.reason, "owned_file_protected");
    assert.equal(r.file, "vercel.json");
  });

  test("rejects non-string owned_files entry", () => {
    const r = validateExecutorPacket(basePacket({ owned_files: ["scripts/x.mjs", 42] }));
    assert.equal(r.ok, false);
    assert.equal(r.reason, "owned_file_not_a_string");
  });

  test("rejects acceptance without test_command and without criteria", () => {
    const r = validateExecutorPacket(basePacket({ acceptance: {} }));
    assert.equal(r.ok, false);
    assert.equal(r.reason, "acceptance_must_have_test_command_or_criteria");
  });

  test("accepts acceptance with criteria list", () => {
    const r = validateExecutorPacket(
      basePacket({ acceptance: { criteria: ["x compiles", "y returns ok"] } }),
    );
    assert.equal(r.ok, true);
  });
});

describe("makePacket", () => {
  test("fills defaults sensibly", () => {
    const p = makePacket({});
    assert.equal(p.executor_packet_version, __consts__.PACKET_VERSION);
    assert.match(p.packet_id, /^pkt-/);
    assert.match(p.emitted_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(p.intent, "modify");
    assert.equal(p.xpass_advisory, true);
    assert.deepEqual(p.proof_required, ["pr_url", "head_sha", "test_run_id", "executor_seat_id"]);
  });

  test("respects overrides", () => {
    const p = makePacket({
      packet_id: "custom",
      intent: "test_only",
      xpass_advisory: false,
      owned_files: ["scripts/x.mjs"],
    });
    assert.equal(p.packet_id, "custom");
    assert.equal(p.intent, "test_only");
    assert.equal(p.xpass_advisory, false);
    assert.deepEqual(p.owned_files, ["scripts/x.mjs"]);
  });
});

describe("makeTestOnlyExecutorPacketFromScopePack", () => {
  test("hydrates a ready ScopePack into a v0 test-only packet", () => {
    const packet = makeTestOnlyExecutorPacketFromScopePack({
      todo: { id: "todo-1" },
      scopePack: {
        owned_files: ["scripts/pinballwake-executor-packet.mjs", "docs/autopilot-executor-lane.md"],
        acceptance: ["hydrate scopepack", "return a sanitized receipt"],
      },
      heartbeat: { tickId: "tick-1" },
      headShaAtRequest: "d13d2d4",
      scopePackCommentId: "comment-1",
      packetId: "pkt-scopepack-1",
      emittedAt: "2026-05-16T14:45:00.000Z",
    });

    assert.equal(packet.executor_packet_version, __consts__.PACKET_VERSION);
    assert.equal(packet.packet_id, "pkt-scopepack-1");
    assert.equal(packet.intent, "test_only");
    assert.equal(packet.todo_id, "todo-1");
    assert.equal(packet.scope_pack_comment_id, "comment-1");
    assert.equal(packet.heartbeat_tick_id, "tick-1");
    assert.equal(packet.head_sha_at_request, "d13d2d4");
    assert.deepEqual(packet.owned_files, [
      "scripts/pinballwake-executor-packet.mjs",
      "docs/autopilot-executor-lane.md",
    ]);
    assert.deepEqual(packet.acceptance.criteria, ["hydrate scopepack", "return a sanitized receipt"]);
    assert.equal(validateExecutorPacket(packet).ok, true);
  });

  test("turns a single verification command into test_command acceptance", () => {
    const packet = makeTestOnlyExecutorPacketFromScopePack({
      todo: { id: "todo-1" },
      scopePack: {
        owned_files: "scripts/pinballwake-executor-packet.mjs",
        verification: ["node --test scripts/pinballwake-executor-packet.test.mjs"],
      },
      heartbeatTickId: "tick-1",
      headShaAtRequest: "d13d2d4",
    });

    assert.deepEqual(packet.owned_files, ["scripts/pinballwake-executor-packet.mjs"]);
    assert.deepEqual(packet.acceptance, {
      test_command: "node --test scripts/pinballwake-executor-packet.test.mjs",
      expected_exit_code: 0,
    });
    assert.equal(validateExecutorPacket(packet).ok, true);
  });

  test("keeps protected owned_files refused by packet validation", () => {
    const packet = makeTestOnlyExecutorPacketFromScopePack({
      todo: { id: "todo-1" },
      scopePack: {
        owned_files: [".github/workflows/autonomous-runner.yml"],
        acceptance: ["do not edit protected workflows"],
      },
      heartbeatTickId: "tick-1",
      headShaAtRequest: "d13d2d4",
    });

    const result = validateExecutorPacket(packet);
    assert.equal(result.ok, false);
    assert.equal(result.reason, "owned_file_protected");
  });
});
