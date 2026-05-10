#!/usr/bin/env node

import {
  createCodingRoomJobLedger,
  createCodingRoomJob,
  readCodingRoomJobLedger,
  submitCodingRoomProof,
  upsertCodingRoomJob,
  writeCodingRoomJobLedger,
} from "./pinballwake-coding-room.mjs";
import {
  DEFAULT_CODING_ROOM_RUNNER,
  createCodingRoomRunner,
  createCodingRoomRunnerFromEnv,
  runCodingRoomRunnerCycle,
} from "./pinballwake-coding-room-runner.mjs";

export const AUTONOMOUS_RUNNER_MODES = new Set(["dry-run", "claim", "execute"]);

export const DEFAULT_AUTONOMOUS_RUNNER = {
  id: "pinballwake-autonomous-runner",
  readiness: "builder_ready",
  capabilities: ["implementation", "test_fix", "docs_update"],
};

export const DEFAULT_AUTONOMOUS_RUNNER_POLICY = {
  disabled: false,
  allowProtectedSurfaces: false,
  allowExecute: false,
  maxCycles: 1,
  allowedPriorities: ["urgent", "high"],
  allowedActionReasons: ["unassigned_open"],
  allowedTodoRoles: ["builder", "plex-builder", "implementation", "test_fix", "docs_update", "code"],
};

export const DEFAULT_UNCLICK_MCP_URL = "https://unclick.world/api/mcp";

const HOLD_TITLE_PATTERN = /\b(hold|blocker|blocked|dirty)\b/i;
const HOLD_BODY_MARKER_PATTERN = /(?:^|\n)\s*(hold|blocker|blocked|dirty)\s*:/i;

const PROTECTED_SURFACE_PATTERNS = [
  {
    reason: "protected_surface_secret",
    pattern: /\b(secret|secrets|credential|credentials|token|tokens|api key|apikey|api_keys|raw key|private key|plaintext key|env var|env)\b/i,
  },
  {
    reason: "protected_surface_auth",
    pattern: /\b(auth|oauth|login|session|jwt|rls|tenant|permission|permissions|owner auth)\b/i,
  },
  {
    reason: "protected_surface_billing",
    pattern: /\b(billing|stripe|payment|payments|invoice|subscription)\b/i,
  },
  {
    reason: "protected_surface_dns",
    pattern: /\b(dns|domain|domains|vercel domain|apex|www redirect)\b/i,
  },
  {
    reason: "protected_surface_migration",
    pattern: /\b(migration|migrations|schema|supabase sql|alter table|drop table)\b/i,
  },
  {
    reason: "protected_surface_destructive",
    pattern: /\b(force[- ]?push|delete|remove|destructive cleanup|rm -rf|reset --hard)\b/i,
  },
];

const PROTECTED_PATH_PATTERNS = [
  /\.env/i,
  /(^|\/)supabase\/migrations\//i,
  /(^|\/)(auth|billing|payments?|secrets?|credentials?|keychain)(\/|\.|$)/i,
  /stripe/i,
];

