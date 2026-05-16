// scripts/pinballwake-executor-lane.mjs
//
// Autopilot Executor Lane.
//
// Entry point that wires together:
//   - packet validation (pinballwake-executor-packet.mjs)
//   - CommonSensePass gate (pinballwake-commonsense-pass.mjs)
//   - the existing build-executor (pinballwake-build-executor.mjs)
//   - PASS/HOLD receipts in the canonical xpass_advisory shape
//
// The lane does NOT call the runner directly. The runner builds an executor
// packet, hands it to `processExecutorPacket`, and gets a receipt back. The
// receipt is then emitted via whatever existing channel the runner uses
// (Boardroom post / todo comment).
//
// See docs/autopilot-executor-lane.md for the full design.

import { commonSensePass } from "./pinballwake-commonsense-pass.mjs";
import { makeTestOnlyPacketFromScopePack } from "./pinballwake-executor-packet.mjs";

const RECEIPT_TYPE_PASS = "executor_packet_pass";
const RECEIPT_TYPE_HOLD = "executor_packet_hold";

const PROOF_REQUIRED = ["pr_url", "head_sha", "test_run_id", "executor_seat_id"];

/**
 * Process a single executor packet end-to-end.
 *
 * @param {object} args
 * @param {object} args.packet                  the executor packet
 * @param {object} [args.heartbeat]             `{ tickId, emittedAt }` of latest tick
 * @param {function} [args.fileExists]          async (file) => boolean
 * @param {function} [args.executor]            async (packet) => { ok, pr_url?, head_sha_after?, test_run_id?, output? }
 *                                                Wraps whichever build runner actually applies code changes and opens the PR.
 * @param {string} [args.executorSeatId]        id of the executor seat fulfilling the packet
 * @param {Date}   [args.now]
 * @returns {Promise<object>} receipt
 */
export async function processExecutorPacket({
  packet,
  heartbeat,
  requireHeartbeat = false,
  fileExists,
  executor,
  executorSeatId = "pinballwake-build-executor",
  now = new Date(),
} = {}) {
  // Phase 1: CommonSensePass.
  const gate = await commonSensePass({
    packet,
    heartbeat,
    requireHeartbeat,
    fileExists,
    now,
  });
  if (!gate.ok) {
    return buildHoldReceipt({
      packet,
      executorSeatId,
      now,
      reason: `gate_blocked:${gate.reason}`,
      evidence: omit(gate, ["ok", "reason"]),
    });
  }

  // Phase 2: Test-only intent, skip executor and just confirm gate pass.
  if (packet.intent === "test_only") {
    return buildPassReceipt({
      packet,
      executorSeatId,
      now,
      evidence: {
        intent: "test_only",
        head_sha_before: packet.head_sha_at_request,
        head_sha_after: packet.head_sha_at_request,
        test_run_id: null,
        pr_url: null,
      },
      next_action: "reviewer_safety_pass",
    });
  }

  // Phase 3: Hand off to the executor (build runner that opens the PR).
  if (typeof executor !== "function") {
    return buildHoldReceipt({
      packet,
      executorSeatId,
      now,
      reason: "executor_not_provided",
      evidence: { hint: "pass executor: async (packet) => buildResult to processExecutorPacket" },
    });
  }

  let result;
  try {
    result = await executor(packet);
  } catch (err) {
    return buildHoldReceipt({
      packet,
      executorSeatId,
      now,
      reason: "executor_threw",
      evidence: { error_message: String(err?.message ?? err) },
    });
  }

  if (!result || !result.ok) {
    return buildHoldReceipt({
      packet,
      executorSeatId,
      now,
      reason: "executor_reported_failure",
      evidence: {
        exit_code: result?.exit_code ?? null,
        output: clip(result?.output, 2000),
      },
    });
  }

  return buildPassReceipt({
    packet,
    executorSeatId,
    now,
    evidence: {
      head_sha_before: packet.head_sha_at_request,
      head_sha_after: result.head_sha_after ?? null,
      pr_url: result.pr_url ?? null,
      test_run_id: result.test_run_id ?? null,
      test_exit_code: result.test_exit_code ?? null,
    },
    next_action: "reviewer_safety_pass",
  });
}

