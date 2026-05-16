// scripts/pinballwake-commonsense-pass.mjs
//
// CommonSensePass: the pre-flight check the executor lane runs on every
// executor packet before any code change is applied.
//
// Stateless / deterministic so it can be unit-tested cleanly.
//
// Returns { ok: true } when the packet should proceed, or
// { ok: false, reason, ...evidence } when it should be held.

import { isProtectedPath, validateExecutorPacket } from "./pinballwake-executor-packet.mjs";

export const DEFAULT_HEARTBEAT_MAX_AGE_MS = 12 * 60 * 1000; // 12 min, about one cycle past a 10-min tick
export const DEFAULT_ALLOWED_REQUESTER_SEATS = new Set([
  "pinballwake-job-runner",
  "unclick-heartbeat-seat",
  "claude-cowork-coordinator-seat",
]);

function runStaticCommonSensePassGates({
  packet,
  now = new Date(),
  heartbeat = null,
  requireHeartbeat = false,
  allowedRequesterSeats = DEFAULT_ALLOWED_REQUESTER_SEATS,
  heartbeatMaxAgeMs = DEFAULT_HEARTBEAT_MAX_AGE_MS,
} = {}) {
  const v = validateExecutorPacket(packet);
  if (!v.ok) {
    return { ok: false, reason: `packet_invalid:${v.reason}`, evidence: v };
  }

  if (!allowedRequesterSeats.has(packet.requesting_seat_id)) {
    return {
      ok: false,
      reason: "authority_not_allowed",
      seat: packet.requesting_seat_id,
    };
  }

  // 3. Heartbeat freshness gate.
  if (requireHeartbeat && (!heartbeat || typeof heartbeat !== "object" || !heartbeat.tickId)) {
    return {
      ok: false,
      reason: "heartbeat_missing",
      evidence: { heartbeat_required: true },
    };
  }
  if (heartbeat) {
    if (heartbeat.tickId !== packet.heartbeat_tick_id) {
      return {
        ok: false,
        reason: "heartbeat_stale",
        evidence: {
          packet_tick: packet.heartbeat_tick_id,
          latest_tick: heartbeat.tickId,
        },
      };
    }
    if (heartbeat.emittedAt) {
      const age = now.getTime() - new Date(heartbeat.emittedAt).getTime();
      if (Number.isFinite(age) && age > heartbeatMaxAgeMs) {
        return {
          ok: false,
          reason: "heartbeat_stale",
          evidence: { age_ms: age, max_age_ms: heartbeatMaxAgeMs },
        };
      }
    }
  }

  // 4. Protected-path gate (re-check, defence in depth; packet validator already checks but the
  //    runtime context may have changed since the packet was emitted).
  for (const file of packet.owned_files) {
    if (isProtectedPath(file)) {
      return { ok: false, reason: "protected_path", file };
    }
  }

  return { ok: true };
}

function runAcceptanceCommonSensePassGate(packet) {
  if (packet.acceptance.test_command !== undefined) {
    if (typeof packet.acceptance.test_command !== "string" || !packet.acceptance.test_command.trim()) {
      return { ok: false, reason: "acceptance_test_command_must_be_non_empty_string" };
    }
    // Sanity: reject obviously dangerous shell payloads.
    if (/[;&|`]/.test(packet.acceptance.test_command) || /rm\s+-rf/i.test(packet.acceptance.test_command)) {
      return { ok: false, reason: "acceptance_test_command_unsafe" };
    }
  }

  return { ok: true };
}

export function commonSensePassSync(args = {}) {
  const staticResult = runStaticCommonSensePassGates(args);
  if (!staticResult.ok) return staticResult;
  return runAcceptanceCommonSensePassGate(args.packet);
}

/**
 * Run all CommonSensePass checks against a packet.
 *
 * @param {object} args
 * @param {object} args.packet                 the executor packet (post `makePacket`)
 * @param {object} [args.now]                  current Date; defaults to new Date()
 * @param {object} [args.heartbeat]            `{ tickId, emittedAt }` of the latest known tick
 * @param {Set<string>} [args.allowedRequesterSeats]
 * @param {function} [args.fileExists]         async (file) => boolean, used for owned_files presence checks. Defaults to a noop that returns true (skip the check) so this can be unit-tested without filesystem.
 * @returns {Promise<{ok: boolean, reason?: string, [k: string]: any}>}
 */
export async function commonSensePass({
  packet,
  now = new Date(),
  heartbeat = null,
  requireHeartbeat = false,
  allowedRequesterSeats = DEFAULT_ALLOWED_REQUESTER_SEATS,
  fileExists = async () => true,
  heartbeatMaxAgeMs = DEFAULT_HEARTBEAT_MAX_AGE_MS,
} = {}) {
  const staticResult = runStaticCommonSensePassGates({
    packet,
    now,
    heartbeat,
    requireHeartbeat,
    allowedRequesterSeats,
    heartbeatMaxAgeMs,
  });
  if (!staticResult.ok) return staticResult;

  // For `intent: "create"`, the test target need not exist yet because that is the point.
  // For `intent: "modify"` or `"test_only"`, all owned_files must exist.
  if (packet.intent !== "create") {
    for (const file of packet.owned_files) {
      const exists = await fileExists(file);
      if (exists === false) {
        return {
          ok: false,
          reason: "owned_file_missing_on_modify",
          file,
        };
      }
    }
  }

  return runAcceptanceCommonSensePassGate(packet);
}