function parseBoolean(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function parseIntOption(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseList(value, fallback = []) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function normalizePath(value) {
  return String(value ?? "").replace(/\\/g, "/").trim();
}

function normalizeToken(value) {
  return String(value ?? "").trim().toLowerCase();
}

function compact(value, max = 240) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function compactMultiline(value, max = 12000) {
  const text = String(value ?? "").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function memoryAdminActionUrlFromMcpUrl(mcpUrl = DEFAULT_UNCLICK_MCP_URL, action = "") {
  const url = new URL(mcpUrl || DEFAULT_UNCLICK_MCP_URL);
  url.pathname = "/api/memory-admin";
  url.search = "";
  url.searchParams.set("action", action);
  return url.toString();
}

function stableTodoJobId(todo = {}) {
  return `boardroom-todo:${String(todo.id || todo.todo_id || "unknown").trim()}`;
}

function priorityWeight(priority) {
  const raw = String(priority || "").trim().toLowerCase();
  if (raw === "urgent") return 100;
  if (raw === "high") return 80;
  if (raw === "normal") return 50;
  if (raw === "low") return 20;
  return 0;
}

function tokenSet(value, fallback = []) {
  return new Set(parseList(value, fallback).map(normalizeToken).filter(Boolean));
}

function listTodoRoleTokens(todo = {}, scopePack = {}) {
  const raw = [
    todo.worker,
    todo.worker_role,
    todo.role,
    todo.lane,
    todo.assigned_role,
    todo.assigned_work,
    scopePack.worker,
    scopePack.worker_role,
    scopePack.role,
  ];

  return raw
    .flatMap((value) => parseList(value, []))
    .map(normalizeToken)
    .filter(Boolean);
}

function recentTodoCommentText(todo = {}) {
  const comments = Array.isArray(todo.recent_comments)
    ? todo.recent_comments
    : Array.isArray(todo.comments)
      ? todo.comments
      : [];
  const commentText = comments
    .map((comment) => `${comment?.result || ""} ${comment?.status || ""} ${comment?.body || ""} ${comment?.text || ""}`)
    .join("\n");

  return [
    todo.latest_comment_result,
    todo.latest_comment_status,
    todo.latest_comment_text,
    todo.last_comment_text,
    todo.recent_blocker_comment,
    commentText,
  ].join("\n");
}

function extractMcpTextJson(payload) {
  const content = payload?.result?.content;
  if (Array.isArray(content)) {
    const text = content.find((item) => typeof item?.text === "string")?.text;
    if (text) return JSON.parse(text);
  }

  if (payload?.result && typeof payload.result === "object") {
    return payload.result;
  }

  return payload;
}

function parseJsonObject(value) {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function firstPresentObject(...values) {
  for (const value of values) {
    const parsed = parseJsonObject(value);
    if (parsed) return parsed;
  }
  return null;
}

function parseLabeledJsonObjectFromText(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const label = String.raw`(?:scope[_ -]?pack|scopepack|runner[_ -]?scope|autonomous[_ -]?scope|coding[_ -]?room[_ -]?scope)`;
  const fencedPatterns = [
    new RegExp(String.raw`(?:^|\n)\s*${label}\s*:?\s*\r?\n\s*` + "```(?:json)?\\s*([\\s\\S]*?)```", "gi"),
    new RegExp(String.raw`(?:^|\n)\s*${label}\s*:\s*` + "```(?:json)?\\s*([\\s\\S]*?)```", "gi"),
    /<scope_pack>\s*([\s\S]*?)\s*<\/scope_pack>/gi,
  ];

  for (const pattern of fencedPatterns) {
    let match;
    while ((match = pattern.exec(text))) {
      const parsed = parseJsonObject(match[1]);
      if (parsed) return parsed;
    }
  }

  const inlinePattern = new RegExp(String.raw`(?:^|\n)\s*${label}\s*:\s*(\{[^\r\n]*\})`, "gi");
  let match;
  while ((match = inlinePattern.exec(text))) {
    const parsed = parseJsonObject(match[1]);
    if (parsed) return parsed;
  }

  return null;
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

function extractBoardroomTodoScopePack(todo = {}) {
  const scope = firstPresentObject(
    todo.scope_pack,
    todo.scopePack,
    todo.runner_scope,
    todo.runnerScope,
    todo.autonomous_scope,
    todo.autonomousScope,
    todo.coding_room_scope,
    todo.codingRoomScope,
    parseLabeledJsonObjectFromText(todo.description),
    parseLabeledJsonObjectFromText(todo.body),
    parseLabeledJsonObjectFromText(todo.notes),
  );

  if (!scope) {
    return {
      hasScopePack: false,
      files: [],
      patch: "",
      tests: [],
      jobType: "code",
    };
  }

  const build = parseJsonObject(scope.build) || {};
  const expectedProof = parseJsonObject(scope.expected_proof) || parseJsonObject(scope.expectedProof) || {};
  const files = listFromUnknown(
    scope.owned_files ??
      scope.ownedFiles ??
      scope.files ??
      scope.paths,
  );
  const patch = compactMultiline(
    scope.patch ??
      scope.diff ??
      build.patch ??
      "",
  );
  const tests = listFromUnknown(
    scope.tests ??
      expectedProof.tests,
  );

  return {
    hasScopePack: true,
    files,
    patch,
    tests,
    jobType: String(scope.job_type || scope.jobType || "code").trim() || "code",
    worker: String(scope.worker || "").trim(),
    worker_role: String(scope.worker_role || scope.workerRole || "").trim(),
    role: String(scope.role || "").trim(),
  };
}

export function parseMcpEventStreamPayload(text = "") {
  const messages = String(text)
    .split(/\r?\n\r?\n/)
    .map((block) =>
      block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice("data:".length).trimStart())
        .join("\n")
        .trim(),
    )
    .filter((data) => data && data !== "[DONE]");

  const payloads = [];
  for (const message of messages) {
    try {
      payloads.push(JSON.parse(message));
    } catch {
      // Ignore non-JSON stream chatter and keep looking for the JSON-RPC payload.
    }
  }

  return payloads.find((payload) => payload?.result || payload?.error) || payloads.at(-1) || null;
}

async function readMcpJsonRpcPayload(response) {
  if (typeof response?.text !== "function") {
    if (typeof response?.json === "function") return response.json();
    throw new Error("unclick_mcp_response_unreadable");
  }

  const text = await response.text();
  const trimmed = text.trimStart();
  if (trimmed.startsWith("event:") || trimmed.startsWith("data:")) {
    const payload = parseMcpEventStreamPayload(text);
    if (!payload) throw new Error("empty_unclick_mcp_event_stream");
    return payload;
  }

  return JSON.parse(text);
}

async function callUnClickMcpTool({
  mcpUrl = DEFAULT_UNCLICK_MCP_URL,
  apiKey,
  toolName,
  arguments: toolArguments = {},
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiKey) {
    return { ok: false, reason: "missing_unclick_api_key" };
  }
  if (!mcpUrl) {
    return { ok: false, reason: "missing_unclick_mcp_url" };
  }
  if (typeof fetchImpl !== "function") {
    return { ok: false, reason: "missing_fetch_impl" };
  }

  const response = await fetchImpl(mcpUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `autonomous-runner-${Date.now()}`,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: toolArguments,
      },
    }),
  });

  if (!response?.ok) {
    return {
      ok: false,
      reason: "unclick_mcp_http_error",
      status: response?.status ?? null,
    };
  }

  const payload = await readMcpJsonRpcPayload(response);
  if (payload?.error) {
    return {
      ok: false,
      reason: "unclick_mcp_tool_error",
      error: compact(payload.error?.message || JSON.stringify(payload.error), 500),
    };
  }

  return {
    ok: true,
    data: extractMcpTextJson(payload),
  };
}

export async function fetchUnClickOrchestratorContext({
  mcpUrl = DEFAULT_UNCLICK_MCP_URL,
  apiKey = "",
  limit = 80,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiKey) {
    return { ok: false, reason: "missing_unclick_api_key" };
  }
  if (typeof fetchImpl !== "function") {
    return { ok: false, reason: "missing_fetch_impl" };
  }

  const response = await fetchImpl(memoryAdminActionUrlFromMcpUrl(mcpUrl, "orchestrator_context_read"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ limit }),
  });

  if (!response?.ok) {
    return {
      ok: false,
      reason: "orchestrator_context_http_error",
      status: response?.status ?? null,
    };
  }

  const payload = await response.json().catch(() => ({}));
  return {
    ok: true,
    context: payload?.context ?? null,
  };
}

