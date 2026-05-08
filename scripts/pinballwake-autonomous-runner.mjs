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
};

export const DEFAULT_UNCLICK_MCP_URL = "https://unclick.world/api/mcp";

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

function compact(value, max = 240) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
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

function boardroomClaimAgentId(runner = {}) {
  const safeRunner = createAutonomousRunner(runner);
  return safeRunner.agent_id || safeRunner.id || DEFAULT_AUTONOMOUS_RUNNER.id;
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
          `source=${job?.source || "unknown"}.`,
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

export function createCodingRoomJobFromBoardroomTodo(todo = {}, { now = new Date().toISOString() } = {}) {
  const id = String(todo.id || todo.todo_id || "").trim();
  const title = compact(todo.title || "Untitled Boardroom todo", 180);
  const priority = String(todo.priority || "normal").trim().toLowerCase();
  const assignee = String(todo.assigned_to_agent_id || "").trim();
  const contextParts = [
    id ? `Boardroom todo ${id}` : "Boardroom todo",
    priority ? `priority=${priority}` : "",
    assignee ? `assigned=${assignee}` : "unassigned",
    todo.status ? `status=${todo.status}` : "",
  ].filter(Boolean);

  return createCodingRoomJob({
    jobId: stableTodoJobId(todo),
    source: "unclick-boardroom-actionable-todo",
    worker: assignee || "builder",
    chip: title,
    context: `${contextParts.join("; ")}. Imported for autonomous claim/routing; do not build unless a ScopePack names owned files.`,
    files: [`boardroom-todos/${id || "unknown"}.md`],
    expectedProof: {
      requiresPr: false,
      requiresChangedFiles: false,
      requiresNonOverlap: true,
      requiresTests: false,
      tests: [],
    },
    createdAt: todo.created_at || now,
  });
}

export async function hydrateAutonomousRunnerLedgerFromUnClick({
  ledger,
  runner = DEFAULT_AUTONOMOUS_RUNNER,
  now = new Date().toISOString(),
  apiKey = "",
  mcpUrl = DEFAULT_UNCLICK_MCP_URL,
  limit = 10,
  fetchImpl = globalThis.fetch,
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
  for (const todo of ordered) {
    const upserted = upsertCodingRoomJob({
      ledger: next,
      job: createCodingRoomJobFromBoardroomTodo(todo, { now }),
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
    todos: ordered.map((todo) => ({
      id: todo.id,
      title: compact(todo.title, 140),
      priority: todo.priority || null,
      status: todo.status || null,
      assigned_to_agent_id: todo.assigned_to_agent_id || null,
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
} = {}) {
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

  if (shouldPersist) {
    await writeCodingRoomJobLedger(ledgerPath, ledger);
  }

  return {
    ...last,
    ok: results.every((result) => result.ok) && todoClaimSync.ok,
    action: last.action,
    mode: safeMode,
    dry_run: safeMode === "dry-run",
    persisted: shouldPersist,
    cycles: results,
    ledger,
    ledger_path: ledgerPath,
    queue_source: queueSourceResult,
    todo_claim_sync: todoClaimSync,
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
    policy: createAutonomousRunnerPolicy({
      disabled: parseBoolean(process.env.AUTONOMOUS_RUNNER_DISABLED),
      allowProtectedSurfaces: parseBoolean(process.env.AUTONOMOUS_RUNNER_ALLOW_PROTECTED_SURFACES),
      allowExecute: parseBoolean(process.env.AUTONOMOUS_RUNNER_ALLOW_EXECUTE),
      maxCycles: parseIntOption(getArg("max-cycles", process.env.AUTONOMOUS_RUNNER_MAX_CYCLES), 1),
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
