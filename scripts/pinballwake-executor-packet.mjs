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
const UNSAFE_TEST_COMMAND_CHARS = /[;&|`]/;

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

export function makeTestOnlyPacketFromScopePack(input = {}) {
  const scopepack = input.scopepack ?? input.scopePack ?? null;
  if (!scopepack || typeof scopepack !== "object") {
    return { ok: false, reason: "missing_scopepack" };
  }

  const todo = input.todo ?? {};
  const todoId = input.todo_id ?? input.todoId ?? todo.id ?? todo.todo_id ?? todo.todoId ?? null;
  if (!todoId) return { ok: false, reason: "missing_todo_id" };
  if (!input.heartbeat_tick_id && !input.heartbeatTickId) {
    return { ok: false, reason: "missing_heartbeat_tick_id" };
  }
  if (!input.head_sha_at_request && !input.headShaAtRequest) {
    return { ok: false, reason: "missing_head_sha_at_request" };
  }

  const criteria = firstList(
    scopepack.acceptance,
    scopepack.acceptance_criteria,
    scopepack.acceptanceCriteria,
  );
  const verification = firstList(
    scopepack.verification,
    scopepack.verification_commands,
    scopepack.verificationCommands,
    scopepack.tests,
  );
  const testCommand = firstSafeTestCommand(verification);
  const acceptance = {};
  if (criteria.length > 0) acceptance.criteria = criteria;
  if (testCommand) {
    acceptance.test_command = testCommand;
    acceptance.expected_exit_code = 0;
  }
  if (verification.length > 0) acceptance.verification = verification;

  const packet = makePacket({
    packet_id: input.packet_id ?? input.packetId,
    emitted_at: input.emitted_at ?? input.emittedAt,
    heartbeat_tick_id: input.heartbeat_tick_id ?? input.heartbeatTickId,
    requesting_seat_id: input.requesting_seat_id ?? input.requestingSeatId ?? "pinballwake-job-runner",
    todo_id: todoId,
    scope_pack_comment_id:
      input.scope_pack_comment_id ??
      input.scopePackCommentId ??
      scopepack.scope_pack_comment_id ??
      scopepack.scopePackCommentId ??
      null,
    intent: "test_only",
    owned_files: firstList(scopepack.owned_files, scopepack.ownedFiles, scopepack.files, scopepack.paths).map(
      normalizePath,
    ),
    acceptance,
    proof_required: Array.isArray(scopepack.proof_required)
      ? scopepack.proof_required
      : Array.isArray(scopepack.proofRequired)
        ? scopepack.proofRequired
        : undefined,
    xpass_advisory: input.xpass_advisory ?? input.xpassAdvisory ?? true,
    head_sha_at_request: input.head_sha_at_request ?? input.headShaAtRequest,
  });

  const validation = validateExecutorPacket(packet);
  if (!validation.ok) {
    return { ok: false, reason: `packet_invalid:${validation.reason}`, validation, packet };
  }

  return { ok: true, packet };
}

function cryptoRandomId() {
  // Avoid pulling node:crypto for one-off id; use Math.random-shaped suffix.
  // Not security-sensitive; just disambiguation.
  return `pkt-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

function normalizePath(value) {
  return String(value ?? "").replace(/\\/g, "/").trim();
}

function firstList(...values) {
  for (const value of values) {
    const list = safeList(value);
    if (list.length > 0) return list;
  }
  return [];
}

function safeList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function firstSafeTestCommand(commands) {
  for (const command of commands) {
    const text = String(command ?? "").trim();
    if (!text || UNSAFE_TEST_COMMAND_CHARS.test(text) || /rm\s+-rf/i.test(text)) continue;
    if (/^(node\s+--test|npm\s+(?:run\s+)?test|pnpm\s+(?:run\s+)?test|yarn\s+(?:run\s+)?test)\b/i.test(text)) {
      return text;
    }
  }
  return "";
}
