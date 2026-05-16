#!/usr/bin/env node

import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
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
import { evaluateOrchestratorProofWakeGate } from "./lib/autopilotkit-liveness.mjs";
import { processScopePackTestOnlyExecutorPacket } from "./pinballwake-executor-lane.mjs";
import { buildScopePackHydrationReceipt } from "./pinballwake-scopepack-hydrator.mjs";

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

const HOLD_TITLE_PATTERN = /\b(hold|blocker|blocked)\b/i;
const HOLD_TITLE_MARKER_PATTERN = /^\s*(hold|blocker|blocked|dirty)\s*:/i;
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

export function parseAutonomousRunnerGitStatusPorcelain(statusText = "") {
  return String(statusText ?? "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => ({
      status: line.slice(0, 2).trim(),
      path: line.slice(3).trim() || line.trim(),
    }));
}

function normalizeGitStatusPath(value) {
  return normalizePath(value).replace(/^\.?\//, "").replace(/\/+$/, "");
}

function buildAutonomousRunnerGitHygieneIgnoredPaths({ ledgerPath = "" } = {}) {
  const normalizedLedger = normalizeGitStatusPath(ledgerPath);
  if (!normalizedLedger) return [];

  const ignored = new Set([normalizedLedger]);
  const parts = normalizedLedger.split("/").filter(Boolean);
  if (parts.length > 1 && parts[0] === ".pinballwake") {
    ignored.add(parts[0]);
  }

  return [...ignored];
}

function isIgnoredGitStatusPath(path, ignoredPaths = []) {
  const normalizedPath = normalizeGitStatusPath(path);
  if (!normalizedPath) return false;

  return ignoredPaths.some((ignored) => {
    const normalizedIgnored = normalizeGitStatusPath(ignored);
    return (
      normalizedPath === normalizedIgnored ||
      normalizedPath.startsWith(`${normalizedIgnored}/`) ||
      normalizedIgnored.startsWith(`${normalizedPath}/`)
    );
  });
}

export async function readAutonomousRunnerGitStatus({ cwd = process.cwd() } = {}) {
  return new Promise((resolve) => {
    execFile("git", ["status", "--porcelain", "--untracked-files=all"], { cwd }, (error, stdout, stderr) => {
      const code = error?.code;
      resolve({
        ok: !error,
        status: !error ? 0 : typeof code === "number" ? code : 1,
        stdout: String(stdout ?? ""),
        stderr: String(stderr ?? ""),
      });
    });
  });
}

export async function evaluateAutonomousRunnerGitHygiene({
  cwd = process.cwd(),
  gitStatusImpl = readAutonomousRunnerGitStatus,
  ignoredPaths = [],
} = {}) {
  const status = await gitStatusImpl({ cwd });
  if (!status?.ok) {
    return {
      ok: false,
      reason: /not a git repository/i.test(status?.stderr || "")
        ? "git_hygiene_not_a_worktree"
        : "git_hygiene_status_failed",
      status: status?.status ?? 1,
      stderr: compact(status?.stderr || status?.error || "", 500),
    };
  }

  const dirty = parseAutonomousRunnerGitStatusPorcelain(status.stdout);
  const ignored = dirty.filter((entry) => isIgnoredGitStatusPath(entry.path, ignoredPaths));
  const blocking = dirty.filter((entry) => !isIgnoredGitStatusPath(entry.path, ignoredPaths));
  if (blocking.length === 0) {
    return {
      ok: true,
      reason: ignored.length > 0 ? "git_hygiene_generated_only" : "git_hygiene_clean",
      dirty_files: [],
      ignored_files: ignored.map((entry) => entry.path),
    };
  }

  return {
    ok: false,
    reason: "git_hygiene_dirty_worktree",
    dirty_files: blocking.map((entry) => entry.path),
    dirty_count: blocking.length,
    ignored_files: ignored.map((entry) => entry.path),
  };
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
    scopePack.lane,
  ];

  return raw
    .flatMap((value) => parseList(value, []))
    .map(normalizeToken)
    .filter(Boolean);
}