export function evaluateOrchestratorSeatHandshakeProof(context = {}) {
  const handshake = context?.seat_handshake;
  if (!handshake || typeof handshake !== "object") {
    return {
      ok: false,
      result: "BLOCKER",
      reason: "missing_seat_handshake",
      proof_line: "BLOCKER: missing Orchestrator seat_handshake; next: deploy PR #653 or expose orchestrator_context_read.",
    };
  }

  const handoffText = JSON.stringify(handshake);
  const noisy = /<heartbeat\b|current_time_iso|unclick-heartbeat|run unclick heartbeat|dont_notify/i.test(handoffText);
  const sourcePointers = Array.isArray(handshake.source_pointers) ? handshake.source_pointers : [];
  const seatFreshness = Array.isArray(handshake.seat_freshness) ? handshake.seat_freshness : [];
  const missing = [];
  if (!String(handshake.active_decision || "").trim()) missing.push("active_decision");
  if (!String(handshake.active_job || "").trim()) missing.push("active_job");
  if (!String(handshake.recent_proof || "").trim()) missing.push("recent_proof");
  if (sourcePointers.length === 0) missing.push("source_pointers");
  if (seatFreshness.length === 0) missing.push("seat_freshness");
  if (noisy) missing.push("noise_free_handoff");

  if (missing.length > 0) {
    return {
      ok: false,
      result: "BLOCKER",
      reason: "seat_handshake_incomplete",
      missing,
      proof_line: `BLOCKER: Orchestrator seat_handshake incomplete (${missing.join(", ")}); next: fix compact context proof source.`,
    };
  }

  const proofIds = sourcePointers
    .map((pointer) => String(pointer?.source_id || "").trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(",");

  return {
    ok: true,
    result: "PASS",
    reason: "seat_handshake_ready",
    source_pointer_count: sourcePointers.length,
    seat_freshness_count: seatFreshness.length,
    proof_line: `PASS: Orchestrator seat_handshake readable; proof: ${proofIds || "source_pointers"}; cleanup: done.`,
  };
}

export async function runOrchestratorSeatHandshakeProof({
  mcpUrl = DEFAULT_UNCLICK_MCP_URL,
  apiKey = "",
  limit = 80,
  fetchImpl = globalThis.fetch,
} = {}) {
  const fetched = await fetchUnClickOrchestratorContext({ mcpUrl, apiKey, limit, fetchImpl });
  if (!fetched.ok) {
    return {
      ok: false,
      action: "blocked",
      mode: "orchestrator-proof",
      reason: fetched.reason,
      status: fetched.status ?? null,
      proof_line: `BLOCKER: ${fetched.reason}; next: make orchestrator_context_read available to PinballWake.`,
      orchestrator_proof: fetched,
    };
  }

  const proof = evaluateOrchestratorSeatHandshakeProof(fetched.context);
  return {
    ok: proof.ok,
    action: proof.ok ? "orchestrator_proof_passed" : "blocked",
    mode: "orchestrator-proof",
    reason: proof.reason,
    proof_line: proof.proof_line,
    orchestrator_proof: proof,
  };
}

export async function fetchUnClickActionableTodos({
  agentId = DEFAULT_AUTONOMOUS_RUNNER.id,
  limit = 10,
  mcpUrl = DEFAULT_UNCLICK_MCP_URL,
  apiKey = "",
  fetchImpl = globalThis.fetch,
} = {}) {
  const result = await callUnClickMcpTool({
    mcpUrl,
    apiKey,
    fetchImpl,
    toolName: "list_actionable_todos",
    arguments: {
      agent_id: agentId,
      limit,
      include_description: true,
    },
  });

  if (!result.ok) return result;

  const todos = Array.isArray(result.data?.todos) ? result.data.todos : [];
  return {
    ok: true,
    todos,
    response_bounds: result.data?.response_bounds || null,
  };
}

export function extractBoardroomTodoIdFromCodingRoomJob(job = {}) {
  const jobId = String(job?.job_id || "").trim();
  const source = String(job?.source || "").trim();
  if (source !== "unclick-boardroom-actionable-todo" && !jobId.startsWith("boardroom-todo:")) {
    return "";
  }

  const todoId = jobId.startsWith("boardroom-todo:")
    ? jobId.slice("boardroom-todo:".length).trim()
    : "";
  return todoId && todoId !== "unknown" ? todoId : "";
}

const BOARDROOM_SCOPING_ACTION_REASONS = new Set([
  "stale_in_progress",
  "stale_assigned_open",
  "role_assigned_open",
]);

function boardroomClaimAgentId(runner = {}) {
  const safeRunner = createAutonomousRunner(runner);
  return safeRunner.agent_id || safeRunner.id || DEFAULT_AUTONOMOUS_RUNNER.id;
}

function validateBoardroomClaimSourceState(job = {}) {
  const state = job?.source_state || {};
  if (!state || typeof state !== "object") {
    return { ok: false, reason: "missing_boardroom_claim_source_state" };
  }

  const sourceStatus = String(state.status || "").trim();
  if (sourceStatus !== "open") {
    return { ok: false, reason: "boardroom_todo_not_open", source_status: sourceStatus || null };
  }

  const sourceAssignee = String(state.assigned_to_agent_id || "").trim();
  if (sourceAssignee) {
    return {
      ok: false,
      reason: "boardroom_todo_already_assigned",
      source_assigned_to_agent_id: sourceAssignee,
    };
  }

  const sourceLeaseToken = String(state.lease_token || "").trim();
  const jobClaimId = String(job?.claim_id || "").trim();
  const sourceLeaseExpiresAt = Date.parse(String(state.lease_expires_at || ""));
  const jobClaimedAt = Date.parse(String(job?.claimed_at || ""));
  const sourceLeaseExpired =
    Number.isFinite(sourceLeaseExpiresAt) &&
    Number.isFinite(jobClaimedAt) &&
    sourceLeaseExpiresAt <= jobClaimedAt;
  if (sourceLeaseToken && sourceLeaseToken !== jobClaimId && !sourceLeaseExpired) {
    return { ok: false, reason: "boardroom_todo_lease_token_mismatch" };
  }

  return { ok: true };
}

export async function syncClaimedBoardroomTodoToUnClick({
  job,
  runner = DEFAULT_AUTONOMOUS_RUNNER,
  mcpUrl = DEFAULT_UNCLICK_MCP_URL,
  apiKey = "",
  fetchImpl = globalThis.fetch,
} = {}) {
  const todoId = extractBoardroomTodoIdFromCodingRoomJob(job);
  if (!todoId) {
    return { ok: true, skipped: true, reason: "not_boardroom_todo_claim" };
  }

  const agentId = boardroomClaimAgentId(runner);
  const sourceState = validateBoardroomClaimSourceState(job);
  if (!sourceState.ok) {
    return {
      ok: false,
      reason: "claim_source_state_mismatch",
      todo_id: todoId,
      detail: sourceState.reason,
      source_status: sourceState.source_status ?? null,
      source_assigned_to_agent_id: sourceState.source_assigned_to_agent_id ?? null,
    };
  }

  const update = await callUnClickMcpTool({
    mcpUrl,
    apiKey,
    fetchImpl,
    toolName: "update_todo",
    arguments: {
      agent_id: agentId,
      todo_id: todoId,
      status: "in_progress",
      assigned_to_agent_id: agentId,
    },
  });

  if (!update.ok) {
    return {
      ok: false,
      reason: "update_todo_failed",
      todo_id: todoId,
      detail: update.reason || update.error || null,
      status: update.status ?? null,
    };
  }

  const comment = await callUnClickMcpTool({
    mcpUrl,
    apiKey,
    fetchImpl,
    toolName: "comment_on",
    arguments: {
      agent_id: agentId,
      target_kind: "todo",
      target_id: todoId,
      text: compact(
        [
          "Autonomous Runner claim synced: status open -> in_progress.",
          `owner=${agentId}.`,
          `dispatch=${job?.claim_id || "none"}.`,
          `lease_token=${job?.claim_id || "none"}.`,
          `source=${job?.source || "unknown"}.`,
          `wake_source=${job?.source_state?.wake_source || "unknown"}.`,
          `job=${job?.job_id || "unknown"}.`,
        ].join(" "),
        600,
      ),
    },
  });

  if (!comment.ok) {
    return {
      ok: true,
      reason: "claim_synced_comment_failed",
      todo_id: todoId,
      assigned_to_agent_id: agentId,
      status: "in_progress",
      comment_ok: false,
      comment_detail: comment.reason || comment.error || null,
      comment_status: comment.status ?? null,
    };
  }

  return {
    ok: true,
    todo_id: todoId,
    assigned_to_agent_id: agentId,
    status: "in_progress",
    comment_ok: true,
    comment_id: comment.data?.comment?.id || null,
  };
}

export function selectBoardroomTodoForScoping({ queueSourceResult = {}, lastResult = {} } = {}) {
  if (queueSourceResult.source !== "unclick" || lastResult.action !== "idle") {
    return null;
  }

  const missingScopepackIds = new Set(
    (lastResult.skipped || [])
      .filter((skip) => skip?.reason === "boardroom_todo_missing_scopepack")
      .map((skip) => String(skip.job_id || "").replace(/^boardroom-todo:/, "").trim())
      .filter(Boolean),
  );
  if (missingScopepackIds.size === 0) return null;

  return (queueSourceResult.todos || []).find((todo) => (
    missingScopepackIds.has(String(todo.id || "").trim()) &&
    BOARDROOM_SCOPING_ACTION_REASONS.has(String(todo.actionability_reason || "").trim())
  )) || null;
}

export async function syncBoardroomTodoScopingRequestToUnClick({
  todo,
  runner = DEFAULT_AUTONOMOUS_RUNNER,
  mcpUrl = DEFAULT_UNCLICK_MCP_URL,
  apiKey = "",
  fetchImpl = globalThis.fetch,
} = {}) {
  const todoId = String(todo?.id || "").trim();
  if (!todoId) {
    return { ok: true, skipped: true, reason: "missing_todo_id" };
  }

  const agentId = boardroomClaimAgentId(runner);
  const update = await callUnClickMcpTool({
    mcpUrl,
    apiKey,
    fetchImpl,
    toolName: "update_todo",
    arguments: {
      agent_id: agentId,
      todo_id: todoId,
      status: "open",
      assigned_to_agent_id: "",
    },
  });

  if (!update.ok) {
    return {
      ok: false,
      reason: "scope_request_update_failed",
      todo_id: todoId,
      detail: update.reason || update.error || null,
      status: update.status ?? null,
    };
  }

  const comment = await callUnClickMcpTool({
    mcpUrl,
    apiKey,
    fetchImpl,
    toolName: "comment_on",
    arguments: {
      agent_id: agentId,
      target_kind: "todo",
      target_id: todoId,
      text: compact(
        [
          "Autonomous Runner could not safely build this job yet because no ScopePack was attached.",
          "Reopened for scoping instead of holding a stale active claim.",
          "Next: attach exact owned files, proof/tests, and stop conditions, or split this into a smaller job.",
          `reason=${todo.actionability_reason || "missing_scopepack"}.`,
        ].join(" "),
        700,
      ),
    },
  });

  return {
    ok: true,
    todo_id: todoId,
    status: "open",
    assigned_to_agent_id: null,
    comment_ok: comment.ok,
    comment_id: comment.ok ? comment.data?.comment?.id || null : null,
    comment_detail: comment.ok ? null : comment.reason || comment.error || null,
  };
}

export function createCodingRoomJobFromBoardroomTodo(todo = {}, { now = new Date().toISOString() } = {}) {
  const id = String(todo.id || todo.todo_id || "").trim();
  const title = compact(todo.title || "Untitled Boardroom todo", 180);
  const priority = String(todo.priority || "normal").trim().toLowerCase();
  const assignee = String(todo.assigned_to_agent_id || "").trim();
  const scopePack = extractBoardroomTodoScopePack(todo);
  const contextParts = [
    id ? `Boardroom todo ${id}` : "Boardroom todo",
    priority ? `priority=${priority}` : "",
    assignee ? `assigned=${assignee}` : "unassigned",
    todo.status ? `status=${todo.status}` : "",
    scopePack.hasScopePack ? "scopepack=present" : "scopepack=missing",
  ].filter(Boolean);

  return createCodingRoomJob({
    jobId: stableTodoJobId(todo),
    source: "unclick-boardroom-actionable-todo",
    sourceState: {
      todo_id: id || null,
      status: todo.status || null,
      assigned_to_agent_id: todo.assigned_to_agent_id || null,
      lease_expires_at: todo.lease_expires_at || null,
      lease_token: todo.lease_token || null,
      reclaim_count: Number.isFinite(todo.reclaim_count) ? todo.reclaim_count : null,
      actionability_reason: todo.actionability_reason || null,
      updated_at: todo.updated_at || null,
      wake_source: todo.wake_source || todo.wakeSource || null,
    },
    worker: assignee || "builder",
    chip: title,
    context: `${contextParts.join("; ")}. Imported for autonomous claim/routing; claim only when a ScopePack names owned files and an executable patch.`,
    jobType: scopePack.jobType,
    files: scopePack.files,
    expectedProof: {
      requiresPr: false,
      requiresChangedFiles: scopePack.hasScopePack,
      requiresNonOverlap: true,
      requiresTests: scopePack.tests.length > 0,
      tests: scopePack.tests,
    },
    build: {
      patch: scopePack.patch,
    },
    createdAt: todo.created_at || now,
  });
}

export function evaluateBoardroomTodoAutoClaimEligibility(
  todo = {},
  {
    scopePack = extractBoardroomTodoScopePack(todo),
    allowedPriorities = DEFAULT_AUTONOMOUS_RUNNER_POLICY.allowedPriorities,
    allowedActionReasons = DEFAULT_AUTONOMOUS_RUNNER_POLICY.allowedActionReasons,
    allowedTodoRoles = DEFAULT_AUTONOMOUS_RUNNER_POLICY.allowedTodoRoles,
    allowProtectedSurfaces = false,
    now = new Date().toISOString(),
  } = {},
) {
  if (!scopePack.hasScopePack) {
    return { ok: true, reason: "missing_scopepack_kept_for_scoping" };
  }

  const priority = normalizeToken(todo.priority || "normal");
  const safePriorities = tokenSet(allowedPriorities, DEFAULT_AUTONOMOUS_RUNNER_POLICY.allowedPriorities);
  if (!safePriorities.has(priority)) {
    return { ok: false, reason: "boardroom_todo_priority_not_allowed", priority };
  }

  const status = normalizeToken(todo.status || "");
  if (status !== "open") {
    return { ok: false, reason: "boardroom_todo_not_open", status: status || null };
  }

  const assignedTo = String(todo.assigned_to_agent_id || "").trim();
  if (assignedTo) {
    return { ok: false, reason: "boardroom_todo_already_assigned", assigned_to_agent_id: assignedTo };
  }

  const actionReason = normalizeToken(todo.actionability_reason || "");
  const safeActionReasons = tokenSet(allowedActionReasons, DEFAULT_AUTONOMOUS_RUNNER_POLICY.allowedActionReasons);
  if (actionReason && safeActionReasons.size > 0 && !safeActionReasons.has(actionReason)) {
    return { ok: false, reason: "boardroom_todo_action_reason_not_allowed", actionability_reason: actionReason };
  }

  const title = String(todo.title || "");
  const description = String(todo.description || todo.body || todo.notes || "");
  if (HOLD_TITLE_PATTERN.test(title) || HOLD_BODY_MARKER_PATTERN.test(description)) {
    return { ok: false, reason: "boardroom_todo_hold_or_blocker_marker" };
  }

  if (/\b(blocker|blocked)\b/i.test(recentTodoCommentText(todo))) {
    return { ok: false, reason: "boardroom_todo_recent_blocker_comment" };
  }

  const safeRoles = tokenSet(allowedTodoRoles, DEFAULT_AUTONOMOUS_RUNNER_POLICY.allowedTodoRoles);
  const roleTokens = listTodoRoleTokens(todo, scopePack);
  const hasAllowedRole = roleTokens.length === 0 || roleTokens.some((role) => safeRoles.has(role));
  if (!hasAllowedRole) {
    return { ok: false, reason: "boardroom_todo_role_not_allowed", role: roleTokens[0] || null };
  }

  if (!allowProtectedSurfaces) {
    const safety = inspectAutonomousRunnerJobSafety(createCodingRoomJobFromBoardroomTodo(todo, { now }));
    if (!safety.ok) {
      return { ok: false, reason: safety.reason, file: safety.file || null };
    }
  }

  return { ok: true, reason: "boardroom_todo_claim_eligible" };
}

export async function hydrateAutonomousRunnerLedgerFromUnClick({
  ledger,
  runner = DEFAULT_AUTONOMOUS_RUNNER,
  now = new Date().toISOString(),
  apiKey = "",
  mcpUrl = DEFAULT_UNCLICK_MCP_URL,
  limit = 10,
  fetchImpl = globalThis.fetch,
  wakeSource = "unknown",
  allowedPriorities = DEFAULT_AUTONOMOUS_RUNNER_POLICY.allowedPriorities,
  allowedActionReasons = DEFAULT_AUTONOMOUS_RUNNER_POLICY.allowedActionReasons,
  allowedTodoRoles = DEFAULT_AUTONOMOUS_RUNNER_POLICY.allowedTodoRoles,
  allowProtectedSurfaces = false,
} = {}) {
  const fetched = await fetchUnClickActionableTodos({
    agentId: runner.agent_id || runner.id || DEFAULT_AUTONOMOUS_RUNNER.id,
    apiKey,
    mcpUrl,
    limit,
    fetchImpl,
  });

  if (!fetched.ok) {
    return {
      ok: false,
      reason: fetched.reason,
      status: fetched.status ?? null,
      error: fetched.error ?? null,
      ledger: createCodingRoomJobLedger({ jobs: ledger?.jobs || [], updatedAt: ledger?.updated_at || now }),
      imported: 0,
      seen: 0,
    };
  }

  const ordered = [...fetched.todos].sort((a, b) =>
    priorityWeight(b.priority) - priorityWeight(a.priority) ||
    String(a.created_at || "").localeCompare(String(b.created_at || "")),
  );

  let next = createCodingRoomJobLedger({ jobs: ledger?.jobs || [], updatedAt: ledger?.updated_at || now });
  let imported = 0;
  const skipped = [];
  for (const todo of ordered) {
    const scopePack = extractBoardroomTodoScopePack(todo);
    const eligibility = evaluateBoardroomTodoAutoClaimEligibility(todo, {
      scopePack,
      allowedPriorities,
      allowedActionReasons,
      allowedTodoRoles,
      allowProtectedSurfaces,
      now,
    });
    if (!eligibility.ok) {
      skipped.push({
        id: todo.id,
        title: compact(todo.title, 140),
        priority: todo.priority || null,
        status: todo.status || null,
        assigned_to_agent_id: todo.assigned_to_agent_id || null,
        actionability_reason: todo.actionability_reason || null,
        reason: eligibility.reason,
        file: eligibility.file || null,
      });
      continue;
    }

    const upserted = upsertCodingRoomJob({
      ledger: next,
      job: createCodingRoomJobFromBoardroomTodo(
        {
          ...todo,
          wake_source: wakeSource,
        },
        { now },
      ),
      now,
    });
    if (upserted.ok) {
      next = upserted.ledger;
      if (upserted.action === "inserted") imported += 1;
    }
  }

  return {
    ok: true,
    reason: ordered.length ? "unclick_actionable_todos_imported" : "no_unclick_actionable_todos",
    ledger: next,
    imported,
    seen: ordered.length,
    skipped,
    todos: ordered.map((todo) => ({
      id: todo.id,
      title: compact(todo.title, 140),
      priority: todo.priority || null,
      status: todo.status || null,
      assigned_to_agent_id: todo.assigned_to_agent_id || null,
      actionability_reason: todo.actionability_reason || null,
    })),
  };
}

export function createAutonomousRunner(input = {}) {
  return createCodingRoomRunner({
    ...DEFAULT_AUTONOMOUS_RUNNER,
    ...input,
    id: input.id || input.runnerId || DEFAULT_AUTONOMOUS_RUNNER.id,
    agentId: input.agentId || input.agent_id || "",
    capabilities: Array.isArray(input.capabilities)
      ? input.capabilities
      : DEFAULT_AUTONOMOUS_RUNNER.capabilities,
  });
}

export function createAutonomousRunnerFromEnv(env = process.env) {
  const base = createCodingRoomRunnerFromEnv(env);
  return createAutonomousRunner({
    ...base,
    id: env.AUTONOMOUS_RUNNER_ID || base.id || DEFAULT_AUTONOMOUS_RUNNER.id,
    readiness: env.AUTONOMOUS_RUNNER_READINESS || base.readiness || DEFAULT_AUTONOMOUS_RUNNER.readiness,
    capabilities: parseList(
      env.AUTONOMOUS_RUNNER_CAPABILITIES,
      base.capabilities?.length ? base.capabilities : DEFAULT_AUTONOMOUS_RUNNER.capabilities,
    ),
  });
}

export function createAutonomousRunnerPolicy(input = {}) {
  return {
    ...DEFAULT_AUTONOMOUS_RUNNER_POLICY,
    ...input,
    disabled: Boolean(input.disabled),
    allowProtectedSurfaces: Boolean(input.allowProtectedSurfaces),
    allowExecute: Boolean(input.allowExecute),
    maxCycles: Math.max(1, Number.isFinite(input.maxCycles) ? input.maxCycles : DEFAULT_AUTONOMOUS_RUNNER_POLICY.maxCycles),
    allowedPriorities: parseList(input.allowedPriorities, DEFAULT_AUTONOMOUS_RUNNER_POLICY.allowedPriorities),
    allowedActionReasons: parseList(input.allowedActionReasons, DEFAULT_AUTONOMOUS_RUNNER_POLICY.allowedActionReasons),
    allowedTodoRoles: parseList(input.allowedTodoRoles, DEFAULT_AUTONOMOUS_RUNNER_POLICY.allowedTodoRoles),
  };
}

export function normalizeAutonomousRunnerMode(value) {
  const mode = String(value || "dry-run").trim().toLowerCase();
  return AUTONOMOUS_RUNNER_MODES.has(mode) ? mode : "dry-run";
}

export function inspectAutonomousRunnerJobSafety(job) {
  if (!job) {
    return { ok: false, reason: "missing_job" };
  }

  const searchable = [
    job.worker,
    job.chip,
    job.context,
    job.source,
    ...(job.expected_proof?.tests || []),
  ].join(" ");

  for (const { reason, pattern } of PROTECTED_SURFACE_PATTERNS) {
    if (pattern.test(searchable)) {
      return { ok: false, reason, surface: compact(searchable) };
    }
  }

  const protectedPath = (job.owned_files || []).map(normalizePath).find((file) =>
    PROTECTED_PATH_PATTERNS.some((pattern) => pattern.test(file)),
  );
  if (protectedPath) {
    return { ok: false, reason: "protected_surface_path", file: protectedPath };
  }

  return { ok: true, reason: "safe_for_autonomous_runner" };
}

export function markUnsafeJobsBlockedForAutonomousRunner({
  ledger,
  allowProtectedSurfaces = false,
  now = new Date().toISOString(),
} = {}) {
  const next = createCodingRoomJobLedger({
    jobs: ledger?.jobs || [],
    updatedAt: now,
  });

  if (allowProtectedSurfaces) {
    return { ok: true, ledger: next, blocked: [] };
  }

  const blocked = [];
  next.jobs = next.jobs.map((job) => {
    if (job.status !== "queued") {
      return job;
    }

    const safety = inspectAutonomousRunnerJobSafety(job);
    if (safety.ok) {
      return job;
    }

    const proof = submitCodingRoomProof({
      job,
      proof: {
        result: "blocker",
        blocker: `Autonomous Runner blocked protected work: ${safety.reason}`,
        submittedAt: now,
      },
    });

    if (!proof.ok) {
      return {
        ...job,
        status: "blocked",
        proof: {
          result: "blocker",
          blocker: `Autonomous Runner blocked protected work: ${safety.reason}`,
          submitted_at: now,
        },
      };
    }

    blocked.push({
      job_id: job.job_id,
      reason: safety.reason,
      file: safety.file || null,
    });
    return proof.job;
  });

  return { ok: true, ledger: next, blocked };
}

export function runAutonomousRunnerCycle({
  ledger,
  runner = DEFAULT_AUTONOMOUS_RUNNER,
  mode = "dry-run",
  policy = DEFAULT_AUTONOMOUS_RUNNER_POLICY,
  now = new Date().toISOString(),
  leaseSeconds,
} = {}) {
  const safePolicy = createAutonomousRunnerPolicy(policy);
  const safeMode = normalizeAutonomousRunnerMode(mode);
  const safeRunner = createAutonomousRunner(runner);

  if (safePolicy.disabled) {
    return {
      ok: true,
      action: "disabled",
      mode: safeMode,
      reason: "kill_switch_enabled",
      runner: safeRunner.id,
      ledger: createCodingRoomJobLedger({ jobs: ledger?.jobs || [], updatedAt: ledger?.updated_at || now }),
    };
  }

  if (safeMode === "execute" && !safePolicy.allowExecute) {
    return {
      ok: true,
      action: "blocked",
      mode: safeMode,
      reason: "execute_mode_disabled",
      runner: safeRunner.id,
      ledger: createCodingRoomJobLedger({ jobs: ledger?.jobs || [], updatedAt: ledger?.updated_at || now }),
      safety_blocked: [],
    };
  }

  const hardened = markUnsafeJobsBlockedForAutonomousRunner({
    ledger,
    allowProtectedSurfaces: safePolicy.allowProtectedSurfaces,
    now,
  });

  if (!hardened.ok) {
    return hardened;
  }

  const claim = runCodingRoomRunnerCycle({
    ledger: hardened.ledger,
    runner: safeRunner,
    now,
    leaseSeconds,
  });

  return {
    ...claim,
    mode: safeMode,
    runner: safeRunner.id,
    dry_run: safeMode === "dry-run",
    safety_blocked: hardened.blocked,
  };
}

export async function runAutonomousRunnerFile({
  ledgerPath,
  runner = createAutonomousRunnerFromEnv(),
  mode = "dry-run",
  policy = createAutonomousRunnerPolicy(),
  queueSource = "ledger",
  unclickApiKey = "",
  unclickMcpUrl = DEFAULT_UNCLICK_MCP_URL,
  todoLimit = 10,
  fetchImpl = globalThis.fetch,
  now = new Date().toISOString(),
  leaseSeconds,
  wakeSource = "unknown",
  orchestratorProof = false,
} = {}) {
  if (orchestratorProof) {
    return runOrchestratorSeatHandshakeProof({
      mcpUrl: unclickMcpUrl,
      apiKey: unclickApiKey,
      limit: todoLimit,
      fetchImpl,
    });
  }

  if (!ledgerPath) {
    return { ok: false, reason: "missing_ledger_path" };
  }

  const safePolicy = createAutonomousRunnerPolicy(policy);
  const safeMode = normalizeAutonomousRunnerMode(mode);
  let ledger = await readCodingRoomJobLedger(ledgerPath);
  let queueSourceResult = {
    ok: true,
    source: "ledger",
    reason: "local_ledger_only",
    imported: 0,
    seen: ledger.jobs?.length || 0,
  };

  if (String(queueSource || "ledger").trim().toLowerCase() === "unclick") {
    queueSourceResult = {
      source: "unclick",
      ...(await hydrateAutonomousRunnerLedgerFromUnClick({
        ledger,
        runner,
        now,
        apiKey: unclickApiKey,
        mcpUrl: unclickMcpUrl,
        limit: todoLimit,
        fetchImpl,
        wakeSource,
        allowedPriorities: safePolicy.allowedPriorities,
        allowedActionReasons: safePolicy.allowedActionReasons,
        allowedTodoRoles: safePolicy.allowedTodoRoles,
        allowProtectedSurfaces: safePolicy.allowProtectedSurfaces,
      })),
    };
    ledger = queueSourceResult.ledger || ledger;

    if (!queueSourceResult.ok && (ledger.jobs || []).length === 0) {
      return {
        ok: false,
        action: "blocked",
        reason: "queue_source_unavailable",
        mode: safeMode,
        dry_run: safeMode === "dry-run",
        persisted: false,
        cycles: [],
        ledger,
        ledger_path: ledgerPath,
        queue_source: queueSourceResult,
      };
    }
  }

  const results = [];

  for (let index = 0; index < safePolicy.maxCycles; index += 1) {
    const result = runAutonomousRunnerCycle({
      ledger,
      runner,
      mode: safeMode,
      policy: safePolicy,
      now,
      leaseSeconds,
    });
    results.push(result);
    ledger = result.ledger || ledger;

    if (!result.ok || ["idle", "disabled", "blocked"].includes(result.action)) {
      break;
    }
  }

  const executeBlocked = safeMode === "execute" && !safePolicy.allowExecute;
  const shouldPersist = safeMode !== "dry-run" && !safePolicy.disabled && !executeBlocked;
  const last = results[results.length - 1] || { ok: true, action: "idle", reason: "no_cycle_run", ledger };
  let todoClaimSync = { ok: true, skipped: true, reason: "sync_not_applicable" };
  let todoScopingSync = { ok: true, skipped: true, reason: "sync_not_applicable" };

  if (
    shouldPersist &&
    queueSourceResult.source === "unclick" &&
    last.action === "claimed" &&
    last.job
  ) {
    todoClaimSync = await syncClaimedBoardroomTodoToUnClick({
      job: last.job,
      runner,
      apiKey: unclickApiKey,
      mcpUrl: unclickMcpUrl,
      fetchImpl,
    });

    if (!todoClaimSync.ok) {
      return {
        ...last,
        ok: false,
        action: "blocked",
        reason: "todo_claim_sync_failed",
        mode: safeMode,
        dry_run: safeMode === "dry-run",
        persisted: false,
        cycles: results,
        ledger,
        ledger_path: ledgerPath,
        queue_source: queueSourceResult,
        todo_claim_sync: todoClaimSync,
      };
    }
  }

  const todoForScoping = selectBoardroomTodoForScoping({ queueSourceResult, lastResult: last });
  if (shouldPersist && todoForScoping) {
    todoScopingSync = await syncBoardroomTodoScopingRequestToUnClick({
      todo: todoForScoping,
      runner,
      apiKey: unclickApiKey,
      mcpUrl: unclickMcpUrl,
      fetchImpl,
    });

    if (!todoScopingSync.ok) {
      return {
        ...last,
        ok: false,
        action: "blocked",
        reason: "todo_scoping_sync_failed",
        mode: safeMode,
        dry_run: safeMode === "dry-run",
        persisted: false,
        cycles: results,
        ledger,
        ledger_path: ledgerPath,
        queue_source: queueSourceResult,
        todo_claim_sync: todoClaimSync,
        todo_scoping_sync: todoScopingSync,
      };
    }
  }

  if (shouldPersist) {
    await writeCodingRoomJobLedger(ledgerPath, ledger);
  }

  return {
    ...last,
    ok: results.every((result) => result.ok) && todoClaimSync.ok && todoScopingSync.ok,
    action: todoForScoping && shouldPersist ? "scoping_requested" : last.action,
    reason: todoForScoping && shouldPersist ? "boardroom_todo_reopened_for_scoping" : last.reason,
    mode: safeMode,
    dry_run: safeMode === "dry-run",
    persisted: shouldPersist,
    cycles: results,
    ledger,
    ledger_path: ledgerPath,
    queue_source: queueSourceResult,
    todo_claim_sync: todoClaimSync,
    todo_scoping_sync: todoScopingSync,
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  const explicitMode = getArg("mode", process.env.AUTONOMOUS_RUNNER_MODE || "");
  const dryRun = process.argv.includes("--dry-run") || parseBoolean(process.env.AUTONOMOUS_RUNNER_DRY_RUN);
  const mode = dryRun ? "dry-run" : normalizeAutonomousRunnerMode(explicitMode || "dry-run");

  runAutonomousRunnerFile({
    ledgerPath: getArg("ledger", process.env.CODING_ROOM_LEDGER_PATH || ""),
    mode,
    runner: createAutonomousRunnerFromEnv(),
    queueSource: getArg("queue-source", process.env.AUTONOMOUS_RUNNER_QUEUE_SOURCE || "ledger"),
    unclickApiKey: getArg("unclick-api-key", process.env.UNCLICK_API_KEY || ""),
    unclickMcpUrl: getArg("unclick-mcp-url", process.env.UNCLICK_MCP_URL || DEFAULT_UNCLICK_MCP_URL),
    todoLimit: parseIntOption(getArg("todo-limit", process.env.AUTONOMOUS_RUNNER_TODO_LIMIT), 10),
    leaseSeconds: parseIntOption(getArg("lease-seconds", process.env.CODING_ROOM_LEASE_SECONDS), undefined),
    wakeSource: getArg("wake-source", process.env.AUTONOMOUS_RUNNER_WAKE_SOURCE || process.env.GITHUB_EVENT_NAME || "unknown"),
    orchestratorProof: parseBoolean(getArg("orchestrator-proof", process.env.AUTONOMOUS_RUNNER_ORCHESTRATOR_PROOF)),
    policy: createAutonomousRunnerPolicy({
      disabled: parseBoolean(process.env.AUTONOMOUS_RUNNER_DISABLED),
      allowProtectedSurfaces: parseBoolean(process.env.AUTONOMOUS_RUNNER_ALLOW_PROTECTED_SURFACES),
      allowExecute: parseBoolean(process.env.AUTONOMOUS_RUNNER_ALLOW_EXECUTE),
      maxCycles: parseIntOption(getArg("max-cycles", process.env.AUTONOMOUS_RUNNER_MAX_CYCLES), 1),
      allowedPriorities: process.env.AUTONOMOUS_RUNNER_ALLOWED_PRIORITIES,
      allowedActionReasons: process.env.AUTONOMOUS_RUNNER_ALLOWED_ACTION_REASONS,
      allowedTodoRoles: process.env.AUTONOMOUS_RUNNER_ALLOWED_TODO_ROLES,
    }),
  })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
