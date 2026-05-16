// scripts/pinballwake-executor-packet.mjs
//
// Executor packet schema + validation. The packet is what the autonomous
// runner emits when it wants the executor lane to do something. The lane
// validates the packet before any code change is applied.
//
// Pairs with: docs/autopilot-executor-lane.md, scripts/pinballwake-executor-lane.mjs.

const PACKET_VERSION = "v0";

const ALLOWED_INTENTS = new Set(["create", "modify", "test_only"]);
const REQUIRED_FIELDS = [
  "executor_packet_version",
  "packet_id",
  "emitted_at",
  "heartbeat_tick_id",
  "requesting_seat_id",
  "todo_id",
  "intent",
  "owned_files",
  "acceptance",
  "head_sha_at_request",
];
const MAX_OWNED_FILES = 25;

// Anything under these path prefixes is a protected surface and packets that
// reference them are rejected. Lower-cased for case-insensitive match.
const PROTECTED_PATH_PREFIXES = [
  ".env",
  ".github/workflows/",
  "vercel.json",
  "supabase/",
  "migrations/",
  ".husky/",
];
const PROTECTED_PATH_SUFFIXES = [
  ".secret",
  ".secrets",
  ".key",
  ".pem",
];
const PROTECTED_NAME_MATCHES = [
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
];

export const __consts__ = {
  PACKET_VERSION,
  ALLOWED_INTENTS,
  REQUIRED_FIELDS,
  MAX_OWNED_FILES,
  PROTECTED_PATH_PREFIXES,
  PROTECTED_PATH_SUFFIXES,
  PROTECTED_NAME_MATCHES,
};

export function isProtectedPath(value) {
  const p = String(value ?? "").trim().toLowerCase();
  if (!p) return true;
  for (const prefix of PROTECTED_PATH_PREFIXES) {
    if (p === prefix || p.startsWith(prefix)) return true;
  }
  for (const suffix of PROTECTED_PATH_SUFFIXES) {
    if (p.endsWith(suffix)) return true;
  }
  for (const match of PROTECTED_NAME_MATCHES) {
    if (p === match || p.endsWith(`/${match}`)) return true;
  }
  return false;
}

export function validateExecutorPacket(packet) {
  if (!packet || typeof packet !== "object") {
    return { ok: false, reason: "missing_packet" };
  }

  for (const field of REQUIRED_FIELDS) {
    if (packet[field] === undefined || packet[field] === null || packet[field] === "") {
      return { ok: false, reason: "missing_field", field };
    }
  }

  if (packet.executor_packet_version !== PACKET_VERSION) {
    return { ok: false, reason: "unsupported_version", got: packet.executor_packet_version };
  }

  if (!ALLOWED_INTENTS.has(packet.intent)) {
    return { ok: false, reason: "invalid_intent", got: packet.intent };
  }

  if (!Array.isArray(packet.owned_files) || packet.owned_files.length === 0) {
    return { ok: false, reason: "missing_owned_files" };
  }

  if (packet.owned_files.length > MAX_OWNED_FILES) {
    return { ok: false, reason: "too_many_owned_files", count: packet.owned_files.length, max: MAX_OWNED_FILES };
  }

  for (const file of packet.owned_files) {
    if (typeof file !== "string" || file.trim() === "") {
      return { ok: false, reason: "owned_file_not_a_string" };
    }
    if (isProtectedPath(file)) {
      return { ok: false, reason: "owned_file_protected", file };
    }
  }

  if (typeof packet.acceptance !== "object" || !packet.acceptance) {
    return { ok: false, reason: "acceptance_must_be_object" };
  }
  if (!packet.acceptance.test_command && !Array.isArray(packet.acceptance.criteria)) {
    return { ok: false, reason: "acceptance_must_have_test_command_or_criteria" };
  }

  return { ok: true };
}

export function makePacket(input = {}) {
  return {
    executor_packet_version: PACKET_VERSION,
    packet_id: input.packet_id ?? cryptoRandomId(),
    emitted_at: input.emitted_at ?? new Date().toISOString(),
    heartbeat_tick_id: input.heartbeat_tick_id ?? null,
    requesting_seat_id: input.requesting_seat_id ?? null,
    todo_id: input.todo_id ?? null,
    scope_pack_comment_id: input.scope_pack_comment_id ?? null,
    intent: input.intent ?? "modify",
    owned_files: input.owned_files ?? [],
    acceptance: input.acceptance ?? {},
    proof_required: input.proof_required ?? ["pr_url", "head_sha", "test_run_id", "executor_seat_id"],
    xpass_advisory: input.xpass_advisory ?? true,
    head_sha_at_request: input.head_sha_at_request ?? null,
  };
}

export function makeTestOnlyExecutorPacketFromScopePack({
  todo = {},
  scopePack = {},
  heartbeat = null,
  heartbeatTickId = "",
  headShaAtRequest = "",
  requestingSeatId = "pinballwake-job-runner",
  scopePackCommentId = "",
  packetId,
  emittedAt,
} = {}) {
  const scope = scopePack && typeof scopePack === "object" ? scopePack : {};
  const todoId = firstText(scope.todo_id, scope.todoId, todo.id, todo.todo_id);
  const tickId = firstText(heartbeatTickId, heartbeat?.tickId, scope.heartbeat_tick_id, todo.heartbeat_tick_id);
  const headSha = firstText(
    headShaAtRequest,
    scope.head_sha_at_request,
    scope.head_sha,
    scope.headSha,
    todo.head_sha_at_request,
    todo.head_sha,
    todo.headSha,
  );

  return makePacket({
    packet_id: packetId,
    emitted_at: emittedAt,
    heartbeat_tick_id: tickId || null,
    requesting_seat_id: requestingSeatId,
    todo_id: todoId || null,
    scope_pack_comment_id:
      firstText(
        scopePackCommentId,
        scope.scope_pack_comment_id,
        scope.scopePackCommentId,
        scope.comment_id,
        todo.scope_pack_comment_id,
        todo.scopePackCommentId,
      ) || null,
    intent: "test_only",
    owned_files: listFromUnknown(scope.owned_files ?? scope.ownedFiles ?? scope.files ?? scope.paths),
    acceptance: acceptanceFromScopePack(scope),
    proof_required: ["scope_pack_comment_id", "head_sha_at_request", "test_run_id", "executor_seat_id"],
    head_sha_at_request: headSha || null,
  });
}

function acceptanceFromScopePack(scope = {}) {
  const direct = scope.acceptance ?? scope.acceptance_criteria ?? scope.acceptanceCriteria;
  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    return { ...direct };
  }

  const criteria = listFromUnknown(direct);
  if (criteria.length > 0) {
    return { criteria };
  }

  const expectedProof = scope.expected_proof && typeof scope.expected_proof === "object" ? scope.expected_proof : {};
  const tests = listFromUnknown(scope.tests ?? scope.verification ?? expectedProof.tests);
  if (tests.length === 1) {
    return { test_command: tests[0], expected_exit_code: 0 };
  }
  if (tests.length > 1) {
    return { criteria: tests.map((test) => `verification: ${test}`) };
  }

  return {};
}

function listFromUnknown(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizePath(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((item) => normalizePath(item))
      .filter(Boolean);
  }
  return [];
}

function normalizePath(value) {
  return String(value ?? "").replace(/\\/g, "/").trim();
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function cryptoRandomId() {
  // Avoid pulling node:crypto for one-off id; use Math.random-shaped suffix.
  // Not security-sensitive; just disambiguation.
  return `pkt-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}