function listOwnerHintTokens(todo = {}, scopePack = {}) {
  return [
    todo.owner_hint,
    todo.ownerHint,
    scopePack.owner_hint,
    scopePack.ownerHint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function ownerHintAllowsBuilderCompatibleRunner(todo = {}, scopePack = {}) {
  return listOwnerHintTokens(todo, scopePack).includes("builder");
}

function ownerHintAllowsBuilderCompatibleOrchestrator(todo = {}, scopePack = {}) {
  const tokens = listOwnerHintTokens(todo, scopePack);
  return tokens.includes("builder") && tokens.includes("orchestrator");
}

function listRunnerClaimTokens(runner = {}) {
  const raw = [
    runner.id,
    runner.agent_id,
    runner.agentId,
    runner.name,
    runner.role,
    runner.worker_role,
    runner.lane,
    runner.readiness,
    ...(Array.isArray(runner.capabilities) ? runner.capabilities : []),
  ];

  return raw
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function autonomousRunnerAgentId(runner = {}) {
  return String(runner.agent_id || runner.agentId || runner.id || "").trim();
}

function isWatcherOrTetherRunner(runner = {}) {
  const tokens = new Set(listRunnerClaimTokens(runner));
  return tokens.has("watcher") || tokens.has("tether");
}

function scopePackLooksBuilderAssigned({ roleTokens = [], hasBuilderCompatibleOwnerHint = false } = {}) {
  return hasBuilderCompatibleOwnerHint || roleTokens.some((role) => role === "builder" || role === "plex-builder");
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

function hasRecentTodoBlockerMarker(todo = {}) {
  const comments = Array.isArray(todo.recent_comments)
    ? todo.recent_comments
    : Array.isArray(todo.comments)
      ? todo.comments
      : [];
  const structuredText = [
    todo.latest_comment_result,
    todo.latest_comment_status,
    todo.recent_blocker_comment,
    ...comments.map((comment) => `${comment?.result || ""} ${comment?.status || ""}`),
  ].join("\n");
  if (/\b(blocker|blocked)\b/i.test(structuredText)) return true;

  return /(?:^|\n)\s*(blocker|blocked)\s*:/i.test(recentTodoCommentText(todo));
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

function boardroomTodoScopeTextSources(todo = {}) {
  const comments = Array.isArray(todo.recent_comments)
    ? todo.recent_comments
    : Array.isArray(todo.comments)
      ? todo.comments
      : [];

  return [
    todo.description,
    todo.body,
    todo.notes,
    todo.latest_comment_text,
    todo.last_comment_text,
    ...comments.map((comment) => `${comment?.body || ""}\n${comment?.text || ""}`),
  ];
}

function extractBoardroomTodoScopePack(todo = {}) {
  const scope = extractBoardroomTodoScopePackObject(todo);

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
      scope.verification ??
      scope.verification_commands ??
      scope.verificationCommands ??
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
    lane: String(scope.lane || scope.worker_lane || scope.workerLane || "").trim(),
    owner_hint: String(scope.owner_hint || scope.ownerHint || "").trim(),
  };
}

function extractBoardroomTodoScopePackObject(todo = {}) {
  return firstPresentObject(
    todo.scope_pack,
    todo.scopePack,
    todo.runner_scope,
    todo.runnerScope,
    todo.autonomous_scope,
    todo.autonomousScope,
    todo.coding_room_scope,
    todo.codingRoomScope,
    ...boardroomTodoScopeTextSources(todo).map(parseLabeledJsonObjectFromText),
  );
}

export async function createAutonomousRunnerTestOnlyExecutorReceipt({
  todo = {},
  scopePack = null,
  heartbeat = null,
  heartbeatTickId = "",
  headShaAtRequest = "",
  requestingSeatId = "pinballwake-job-runner",
  scopePackCommentId = "",
  fileExists,
  executorSeatId = "pinballwake-build-executor",
  now = new Date(),
} = {}) {
  return processScopePackTestOnlyExecutorPacket({
    todo,
    scopePack: scopePack || extractBoardroomTodoScopePackObject(todo) || {},
    heartbeat,
    heartbeatTickId,
    headShaAtRequest,
    requestingSeatId,
    scopePackCommentId,
    fileExists,
    executorSeatId,
    now,
  });
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

  const { next_prompt: _nextPrompt, ...handoffEnvelope } = handshake;
  const noisy = containsRawHeartbeatPayload(handoffEnvelope);
  const sourcePointers = Array.isArray(handshake.source_pointers) ? handshake.source_pointers : [];
  const seatFreshness = Array.isArray(handshake.seat_freshness) ? handshake.seat_freshness : [];
  const missing = [];
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

function containsRawHeartbeatPayload(value, key = "") {
  if (value == null) return false;
  if (typeof value === "string") {
    const text = value.trim();
    if (/<heartbeat\b|<\/heartbeat>|<current_time_iso\b|<automation_id\b/i.test(text)) {
      return true;
    }
    if (/^raw_/i.test(key) && /current_time_iso|unclick-heartbeat|run unclick heartbeat|dont_notify/i.test(text)) {
      return true;
    }
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsRawHeartbeatPayload(item, key));
  }
  if (typeof value === "object") {
    return Object.entries(value).some(([childKey, childValue]) => containsRawHeartbeatPayload(childValue, childKey));
  }
  return false;
}

export async function runOrchestratorSeatHandshakeProof({
  mcpUrl = DEFAULT_UNCLICK_MCP_URL,
  apiKey = "",
  limit = 80,
  fetchImpl = globalThis.fetch,
  now = new Date().toISOString(),
  proofSource = "",
  lastScheduledProofAt = "",
  trustedFallbackSource = "",
  trustedFallbackAt = "",
  trustedFallbackId = "",
  expectedEveryMinutes = 15,
  graceMinutes = 15,
  trustedFallbackFreshMinutes = 10,
} = {}) {
  const gate = evaluateOrchestratorProofWakeGate({
    now,
    source: proofSource,
    lastScheduledProofAt,
    trustedFallbackSource,
    trustedFallbackAt,
    trustedFallbackId,
    expectedEveryMinutes,
    graceMinutes,
    trustedFallbackFreshMinutes,
  });
  if (!gate.allow) {
    return {
      ok: false,
      action: "blocked",
      mode: "orchestrator-proof",
      reason: gate.reason,
      proof_line: `BLOCKER: ${gate.reason}; next: ${gate.next_action}.`,
      orchestrator_proof: {
        ok: false,
        result: "BLOCKER",
        reason: gate.reason,
        proof_source: gate.proof_source,
        wake_gate: gate,
      },
      wake_gate: gate,
    };
  }

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
      wake_gate: gate,
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
    wake_gate: gate,
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

export async function fetchCurrentMainHeadSha({
  repo = "",
  branch = "main",
  githubToken = "",
  fetchImpl = globalThis.fetch,
} = {}) {
  const repoName = String(repo || "").trim();
  const branchName = String(branch || "main").trim() || "main";
  if (!repoName || !repoName.includes("/")) {
    return { ok: false, reason: "missing_github_repository" };
  }
  if (typeof fetchImpl !== "function") {
    return { ok: false, reason: "missing_fetch_impl" };
  }

  const [owner, name] = repoName.split("/", 2).map((part) => encodeURIComponent(part));
  const response = await fetchImpl(
    `https://api.github.com/repos/${owner}/${name}/branches/${encodeURIComponent(branchName)}`,
    {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "unclick-pinballwake-autonomous-runner",
        ...(githubToken ? { authorization: `Bearer ${githubToken}` } : {}),
      },
    },
  );

  if (!response?.ok) {
    return {
      ok: false,
      reason: "github_branch_http_error",
      status: response?.status ?? null,
    };
  }

  const payload = await response.json().catch(() => ({}));
  const sha = String(payload?.commit?.sha || "").trim();
  if (!sha) {
    return { ok: false, reason: "github_branch_missing_sha" };
  }

  return {
    ok: true,
    repo: repoName,
    branch: branchName,
    current_main_sha: sha,
    current_main_committed_at:
      payload?.commit?.commit?.committer?.date ||
      payload?.commit?.commit?.author?.date ||
      payload?.commit?.commit?.committed_at ||
      null,
  };
}

export function assertRunnerOnFreshMain({
  checkedOutSha = "",
  currentMainSha = "",
  currentMainCommittedAt = "",
  now = new Date().toISOString(),
  thresholdMinutes = 20,
} = {}) {
  const checkedOut = String(checkedOutSha || "").trim().toLowerCase();
  const currentMain = String(currentMainSha || "").trim().toLowerCase();
  const threshold = Number.isFinite(Number(thresholdMinutes)) ? Number(thresholdMinutes) : 20;
  const mainCommittedAtMs = Date.parse(String(currentMainCommittedAt || ""));
  const nowMs = Date.parse(String(now || ""));
  const observedLagMinutes =
    Number.isFinite(mainCommittedAtMs) && Number.isFinite(nowMs)
      ? Math.max(0, Math.round((nowMs - mainCommittedAtMs) / 60000))
      : null;

  if (!checkedOut) {
    return {
      ok: true,
      skipped: true,
      reason: "missing_checked_out_sha",
      threshold_minutes: threshold,
    };
  }
  if (!currentMain) {
    return {
      ok: true,
      skipped: true,
      reason: "missing_current_main_sha",
      checked_out_sha: checkedOutSha,
      threshold_minutes: threshold,
    };
  }
  if (checkedOut !== currentMain) {
    return {
      ok: false,
      reason: "stale_runner_main",
      checked_out_sha: checkedOutSha,
      current_main_sha: currentMainSha,
      current_main_committed_at: currentMainCommittedAt || null,
      observed_lag_minutes: observedLagMinutes,
      threshold_minutes: threshold,
    };
  }

  return {
    ok: true,
    reason: "runner_on_current_main",
    checked_out_sha: checkedOutSha,
    current_main_sha: currentMainSha,
    current_main_committed_at: currentMainCommittedAt || null,
    observed_lag_minutes: 0,
    threshold_minutes: threshold,
  };
}

export async function postRunnerMainFreshnessPacket({
  check,
  runner = DEFAULT_AUTONOMOUS_RUNNER,
  mcpUrl = DEFAULT_UNCLICK_MCP_URL,
  apiKey = "",
  fetchImpl = globalThis.fetch,
  repo = "",
  branch = "main",
  wakeSource = "unknown",
} = {}) {
  if (check?.ok) {
    return { ok: true, skipped: true, reason: check.reason || "runner_main_fresh" };
  }
  if (!apiKey) {
    return { ok: true, skipped: true, reason: "missing_unclick_api_key" };
  }

  return callUnClickMcpTool({
    mcpUrl,
    apiKey,
    fetchImpl,
    toolName: "post_message",
    arguments: {
      agent_id: boardroomClaimAgentId(runner),
      recipients: ["all"],
      tags: ["blocker", "fyi"],
      text: compact(
        [
          "BLOCKER stale_runner_main:",
          `repo=${repo || "unknown"}.`,
          `branch=${branch || "main"}.`,
          `wake_source=${wakeSource || "unknown"}.`,
          `checked_out_sha=${check?.checked_out_sha || "unknown"}.`,
          `current_main_sha=${check?.current_main_sha || "unknown"}.`,
          `observed_lag_minutes=${check?.observed_lag_minutes ?? "unknown"}.`,
          `threshold_minutes=${check?.threshold_minutes ?? "unknown"}.`,
          "next=rerun runner on current main or inspect schedule delivery.",
        ].join(" "),
        900,
      ),
    },
  });
}

export async function runAutonomousRunnerMainFreshnessCanary({
  repo = "",
  branch = "main",
  checkedOutSha = "",
  githubToken = "",
  runner = DEFAULT_AUTONOMOUS_RUNNER,
  mcpUrl = DEFAULT_UNCLICK_MCP_URL,
  apiKey = "",
  fetchImpl = globalThis.fetch,
  now = new Date().toISOString(),
  thresholdMinutes = 20,
  wakeSource = "unknown",
} = {}) {
  if (!repo || !checkedOutSha) {
    return {
      ok: true,
      skipped: true,
      reason: !repo ? "missing_github_repository" : "missing_checked_out_sha",
    };
  }

  const current = await fetchCurrentMainHeadSha({ repo, branch, githubToken, fetchImpl });
  if (!current.ok) {
    return {
      ok: true,
      skipped: true,
      reason: "canary_api_failed",
      detail: current.reason,
      status: current.status ?? null,
    };
  }

  const check = assertRunnerOnFreshMain({
    checkedOutSha,
    currentMainSha: current.current_main_sha,
    currentMainCommittedAt: current.current_main_committed_at,
    now,
    thresholdMinutes,
  });
  const packet = await postRunnerMainFreshnessPacket({
    check,
    runner,
    mcpUrl,
    apiKey,
    fetchImpl,
    repo,
    branch,
    wakeSource,
  });

  return {
    ok: true,
    action: check.ok ? "main_freshness_ok" : "stale_main_reported",
    reason: check.reason,
    check,
    packet,
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
  "unassigned_open",
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

  const needsScopingIds = new Set(
    (lastResult.skipped || [])
      .filter((skip) => (
        skip?.reason === "boardroom_todo_missing_scopepack" ||
        skip?.reason === "missing_owned_files"
      ))
      .map((skip) => String(skip.job_id || "").replace(/^boardroom-todo:/, "").trim())
      .filter(Boolean),
  );
  if (needsScopingIds.size === 0) return null;

  return (queueSourceResult.todos || []).find((todo) => (
    needsScopingIds.has(String(todo.id || "").trim()) &&
    BOARDROOM_SCOPING_ACTION_REASONS.has(String(todo.actionability_reason || "").trim())
  )) || null;
}

function buildClaimabilityScorecard({
  seen = 0,
  claimable = 0,
  imported = 0,
  skipped = [],
} = {}) {
  const skipReasons = {};
  for (const skip of skipped || []) {
    const reason = String(skip?.reason || skip?.skip_reason || "unknown").trim() || "unknown";
    skipReasons[reason] = (skipReasons[reason] || 0) + 1;
  }

  const skippedCount = Array.isArray(skipped) ? skipped.length : 0;
  const state = seen <= 0
    ? "empty"
    : claimable > 0
      ? "claimable"
      : "blocked_no_claimable";

  return {
    seen,
    claimable,
    imported,
    skipped: skippedCount,
    skip_reasons: skipReasons,
    state,
    healthy: state !== "blocked_no_claimable",
  };
}

function buildRunClaimabilityScorecard({
  queueSourceResult = {},
  results = [],
  lastResult = {},
  finalAction = lastResult.action || null,
  finalReason = lastResult.reason || null,
  scopingRequested = 0,
  hydrationBlocked = 0,
  hydrationSuppressed = 0,
} = {}) {
  const base = queueSourceResult.claimability_scorecard || buildClaimabilityScorecard({
    seen: queueSourceResult.seen || 0,
    claimable: queueSourceResult.imported || 0,
    imported: queueSourceResult.imported || 0,
    skipped: queueSourceResult.skipped || [],
  });
  const protectedBlocked = results.reduce(
    (sum, result) => sum + (Array.isArray(result?.safety_blocked) ? result.safety_blocked.length : 0),
    0,
  );
  const importedClaimable = Number.isFinite(base.claimable) ? base.claimable : queueSourceResult.imported || 0;

  return {
    ...base,
    imported_claimable: importedClaimable,
    claim_attemptable_after_safety: Math.max(
      0,
      importedClaimable - protectedBlocked - scopingRequested - hydrationBlocked - hydrationSuppressed,
    ),
    scoping_requested: scopingRequested,
    scopepack_hydration_blocked: hydrationBlocked,
    scopepack_hydration_suppressed: hydrationSuppressed,
    protected_blocked: protectedBlocked,
    claimed: results.filter((result) => result?.action === "claimed").length,
    last_action: finalAction,
    last_reason: finalReason,
    final_action: finalAction,
    final_reason: finalReason,
  };
}

function claimabilityEvidence(scorecard = {}) {
  return [
    { kind: "queue", ref: `seen=${scorecard.seen ?? 0}` },
    { kind: "queue", ref: `claimable=${scorecard.claimable ?? 0}` },
    { kind: "queue", ref: `imported=${scorecard.imported ?? 0}` },
    { kind: "queue", ref: `state=${scorecard.state || "unknown"}` },
    { kind: "runner", ref: `final_action=${scorecard.final_action || "unknown"}` },
    { kind: "runner", ref: `final_reason=${scorecard.final_reason || "unknown"}` },
  ];
}

const QUIET_WINDOW_AUTONOMY_RUNGS = [
  {
    id: "tick",
    aliases: ["tick", "heartbeat_tick", "scheduled_tick", "scheduled_heartbeat_tick"],
  },
  {
    id: "buildbait_crumb",
    aliases: ["buildbait", "buildbait_crumb", "crumb", "job_crumb"],
  },
  {
    id: "claim_or_lease",
    aliases: ["claim", "claimed", "lease", "lease_claimed", "claim_or_lease"],
  },
  {
    id: "execution_packet",
    aliases: ["execution", "execution_packet", "execute_packet"],
  },
  {
    id: "build_attempt_or_commonsense_blocker",
    aliases: [
      "build_attempt_or_commonsense_blocker",
      "build_attempt",
      "build_result",
      "commonsensepass_blocker",
      "explicit_commonsensepass_blocker",
      "commonsense_blocker",
    ],
  },
  {
    id: "proof_packet",
    aliases: ["proof", "proof_packet", "proof_submitted"],
  },
  {
    id: "terminal_receipt",
    aliases: ["terminal", "terminal_receipt", "terminal_state", "done", "blocked", "hold"],
  },
];

const QUIET_WINDOW_BLOCKER_RUNGS = new Set([
  "build_attempt_or_commonsense_blocker",
  "proof_packet",
  "terminal_receipt",
]);

const NOT_CLEAN_AUTONOMY_SOURCES = new Set([
  "manual",
  "manual_chat",
  "operator_chat",
  "user_chat",
  "human_chat",
  "chat",
  "workflow_dispatch",
]);

function normalizeQuietWindowToken(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function quietWindowEventTokens(event = {}) {
  const values = typeof event === "string"
    ? [event]
    : [
        event.rung,
        event.kind,
        event.type,
        event.name,
        event.event,
        event.action,
        event.status,
        event.result,
        event.reason,
        event.receipt_kind,
        event.source,
        event.source_type,
        event.trigger_source,
      ];

  return new Set(values.map(normalizeQuietWindowToken).filter(Boolean));
}

function quietWindowEventTimeMs(event = {}) {
  if (typeof event === "string") return null;
  const raw = event.at || event.time || event.timestamp || event.created_at || event.createdAt;
  const ms = Date.parse(String(raw || ""));
  return Number.isFinite(ms) ? ms : null;
}

function eventFallsInsideWindow(event, windowStartMs, windowEndMs) {
  const eventMs = quietWindowEventTimeMs(event);
  if (!Number.isFinite(eventMs)) return true;
  if (Number.isFinite(windowStartMs) && eventMs < windowStartMs) return false;
  if (Number.isFinite(windowEndMs) && eventMs > windowEndMs) return false;
  return true;
}

function hasNotCleanAutonomyToken(tokens) {
  return [...tokens].some((token) =>
    NOT_CLEAN_AUTONOMY_SOURCES.has(token) ||
    token.includes("manual") ||
    token.includes("operator_chat") ||
    token.includes("human_chat") ||
    token.includes("user_chat")
  );
}

function hasQuietWindowRung(events, aliases) {
  const normalizedAliases = new Set(aliases.map(normalizeQuietWindowToken));
  return events.some((event) => {
    const tokens = quietWindowEventTokens(event);
    return [...normalizedAliases].some((alias) => tokens.has(alias));
  });
}

function buildQuietWindowAutonomyResult({
  verdict,
  reason,
  reasonCode,
  firstMissingRung = null,
  evidence,
  nextAction,
}) {
  return {
    ok: verdict === "PASS",
    verdict,
    reason,
    reason_code: reasonCode,
    first_missing_rung: firstMissingRung,
    evidence,
    next_action: nextAction,
  };
}

function numberOption(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function createQuietWindowAutonomyProofReceipt({
  now = new Date().toISOString(),
  wakeSource = "unknown",
  queueSourceResult = {},
  results = [],
  finalAction = "",
  finalReason = "",
  commonsensepass = {},
  executorPacketSync = {},
} = {}) {
  const triggerSource = normalizeQuietWindowToken(wakeSource || "unknown");
  const imported = numberOption(queueSourceResult.imported, 0);
  const seen = numberOption(
    queueSourceResult.seen,
    numberOption(queueSourceResult.claimability_scorecard?.seen, 0),
  );
  const claimedResult = results.find((result) => result?.action === "claimed" && result.job);
  const blockedResult = results.find((result) => Array.isArray(result?.safety_blocked) && result.safety_blocked.length > 0);
  const events = [];

  if (triggerSource) {
    events.push({
      rung: "heartbeat_tick",
      at: now,
      trigger_source: triggerSource,
      source: triggerSource,
    });
  }

  if (imported > 0 || seen > 0) {
    events.push({
      rung: "job_crumb",
      at: now,
      source: queueSourceResult.source || "queue",
      result: imported > 0 ? `imported=${imported}` : `visible=${seen}`,
    });
  }

  if (claimedResult) {
    events.push({
      rung: "lease_claimed",
      at: now,
      job_id: claimedResult.job.job_id || null,
      claim_id: claimedResult.job.lease_token || claimedResult.job.claimed_by || null,
    });
  }

  if (executorPacketSync?.packet || executorPacketSync?.action === "execution_packet") {
    events.push({
      rung: "execution_packet",
      at: now,
      packet_id: executorPacketSync.packet?.packet_id || null,
      receipt_type: executorPacketSync.receipt?.receipt_type || null,
    });
  }

  if (blockedResult || commonsensepass.verdict !== "PASS") {
    events.push({
      rung: "commonsensepass_blocker",
      at: now,
      reason: blockedResult?.reason || commonsensepass.reason_code || finalReason || "runner_blocked",
    });
  }

  if (executorPacketSync?.action === "executor_packet_hold") {
    events.push({
      rung: "commonsensepass_blocker",
      at: now,
      reason: executorPacketSync.receipt?.hold_reason || executorPacketSync.reason || "executor_packet_hold",
    });
  }

  return evaluateQuietWindowAutonomyProofLadder({
    window_start: now,
    window_end: now,
    trigger_source: triggerSource || "unknown",
    job_id: claimedResult?.job?.job_id || null,
    claim_id: claimedResult?.job?.lease_token || claimedResult?.job?.claimed_by || null,
    run_id: `autonomous-runner:${now}`,
    events,
    final_action: finalAction || null,
    final_reason: finalReason || null,
  });
}

export function evaluateQuietWindowAutonomyProofLadder(input = {}) {
  const events = Array.isArray(input.events) ? input.events : [];
  const windowStart = input.window_start || input.windowStart || input.window?.start || input.window?.window_start || "";
  const windowEnd = input.window_end || input.windowEnd || input.window?.end || input.window?.window_end || "";
  const windowStartMs = Date.parse(String(windowStart || ""));
  const windowEndMs = Date.parse(String(windowEnd || ""));
  const triggerSource = normalizeQuietWindowToken(
    input.trigger_source || input.triggerSource || input.source || input.event_source || "",
  );
  const observedRungs = QUIET_WINDOW_AUTONOMY_RUNGS
    .filter((rung) => hasQuietWindowRung(events, rung.aliases))
    .map((rung) => rung.id);
  const evidence = {
    window_start: windowStart || null,
    window_end: windowEnd || null,
    trigger_source: triggerSource || null,
    job_id: input.job_id || input.jobId || null,
    claim_id: input.claim_id || input.claimId || null,
    run_id: input.run_id || input.runId || null,
    observed_rungs: observedRungs,
  };

  if (!windowStart || !Number.isFinite(windowStartMs)) {
    return buildQuietWindowAutonomyResult({
      verdict: "HOLD",
      reason: "quiet_window_missing_start",
      reasonCode: "quiet_window_missing_start",
      firstMissingRung: "window_start",
      evidence,
      nextAction: "record_window_start",
    });
  }

  if (!windowEnd || !Number.isFinite(windowEndMs)) {
    return buildQuietWindowAutonomyResult({
      verdict: "HOLD",
      reason: "quiet_window_missing_end",
      reasonCode: "quiet_window_missing_end",
      firstMissingRung: "window_end",
      evidence,
      nextAction: "record_window_end",
    });
  }

  if (hasNotCleanAutonomyToken(new Set([triggerSource]))) {
    return buildQuietWindowAutonomyResult({
      verdict: "HOLD",
      reason: "not_clean_autonomy_proof",
      reasonCode: "not_clean_autonomy_proof",
      firstMissingRung: "scheduled_trigger",
      evidence,
      nextAction: "wait_for_scheduled_unclick_heartbeat_window",
    });
  }

  const notCleanEvent = events.find((event) =>
    eventFallsInsideWindow(event, windowStartMs, windowEndMs) &&
    hasNotCleanAutonomyToken(quietWindowEventTokens(event))
  );
  if (notCleanEvent) {
    return buildQuietWindowAutonomyResult({
      verdict: "HOLD",
      reason: "not_clean_autonomy_proof",
      reasonCode: "not_clean_autonomy_proof",
      firstMissingRung: "no_human_operator_chat_trigger",
      evidence,
      nextAction: "restart_window_after_human_or_operator_activity",
    });
  }

  for (const rung of QUIET_WINDOW_AUTONOMY_RUNGS) {
    if (observedRungs.includes(rung.id)) continue;
    const verdict = QUIET_WINDOW_BLOCKER_RUNGS.has(rung.id) ? "BLOCKER" : "HOLD";
    return buildQuietWindowAutonomyResult({
      verdict,
      reason: `quiet_window_missing_${rung.id}`,
      reasonCode: `quiet_window_missing_${rung.id}`,
      firstMissingRung: rung.id,
      evidence,
      nextAction: `record_${rung.id}`,
    });
  }

  return buildQuietWindowAutonomyResult({
    verdict: "PASS",
    reason: "quiet_window_autonomy_proof_complete",
    reasonCode: "quiet_window_autonomy_proof_complete",
    evidence,
    nextAction: "submit_terminal_proof_receipt",
  });
}

export function evaluateAutonomousRunnerCommonSensePass({
  queueSourceResult = {},
  claimabilityScorecard = {},
  finalAction = claimabilityScorecard.final_action || null,
  finalReason = claimabilityScorecard.final_reason || null,
} = {}) {
  if (queueSourceResult.source !== "unclick") {
    return {
      verdict: "PASS",
      rule_id: null,
      reason: "CommonSensePass guard skipped for non-UnClick queue source.",
      evidence: claimabilityEvidence(claimabilityScorecard),
    };
  }

  const trustedNoWorkClaim = finalAction === "idle" && finalReason === "no_claimable_jobs";
  if (!trustedNoWorkClaim) {
    return {
      verdict: "PASS",
      rule_id: "R1",
      reason: "Runner did not emit a trusted no-work claim.",
      evidence: claimabilityEvidence(claimabilityScorecard),
    };
  }

  if (claimabilityScorecard.state === "queue_unavailable") {
    return {
      verdict: "HOLD",
      rule_id: "R1",
      reason: "CommonSensePass HOLD: UnClick queue evidence is unavailable, so no-work cannot be trusted.",
      reason_code: "commonsensepass_queue_unavailable",
      evidence: claimabilityEvidence(claimabilityScorecard),
      next_action: "restore_queue_source_or_read_jobs_room",
    };
  }

  const seen = Number.isFinite(claimabilityScorecard.seen) ? claimabilityScorecard.seen : 0;
  const claimed = Number.isFinite(claimabilityScorecard.claimed) ? claimabilityScorecard.claimed : 0;
  const attemptable = Number.isFinite(claimabilityScorecard.claim_attemptable_after_safety)
    ? claimabilityScorecard.claim_attemptable_after_safety
    : Number.POSITIVE_INFINITY;

  if (
    seen > 0 &&
    claimed === 0 &&
    (
      claimabilityScorecard.healthy === false ||
      claimabilityScorecard.state === "blocked_no_claimable" ||
      attemptable === 0
    )
  ) {
    return {
      verdict: "BLOCKER",
      rule_id: "R1",
      reason: `CommonSensePass BLOCKER: ${seen} UnClick job(s) were visible but none were claimable, so no-work cannot be trusted.`,
      reason_code: "commonsensepass_no_work_blocked_by_visible_queue",
      evidence: claimabilityEvidence(claimabilityScorecard),
      next_action: "hydrate_scopepack_or_route_exact_blocker",
    };
  }

  return {
    verdict: "PASS",
    rule_id: "R1",
    reason: "No-work claim consistent with UnClick queue evidence.",
    evidence: claimabilityEvidence(claimabilityScorecard),
  };
}

export async function syncBoardroomTodoScopingRequestToUnClick({
  todo,
  runner = DEFAULT_AUTONOMOUS_RUNNER,
  mcpUrl = DEFAULT_UNCLICK_MCP_URL,
  apiKey = "",
  fetchImpl = globalThis.fetch,
  testOnlyExecutorPacket = null,
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

  const hydration = buildScopePackHydrationReceipt(todo);
  if (hydration.action === "suppress") {
    return {
      ok: true,
      todo_id: todoId,
      status: "open",
      assigned_to_agent_id: null,
      comment_ok: false,
      comment_suppressed: true,
      comment_detail: hydration.reason,
      scopepack_hydration: hydration,
    };
  }

  let testOnlyExecutorPacketResult = null;
  if (hydration.action === "scopepack_hydrated" && testOnlyExecutorPacket?.enabled) {
    testOnlyExecutorPacketResult = await createAutonomousRunnerTestOnlyExecutorReceipt({
      todo,
      scopePack: hydration.scopepack,
      heartbeat: testOnlyExecutorPacket.heartbeat,
      heartbeatTickId: testOnlyExecutorPacket.heartbeatTickId,
      headShaAtRequest: testOnlyExecutorPacket.headShaAtRequest,
      requestingSeatId: testOnlyExecutorPacket.requestingSeatId,
      scopePackCommentId: testOnlyExecutorPacket.scopePackCommentId,
      fileExists: testOnlyExecutorPacket.fileExists,
      executorSeatId: testOnlyExecutorPacket.executorSeatId,
      now: testOnlyExecutorPacket.now,
    });
  }

  const commentText = [
    hydration.receipt || compact(
      [
        "Autonomous Runner could not safely build this job yet because no file-level ScopePack was attached.",
        "Reopened for scoping instead of holding a stale active claim.",
        "Next: attach exact owned files, proof/tests, and stop conditions, or split this into a smaller job.",
        `reason=${todo.actionability_reason || "missing_scopepack"}.`,
      ].join(" "),
      700,
    ),
    formatTestOnlyExecutorPacketReceipt(testOnlyExecutorPacketResult),
  ].filter(Boolean).join(" ");

  const comment = await callUnClickMcpTool({
    mcpUrl,
    apiKey,
    fetchImpl,
    toolName: "comment_on",
    arguments: {
      agent_id: agentId,
      target_kind: "todo",
      target_id: todoId,
      text: commentText,
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
    scopepack_hydration: hydration.action === "needs_manual_scoping" ? null : hydration,
    test_only_executor_packet: testOnlyExecutorPacketResult,
  };
}

function scopePackCommentIdFromTodo(todo = {}) {
  const comments = Array.isArray(todo.recent_comments)
    ? todo.recent_comments
    : Array.isArray(todo.comments)
      ? todo.comments
      : [];

  const found = comments.find((comment) => /scope\s*pack|scopepack/i.test(`${comment?.body || ""}\n${comment?.text || ""}`));
  return String(
    found?.id ||
      found?.comment_id ||
      todo.scope_pack_comment_id ||
      todo.scopePackCommentId ||
      "",
  ).trim();
}

function formatTestOnlyExecutorPacketReceipt(result) {
  if (!result) return "";
  const packet = result.packet || {};
  const receipt = result.receipt || {};
  const parts = [
    `executor_packet=${receipt.receipt_type || "executor_packet_hold"}.`,
    `intent=${packet.intent || "test_only"}.`,
    `packet_id=${packet.packet_id || receipt.packet_id || "none"}.`,
  ];
  if (receipt.hold_reason) parts.push(`hold_reason=${receipt.hold_reason}.`);
  parts.push("execute_enabled=false.");
  return compact(parts.join(" "), 700);
}

function buildAutonomousRunnerHeartbeatTickId({ wakeSource = "unknown", now = new Date().toISOString() } = {}) {
  const source = normalizeQuietWindowToken(wakeSource || "unknown") || "unknown";
  const parsed = Date.parse(String(now || ""));
  const time = Number.isFinite(parsed) ? new Date(parsed).toISOString() : String(now || "unknown-time").trim();
  return `autonomous-runner:${source}:${time}`;
}

function resolveExecutorPacketHeadSha({ checkedOutSha = "", mainFreshnessCanary = {} } = {}) {
  const check = mainFreshnessCanary?.check || {};
  if (check && check.ok === false) {
    return { ok: false, reason: "stale_runner_main", head_sha_at_request: "" };
  }

  const head = String(
    checkedOutSha ||
      check.checked_out_sha ||
      check.current_main_sha ||
      mainFreshnessCanary?.current_main_sha ||
      "",
  ).trim();
  if (!head) {
    return { ok: false, reason: "missing_checked_out_sha", head_sha_at_request: "" };
  }

  return { ok: true, reason: "head_sha_ready", head_sha_at_request: head };
}

function createAutonomousRunnerFileExists({ worktreeCwd = process.cwd() } = {}) {
  const base = resolve(worktreeCwd || process.cwd());
  return async (file) => {
    const raw = String(file || "").trim();
    if (!raw) return false;
    const target = resolve(base, raw);
    const relativeTarget = relative(base, target);
    if (!relativeTarget || relativeTarget.startsWith("..") || isAbsolute(relativeTarget)) {
      return false;
    }

    try {
      await access(target);
      return true;
    } catch {
      return false;
    }
  };
}

function buildExecutorPacketCommentText({ emission = {} } = {}) {
  const packet = emission.packet || {};
  const receipt = emission.receipt || {};
  const verb = receipt.receipt_type === "executor_packet_hold" || emission.action === "executor_packet_hold"
    ? "HOLD"
    : "PASS";
  const testCommand = compact(packet.acceptance?.test_command || "none", 220);
  const reason = compact(receipt.hold_reason || emission.reason || "test_only_executor_packet_pass", 220);
  return compact(
    [
      `${verb}: execution_packet.`,
      `packet_id=${packet.packet_id || "none"}.`,
      `receipt_type=${receipt.receipt_type || "none"}.`,
      `intent=${packet.intent || "test_only"}.`,
      `todo_id=${packet.todo_id || emission.todo_id || "unknown"}.`,
      `head_sha_at_request=${packet.head_sha_at_request || "unknown"}.`,
      `owned_files=${(packet.owned_files || []).join(" | ") || "none"}.`,
      `test_command=${testCommand}.`,
      `reason=${reason}.`,
      `next=${receipt.next_action || emission.next_action || "reviewer_safety_pass"}.`,
    ].join(" "),
    1600,
  );
}

export async function syncAutonomousRunnerExecutorPacketToUnClick({
  todo,
  runner = DEFAULT_AUTONOMOUS_RUNNER,
  mcpUrl = DEFAULT_UNCLICK_MCP_URL,
  apiKey = "",
  fetchImpl = globalThis.fetch,
  now = new Date().toISOString(),
  wakeSource = "unknown",
  checkedOutSha = "",
  mainFreshnessCanary = {},
  fileExists,
  executorSeatId = "pinballwake-build-executor",
  worktreeCwd = process.cwd(),
} = {}) {
  const todoId = String(todo?.id || todo?.todo_id || "").trim();
  if (!todoId) {
    return { ok: true, skipped: true, reason: "missing_todo_id" };
  }

  const head = resolveExecutorPacketHeadSha({ checkedOutSha, mainFreshnessCanary });
  if (!head.ok) {
    return { ok: true, skipped: true, reason: head.reason, todo_id: todoId };
  }

  const hydration = buildScopePackHydrationReceipt(todo, { headSha: head.head_sha_at_request });
  if (hydration.action === "needs_manual_scoping") {
    return { ok: true, skipped: true, reason: "no_hydratable_scopepack", todo_id: todoId };
  }

  const heartbeat = {
    tickId: buildAutonomousRunnerHeartbeatTickId({ wakeSource, now }),
    emittedAt: now,
  };
  const packetResult = hydration.action === "blocker"
    ? {
        ok: false,
        reason: hydration.reason,
        packet: null,
        receipt: {
          receipt_type: "executor_packet_hold",
          emitted_at: now,
          packet_id: null,
          hold_reason: hydration.reason,
          evidence: { missing_fields: hydration.missing_fields || [] },
          next_action: "rescope_owned_files",
          sanitized: true,
        },
      }
    : await createAutonomousRunnerTestOnlyExecutorReceipt({
        todo,
        scopePack: hydration.scopepack || extractBoardroomTodoScopePackObject(todo) || {},
        heartbeat,
        heartbeatTickId: heartbeat.tickId,
        headShaAtRequest: head.head_sha_at_request,
        requestingSeatId: boardroomClaimAgentId(runner),
        scopePackCommentId: scopePackCommentIdFromTodo(todo),
        fileExists: fileExists || createAutonomousRunnerFileExists({ worktreeCwd }),
        executorSeatId,
        now,
      });

  const receipt = packetResult.receipt || {};
  const action = receipt.receipt_type === "executor_packet_hold" || !packetResult.ok
    ? "executor_packet_hold"
    : "execution_packet";
  const emission = {
    ok: true,
    action,
    reason: action === "execution_packet"
      ? "test_only_executor_packet_pass"
      : receipt.hold_reason || packetResult.reason || "executor_packet_hold",
    todo_id: todoId,
    heartbeat,
    packet: packetResult.packet || null,
    receipt,
    scopepack_hydration: hydration,
    next_action: receipt.next_action || "reviewer_safety_pass",
    packet_result_ok: Boolean(packetResult.ok),
  };

  if (emission.skipped) {
    return emission;
  }

  const comment = await callUnClickMcpTool({
    mcpUrl,
    apiKey,
    fetchImpl,
    toolName: "comment_on",
    arguments: {
      agent_id: boardroomClaimAgentId(runner),
      target_kind: "todo",
      target_id: emission.todo_id,
      text: buildExecutorPacketCommentText({ emission }),
    },
  });

  return {
    ...emission,
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
    context: `${contextParts.join("; ")}. Imported for autonomous claim/routing; claim only when a ScopePack names owned files, verification, and stop conditions.`,
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
    runner = DEFAULT_AUTONOMOUS_RUNNER,
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
  const runnerAgentId = autonomousRunnerAgentId(runner);
  const assignedToRunner = Boolean(assignedTo && runnerAgentId && assignedTo === runnerAgentId);
  if (assignedTo && !assignedToRunner) {
    return { ok: false, reason: "boardroom_todo_already_assigned", assigned_to_agent_id: assignedTo };
  }

  const actionReason = normalizeToken(todo.actionability_reason || "");
  const safeActionReasons = tokenSet(allowedActionReasons, DEFAULT_AUTONOMOUS_RUNNER_POLICY.allowedActionReasons);
  const selfAssignedActionReason =
    assignedToRunner && (actionReason === "role_assigned_open" || actionReason === "assigned_open");
  if (actionReason && safeActionReasons.size > 0 && !safeActionReasons.has(actionReason) && !selfAssignedActionReason) {
    return { ok: false, reason: "boardroom_todo_action_reason_not_allowed", actionability_reason: actionReason };
  }

  const title = String(todo.title || "");
  const description = String(todo.description || todo.body || todo.notes || "");
  if (
    HOLD_TITLE_PATTERN.test(title) ||
    HOLD_TITLE_MARKER_PATTERN.test(title) ||
    HOLD_BODY_MARKER_PATTERN.test(description)
  ) {
    return { ok: false, reason: "boardroom_todo_hold_or_blocker_marker" };
  }

  if (hasRecentTodoBlockerMarker(todo)) {
    return { ok: false, reason: "boardroom_todo_recent_blocker_comment" };
  }

  const safeRoles = tokenSet(allowedTodoRoles, DEFAULT_AUTONOMOUS_RUNNER_POLICY.allowedTodoRoles);
  const roleTokens = listTodoRoleTokens(todo, scopePack);
  const hasBuilderCompatibleOwnerHint = ownerHintAllowsBuilderCompatibleRunner(todo, scopePack);
  const hasBuilderCompatibleOrchestratorHint =
    roleTokens.includes("orchestrator") && ownerHintAllowsBuilderCompatibleOrchestrator(todo, scopePack);
  if (
    !assignedToRunner &&
    isWatcherOrTetherRunner(runner) &&
    scopePackLooksBuilderAssigned({ roleTokens, hasBuilderCompatibleOwnerHint })
  ) {
    return { ok: false, reason: "watcher_tether_builder_lane_not_assigned", role: roleTokens[0] || null };
  }
  const hasAllowedRole =
    roleTokens.length === 0 ||
    roleTokens.some((role) => safeRoles.has(role)) ||
    hasBuilderCompatibleOwnerHint ||
    hasBuilderCompatibleOrchestratorHint;
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
      claimability_scorecard: {
        ...buildClaimabilityScorecard(),
        state: "queue_unavailable",
        healthy: false,
      },
    };
  }

  const ordered = [...fetched.todos].sort((a, b) =>
    priorityWeight(b.priority) - priorityWeight(a.priority) ||
    String(a.created_at || "").localeCompare(String(b.created_at || "")),
  );

  let next = createCodingRoomJobLedger({ jobs: ledger?.jobs || [], updatedAt: ledger?.updated_at || now });
  let imported = 0;
  let claimable = 0;
  const skipped = [];
  for (const todo of ordered) {
    const scopePack = extractBoardroomTodoScopePack(todo);
    const eligibility = evaluateBoardroomTodoAutoClaimEligibility(todo, {
      scopePack,
      allowedPriorities,
      allowedActionReasons,
      allowedTodoRoles,
      allowProtectedSurfaces,
      runner,
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
        scope_pack_seen: Boolean(scopePack.hasScopePack),
        lane: todo.lane || scopePack.lane || null,
        owner_hint: todo.owner_hint || todo.ownerHint || scopePack.owner_hint || null,
        claim_allowed: false,
        skip_reason: eligibility.reason,
        reason: eligibility.reason,
        file: eligibility.file || null,
      });
      continue;
    }

    claimable += 1;
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
    claimability_scorecard: buildClaimabilityScorecard({
      seen: ordered.length,
      claimable,
      imported,
      skipped,
    }),
    todos: ordered.map((todo) => {
      const scopePack = extractBoardroomTodoScopePack(todo);
      return {
        id: todo.id,
        title: compact(todo.title, 140),
        priority: todo.priority || null,
        status: todo.status || null,
        assigned_to_agent_id: todo.assigned_to_agent_id || null,
        actionability_reason: todo.actionability_reason || null,
        scope_pack_seen: Boolean(scopePack.hasScopePack),
        scope_pack: todo.scope_pack ?? todo.scopePack ?? null,
        runner_scope: todo.runner_scope ?? todo.runnerScope ?? null,
        recent_comments: Array.isArray(todo.recent_comments) ? todo.recent_comments : undefined,
        comments: Array.isArray(todo.comments) ? todo.comments : undefined,
        latest_comment_text: todo.latest_comment_text || null,
        last_comment_text: todo.last_comment_text || null,
        description: todo.description || null,
        body: todo.body || null,
        notes: todo.notes || null,
        lane: todo.lane || scopePack.lane || null,
        owner_hint: todo.owner_hint || todo.ownerHint || scopePack.owner_hint || null,
      };
    }),
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
  orchestratorProofSource = "",
  lastScheduledProofAt = "",
  trustedFallbackSource = "",
  trustedFallbackAt = "",
  trustedFallbackId = "",
  proofExpectedEveryMinutes = 15,
  proofGraceMinutes = 15,
  trustedFallbackFreshMinutes = 10,
  githubRepository = "",
  githubBranch = "main",
  checkedOutSha = "",
  githubToken = "",
  mainFreshnessThresholdMinutes = 20,
  gitHygienePreflight = false,
  gitStatusImpl = readAutonomousRunnerGitStatus,
  worktreeCwd = process.cwd(),
  gitHygieneIgnoredPaths = [],
  executorPacketFileExists,
} = {}) {
  if (orchestratorProof) {
    return runOrchestratorSeatHandshakeProof({
      mcpUrl: unclickMcpUrl,
      apiKey: unclickApiKey,
      limit: todoLimit,
      fetchImpl,
      now,
      proofSource: orchestratorProofSource,
      lastScheduledProofAt,
      trustedFallbackSource,
      trustedFallbackAt,
      trustedFallbackId,
      expectedEveryMinutes: proofExpectedEveryMinutes,
      graceMinutes: proofGraceMinutes,
      trustedFallbackFreshMinutes,
    });
  }

  const mainFreshnessCanary = await runAutonomousRunnerMainFreshnessCanary({
    repo: githubRepository,
    branch: githubBranch,
    checkedOutSha,
    githubToken,
    runner,
    mcpUrl: unclickMcpUrl,
    apiKey: unclickApiKey,
    fetchImpl,
    now,
    thresholdMinutes: mainFreshnessThresholdMinutes,
    wakeSource,
  });

  if (!ledgerPath) {
    return { ok: false, reason: "missing_ledger_path", main_freshness_canary: mainFreshnessCanary };
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

  let gitHygiene = { ok: true, skipped: true, reason: "git_hygiene_preflight_disabled" };
  if (gitHygienePreflight && safeMode !== "dry-run") {
    gitHygiene = await evaluateAutonomousRunnerGitHygiene({
      cwd: worktreeCwd,
      gitStatusImpl,
      ignoredPaths: [
        ...buildAutonomousRunnerGitHygieneIgnoredPaths({ ledgerPath }),
        ...gitHygieneIgnoredPaths,
      ],
    });
    if (!gitHygiene.ok) {
      return {
        ok: false,
        action: "blocked",
        reason: gitHygiene.reason,
        mode: safeMode,
        dry_run: false,
        persisted: false,
        cycles: [],
        ledger,
        ledger_path: ledgerPath,
        queue_source: queueSourceResult,
        git_hygiene: gitHygiene,
        main_freshness_canary: mainFreshnessCanary,
      };
    }
  }

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
        claimability_scorecard: queueSourceResult.claimability_scorecard,
        main_freshness_canary: mainFreshnessCanary,
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
  let executorPacketSync = { ok: true, skipped: true, reason: "sync_not_applicable" };
  const todoForScoping = selectBoardroomTodoForScoping({ queueSourceResult, lastResult: last });
  let finalAction = todoForScoping && shouldPersist ? "scoping_requested" : last.action;
  let finalReason = todoForScoping && shouldPersist ? "boardroom_todo_reopened_for_scoping" : last.reason;
  let claimabilityScorecard = buildRunClaimabilityScorecard({
    queueSourceResult,
    results,
    lastResult: last,
    finalAction,
    finalReason,
    scopingRequested: todoForScoping && shouldPersist ? 1 : 0,
  });

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
        claimability_scorecard: claimabilityScorecard,
        todo_claim_sync: todoClaimSync,
        main_freshness_canary: mainFreshnessCanary,
      };
    }

    const claimedTodoId = extractBoardroomTodoIdFromCodingRoomJob(last.job);
    const todoForExecutorPacket = (queueSourceResult.todos || []).find((todo) =>
      String(todo.id || todo.todo_id || "").trim() === claimedTodoId
    );
    if (todoForExecutorPacket) {
      executorPacketSync = await syncAutonomousRunnerExecutorPacketToUnClick({
        todo: todoForExecutorPacket,
        runner,
        apiKey: unclickApiKey,
        mcpUrl: unclickMcpUrl,
        fetchImpl,
        now,
        wakeSource,
        checkedOutSha,
        mainFreshnessCanary,
        fileExists: executorPacketFileExists,
        worktreeCwd,
      });

      if (!executorPacketSync.skipped) {
        finalAction = executorPacketSync.action || finalAction;
        finalReason = executorPacketSync.reason || finalReason;
        claimabilityScorecard = buildRunClaimabilityScorecard({
          queueSourceResult,
          results,
          lastResult: last,
          finalAction,
          finalReason,
        });
      }
    }
  }

  if (shouldPersist && todoForScoping) {
    const executorHeartbeatTickId = trustedFallbackId || `${wakeSource || "unknown"}:${now}`;
    todoScopingSync = await syncBoardroomTodoScopingRequestToUnClick({
      todo: todoForScoping,
      runner,
      apiKey: unclickApiKey,
      mcpUrl: unclickMcpUrl,
      fetchImpl,
      testOnlyExecutorPacket: {
        enabled: true,
        heartbeat: { tickId: executorHeartbeatTickId, emittedAt: now },
        heartbeatTickId: executorHeartbeatTickId,
        headShaAtRequest:
          checkedOutSha ||
          mainFreshnessCanary?.check?.current_main_sha ||
          mainFreshnessCanary?.check?.currentMainSha ||
          "unknown-head-sha",
        now,
      },
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
        claimability_scorecard: claimabilityScorecard,
        todo_claim_sync: todoClaimSync,
        todo_scoping_sync: todoScopingSync,
        main_freshness_canary: mainFreshnessCanary,
      };
    }

    const hydrationAction = todoScopingSync.scopepack_hydration?.action || "";
    if (hydrationAction === "scopepack_hydrated") {
      finalAction = "scopepack_hydrated";
      finalReason = "boardroom_todo_scopepack_hydrated";
    } else if (hydrationAction === "blocker") {
      finalAction = "blocked";
      finalReason = todoScopingSync.scopepack_hydration?.reason || "scopepack_hydration_missing_fields";
    } else if (hydrationAction === "suppress") {
      finalAction = "suppressed";
      finalReason = todoScopingSync.scopepack_hydration?.reason || "duplicate_scopepack_hydration_receipt";
    }
    claimabilityScorecard = buildRunClaimabilityScorecard({
      queueSourceResult,
      results,
      lastResult: last,
      finalAction,
      finalReason,
      scopingRequested: hydrationAction ? 0 : 1,
      hydrationBlocked: hydrationAction === "blocker" ? 1 : 0,
      hydrationSuppressed: hydrationAction === "suppress" ? 1 : 0,
    });
  }

  const commonsensepass = evaluateAutonomousRunnerCommonSensePass({
    queueSourceResult,
    claimabilityScorecard,
    finalAction,
    finalReason,
  });
  if (commonsensepass.verdict !== "PASS") {
    finalAction = "blocked";
    finalReason = commonsensepass.reason_code || "commonsensepass_blocked";
    claimabilityScorecard = {
      ...claimabilityScorecard,
      final_action: finalAction,
      final_reason: finalReason,
      commonsensepass_verdict: commonsensepass.verdict,
      commonsensepass_rule_id: commonsensepass.rule_id,
    };
  }

  const quietWindowAutonomyProof = createQuietWindowAutonomyProofReceipt({
    now,
    wakeSource,
    queueSourceResult,
    results,
    finalAction,
    finalReason,
    commonsensepass,
    executorPacketSync,
  });
  claimabilityScorecard = {
    ...claimabilityScorecard,
    quiet_window_autonomy_verdict: quietWindowAutonomyProof.verdict,
    quiet_window_first_missing_rung: quietWindowAutonomyProof.first_missing_rung,
    quiet_window_reason_code: quietWindowAutonomyProof.reason_code,
  };

  if (shouldPersist) {
    await writeCodingRoomJobLedger(ledgerPath, ledger);
  }

  return {
    ...last,
    ok:
      commonsensepass.verdict === "PASS" &&
      results.every((result) => result.ok) &&
      todoClaimSync.ok &&
      todoScopingSync.ok &&
      executorPacketSync.ok,
    action: finalAction,
    reason: finalReason,
    mode: safeMode,
    dry_run: safeMode === "dry-run",
    persisted: shouldPersist,
    cycles: results,
    ledger,
    ledger_path: ledgerPath,
    queue_source: queueSourceResult,
    claimability_scorecard: claimabilityScorecard,
    commonsensepass,
    quiet_window_autonomy_proof: quietWindowAutonomyProof,
    todo_claim_sync: todoClaimSync,
    todo_scoping_sync: todoScopingSync,
    executor_packet_sync: executorPacketSync,
    git_hygiene: gitHygiene,
    main_freshness_canary: mainFreshnessCanary,
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
    orchestratorProofSource: getArg(
      "orchestrator-proof-source",
      process.env.AUTONOMOUS_RUNNER_ORCHESTRATOR_PROOF_SOURCE || process.env.GITHUB_EVENT_NAME || "",
    ),
    lastScheduledProofAt: getArg(
      "last-scheduled-proof-at",
      process.env.AUTONOMOUS_RUNNER_LAST_SCHEDULED_PROOF_AT || "",
    ),
    trustedFallbackSource: getArg(
      "trusted-fallback-source",
      process.env.AUTONOMOUS_RUNNER_TRUSTED_FALLBACK_SOURCE || "",
    ),
    trustedFallbackAt: getArg(
      "trusted-fallback-at",
      process.env.AUTONOMOUS_RUNNER_TRUSTED_FALLBACK_AT || "",
    ),
    trustedFallbackId: getArg(
      "trusted-fallback-id",
      process.env.AUTONOMOUS_RUNNER_TRUSTED_FALLBACK_ID || "",
    ),
    proofExpectedEveryMinutes: parseIntOption(
      getArg("proof-expected-every-minutes", process.env.AUTONOMOUS_RUNNER_PROOF_EXPECTED_EVERY_MINUTES),
      15,
    ),
    proofGraceMinutes: parseIntOption(
      getArg("proof-grace-minutes", process.env.AUTONOMOUS_RUNNER_PROOF_GRACE_MINUTES),
      15,
    ),
    trustedFallbackFreshMinutes: parseIntOption(
      getArg("trusted-fallback-fresh-minutes", process.env.AUTONOMOUS_RUNNER_TRUSTED_FALLBACK_FRESH_MINUTES),
      10,
    ),
    githubRepository: getArg("github-repository", process.env.GITHUB_REPOSITORY || ""),
    githubBranch: getArg("github-branch", process.env.AUTONOMOUS_RUNNER_MAIN_BRANCH || "main"),
    checkedOutSha: getArg("checked-out-sha", process.env.GITHUB_SHA || ""),
    githubToken: getArg("github-token", process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ""),
    mainFreshnessThresholdMinutes: parseIntOption(
      getArg("main-freshness-threshold-minutes", process.env.AUTONOMOUS_RUNNER_MAIN_FRESHNESS_THRESHOLD_MINUTES),
      20,
    ),
    gitHygienePreflight: !parseBoolean(
      getArg("skip-git-hygiene-preflight", process.env.AUTONOMOUS_RUNNER_SKIP_GIT_HYGIENE_PREFLIGHT),
    ),
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