export async function processScopePackTestOnlyExecutorPacket({
  todo = {},
  scopePack = {},
  heartbeat = null,
  heartbeatTickId = "",
  headShaAtRequest = "",
  requestingSeatId = "pinballwake-job-runner",
  scopePackCommentId = "",
  fileExists,
  executorSeatId = "pinballwake-build-executor",
  now = new Date(),
} = {}) {
  const safeNow = toDate(now);
  const built = makeTestOnlyPacketFromScopePack({
    todo,
    scopepack: scopePack,
    heartbeatTickId: heartbeatTickId || heartbeat?.tickId || "",
    headShaAtRequest,
    requestingSeatId,
    scopePackCommentId,
    emittedAt: safeNow.toISOString(),
  });

  if (!built.ok) {
    const receipt = buildHoldReceipt({
      packet: built.packet,
      executorSeatId,
      now: safeNow,
      reason: `packet_build_failed:${built.reason}`,
      evidence: built.validation ? { validation: built.validation } : { reason: built.reason },
    });
    return {
      ok: false,
      reason: built.reason,
      packet: built.packet ?? null,
      receipt: sanitizeExecutorReceipt(receipt),
    };
  }

  const receipt = await processExecutorPacket({
    packet: built.packet,
    heartbeat,
    requireHeartbeat: true,
    fileExists,
    executorSeatId,
    now: safeNow,
  });

  return {
    ok: receipt.receipt_type === RECEIPT_TYPE_PASS,
    reason: receipt.hold_reason ?? "executor_packet_pass",
    packet: built.packet,
    receipt: sanitizeExecutorReceipt(receipt),
  };
}

export function sanitizeExecutorReceipt(receipt) {
  const redacted = redactSecrets(receipt);
  return {
    ...(redacted && typeof redacted === "object" ? redacted : {}),
    sanitized: true,
  };
}

function buildPassReceipt({ packet, executorSeatId, now, evidence, next_action }) {
  return {
    receipt_type: RECEIPT_TYPE_PASS,
    emitted_at: now.toISOString(),
    packet_id: packet?.packet_id ?? null,
    executor_seat_id: executorSeatId,
    evidence,
    proof_required: PROOF_REQUIRED,
    xpass_advisory: packet?.xpass_advisory ?? true,
    next_action,
  };
}

function buildHoldReceipt({ packet, executorSeatId, now, reason, evidence }) {
  return {
    receipt_type: RECEIPT_TYPE_HOLD,
    emitted_at: now.toISOString(),
    packet_id: packet?.packet_id ?? null,
    executor_seat_id: executorSeatId,
    hold_reason: reason,
    evidence,
    proof_required: ["scope_pack_comment_id"],
    xpass_advisory: false,
    next_action: "rescope_owned_files",
  };
}

function omit(obj, keys) {
  if (!obj || typeof obj !== "object") return {};
  const out = {};
  for (const k of Object.keys(obj)) {
    if (!keys.includes(k)) out[k] = obj[k];
  }
  return out;
}

function clip(value, max) {
  if (value === undefined || value === null) return null;
  const s = String(value);
  return s.length > max ? `${s.slice(0, max - 3)}...` : s;
}

function toDate(value) {
  return value instanceof Date ? value : new Date(value || Date.now());
}

function redactSecrets(value, key = "") {
  if (value === null || value === undefined) return value;
  if (isSecretKey(key)) return "[redacted]";
  if (typeof value === "string") return redactSecretText(value);
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item));
  if (typeof value === "object") {
    const out = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      out[childKey] = redactSecrets(childValue, childKey);
    }
    return out;
  }
  return value;
}

function redactSecretText(value) {
  return String(value)
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~+/-]+=*/gi, "$1 [redacted]")
    .replace(/\b(api[_-]?key|token|password|secret)=([^&\s]+)/gi, "$1=[redacted]");
}

function isSecretKey(key) {
  return /(authorization|api[_-]?key|token|password|secret|credential)/i.test(String(key || ""));
}

export const __testing__ = {
  RECEIPT_TYPE_PASS,
  RECEIPT_TYPE_HOLD,
  PROOF_REQUIRED,
};
