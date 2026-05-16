/**
 * Deterministic runner for TestPass Core.
 *
 * Executes all registered check handlers against a target MCP server
 * via HTTP JSON-RPC, writes per-check verdicts and evidence to Supabase,
 * and returns when all handlers have settled.
 *
 * Items without a registered handler are left as "pending" so a future
 * agent runner (Chunk 4) can pick them up.
 */

import type { Pack, RunProfile } from "../types.js";
import type { RunManagerConfig } from "../run-manager.js";
import { updateItem, createEvidence } from "../run-manager.js";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { checkGitStatusClean } from "../checks/anti-stomp.js";
import { buildMcpHeaders, readMcpResponseBody } from "../mcp-http.js";

// ─── Internal types ────────────────────────────────────────────────

interface HttpTrace {
  request:  { url: string; body: unknown };
  response: { status: number; body: unknown; latency_ms: number };
}

type CheckVerdict = "check" | "fail" | "na" | "other";

interface CheckOutcome {
  verdict: CheckVerdict;
  note?:   string;
  traces:  HttpTrace[];
}

// ─── Low-level send ─────────────────────────────────────────────────
// Always reads the full response body regardless of whether it is a
// notification. This differs from probe.ts which shortcuts for
// notifications - the runner needs to assert on response content.

async function send(
  url:       string,
  reqBody:   unknown,
  timeoutMs  = 10_000,
): Promise<{ status: number; body: unknown; latency_ms: number }> {
  const start      = Date.now();
  const controller = new AbortController();
  const tid        = setTimeout(() => controller.abort(), timeoutMs);
  const headers = buildMcpHeaders();
  try {
    const res = await fetch(url, {
      method:  "POST",
      headers,
      body:    JSON.stringify(reqBody),
      signal:  controller.signal,
    });
    const body = await readMcpResponseBody(res);
    return { status: res.status, body, latency_ms: Date.now() - start };
  } finally {
    clearTimeout(tid);
  }
}

function rpcReq(method: string, params: unknown, id?: number): unknown {
  const r: Record<string, unknown> = { jsonrpc: "2.0", method, params };
  if (id !== undefined) r.id = id;
  return r;
}

async function runGitStatusPorcelain(
  cwd = process.cwd(),
): Promise<{ ok: boolean; status: number; stdout: string; stderr: string; latency_ms: number }> {
  const start = Date.now();
  return new Promise((resolve) => {
    execFile("git", ["status", "--porcelain"], { cwd }, (error, stdout, stderr) => {
      const code = (error as { code?: unknown } | null)?.code;
      resolve({
        ok: !error,
        status: !error ? 0 : typeof code === "number" ? code : 1,
        stdout: String(stdout ?? ""),
        stderr: String(stderr ?? ""),
        latency_ms: Date.now() - start,
      });
    });
  });
}

// ─── Check handlers ────────────────────────────────────────────────

type CheckHandler = (targetUrl: string, config: RunManagerConfig) => Promise<CheckOutcome>;

function apiKeyHash(): string | null {
  const token = process.env.TESTPASS_TOKEN?.trim();
  if (!token) return null;
  return createHash("sha256").update(token).digest("hex");
}

async function fetchSignals(
  config: RunManagerConfig,
  hash: string,
): Promise<Array<Record<string, unknown>>> {
  const select = "id,tool,action,severity,summary,deep_link,payload,created_at";
  const path = [
    "mc_signals",
    `?api_key_hash=eq.${encodeURIComponent(hash)}`,
    "&tool=eq.github_action",
    `&select=${encodeURIComponent(select)}`,
    "&order=created_at.desc",
    "&limit=20",
  ].join("");
  const res = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase GET ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) as Array<Record<string, unknown>> : [];
}

function matchingGithubSignal(rows: Array<Record<string, unknown>>, owner: string): Record<string, unknown> | undefined {
  return rows.find((row) => {
    const payload = row.payload as Record<string, unknown> | undefined;
    const githubAction = payload?.github_action as Record<string, unknown> | undefined;
    return githubAction?.owner === owner;
  });
}

const HANDLERS: Record<string, CheckHandler> = {

  // RPC-001: Every response must carry jsonrpc: "2.0".
  "RPC-001": async (url) => {
    const req = rpcReq("initialize", {
      protocolVersion: "2024-11-05",
      clientInfo: { name: "testpass-runner", version: "0.1.0" },
      capabilities: {},
    }, 1);
    const r = await send(url, req);
    const trace: HttpTrace = { request: { url, body: req }, response: r };
    const body = r.body as Record<string, unknown> | null;
    if (body?.jsonrpc === "2.0") return { verdict: "check", traces: [trace] };
    return { verdict: "fail", note: `Expected jsonrpc "2.0", got ${JSON.stringify(body?.jsonrpc)}`, traces: [trace] };
  },

  // RPC-002: Response id must echo the request id.
  "RPC-002": async (url) => {
    const ID  = 42;
    const req = rpcReq("initialize", {
      protocolVersion: "2024-11-05",
      clientInfo: { name: "testpass-runner", version: "0.1.0" },
      capabilities: {},
    }, ID);
    const r = await send(url, req);
    const trace: HttpTrace = { request: { url, body: req }, response: r };
    const body = r.body as Record<string, unknown> | null;
    if (body?.id === ID) return { verdict: "check", traces: [trace] };
    return { verdict: "fail", note: `Expected id ${ID}, got ${JSON.stringify(body?.id)}`, traces: [trace] };
  },

  // RPC-003: Error object must have integer code and string message.
  "RPC-003": async (url) => {
    const req = rpcReq("__testpass_nonexistent__", {}, 99);
    const r   = await send(url, req);
    const trace: HttpTrace = { request: { url, body: req }, response: r };
    const body = r.body as Record<string, unknown> | null;
    const err  = body?.error as Record<string, unknown> | undefined;
    if (err && typeof err.code === "number" && typeof err.message === "string") {
      return { verdict: "check", traces: [trace] };
    }
    return { verdict: "fail", note: `Error must have integer code and string message, got ${JSON.stringify(err)}`, traces: [trace] };
  },

  // RPC-004: Unknown method must return error.code === -32601.
  "RPC-004": async (url) => {
    const req = rpcReq("__testpass_nonexistent__", {}, 100);
    const r   = await send(url, req);
    const trace: HttpTrace = { request: { url, body: req }, response: r };
    const body = r.body as Record<string, unknown> | null;
    const err  = body?.error as Record<string, unknown> | undefined;
    if (err?.code === -32601) return { verdict: "check", traces: [trace] };
    return { verdict: "fail", note: `Expected error.code -32601, got ${JSON.stringify(err?.code)}`, traces: [trace] };
  },

  // RPC-005: Batch request must return an array (or a graceful non-crash).
  "RPC-005": async (url) => {
    const batchBody = [
      rpcReq("initialize", { protocolVersion: "2024-11-05", clientInfo: { name: "testpass-runner", version: "0.1.0" }, capabilities: {} }, 201),
      rpcReq("initialize", { protocolVersion: "2024-11-05", clientInfo: { name: "testpass-runner", version: "0.1.0" }, capabilities: {} }, 202),
    ];
    const r     = await send(url, batchBody);
    const trace: HttpTrace = { request: { url, body: batchBody }, response: r };
    if (r.status === 204 || r.body === null) {
      return { verdict: "na", note: "Server returned no content for batch - batch not supported (acceptable)", traces: [trace] };
    }
    if (Array.isArray(r.body)) return { verdict: "check", traces: [trace] };
    const b = r.body as Record<string, unknown> | null;
    if (b && "error" in (b as object)) {
      return { verdict: "na", note: "Server returned single error for batch - batch not supported but server did not crash", traces: [trace] };
    }
    return { verdict: "fail", note: `Expected array or graceful error for batch, got ${JSON.stringify(r.body)}`, traces: [trace] };
  },

  // RPC-006: Notification (no id) must not return a JSON-RPC response object.
  "RPC-006": async (url) => {
    const req = { jsonrpc: "2.0", method: "notifications/initialized", params: {} };
    const r   = await send(url, req);
    const trace: HttpTrace = { request: { url, body: req }, response: r };
    if (r.status === 204 || r.body === null || r.body === "") {
      return { verdict: "check", traces: [trace] };
    }
    const body = r.body;
    if (body && typeof body === "object") {
      if (Object.keys(body as object).length === 0) return { verdict: "check", traces: [trace] };
      if ("result" in (body as object) || ("error" in (body as object) && (body as Record<string, unknown>).id !== undefined)) {
        return { verdict: "fail", note: `Server returned JSON-RPC response to notification: ${JSON.stringify(body)}`, traces: [trace] };
      }
    }
    return { verdict: "check", traces: [trace] };
  },

  // MCP-001: initialize must return serverInfo, protocolVersion, and capabilities.
  "MCP-001": async (url) => {
    const req = rpcReq("initialize", {
      protocolVersion: "2024-11-05",
      clientInfo: { name: "testpass-runner", version: "0.1.0" },
      capabilities: {},
    }, 300);
    const r = await send(url, req);
    const trace: HttpTrace = { request: { url, body: req }, response: r };
    const body   = r.body as Record<string, unknown> | null;
    const result = body?.result as Record<string, unknown> | undefined;
    if (result && result.serverInfo && result.protocolVersion && result.capabilities !== undefined) {
      return { verdict: "check", traces: [trace] };
    }
    return { verdict: "fail", note: `InitializeResult missing serverInfo/protocolVersion/capabilities: ${JSON.stringify(result)}`, traces: [trace] };
  },

  // MCP-002: instructions must be a non-empty string.
  "MCP-002": async (url) => {
    const req = rpcReq("initialize", {
      protocolVersion: "2024-11-05",
      clientInfo: { name: "testpass-runner", version: "0.1.0" },
      capabilities: {},
    }, 301);
    const r = await send(url, req);
    const trace: HttpTrace = { request: { url, body: req }, response: r };
    const body   = r.body as Record<string, unknown> | null;
    const result = body?.result as Record<string, unknown> | undefined;
    if (result && typeof result.instructions === "string" && result.instructions.trim().length > 0) {
      return { verdict: "check", traces: [trace] };
    }
    return { verdict: "fail", note: `instructions missing or empty: ${JSON.stringify(result?.instructions)}`, traces: [trace] };
  },

  // MCP-003: capabilities must declare at least tools, resources, or prompts.
  "MCP-003": async (url) => {
    const req = rpcReq("initialize", {
      protocolVersion: "2024-11-05",
      clientInfo: { name: "testpass-runner", version: "0.1.0" },
      capabilities: {},
    }, 302);
    const r = await send(url, req);
    const trace: HttpTrace = { request: { url, body: req }, response: r };
    const body   = r.body as Record<string, unknown> | null;
    const result = body?.result as Record<string, unknown> | undefined;
    const caps   = result?.capabilities as Record<string, unknown> | undefined;
    if (caps && (caps.tools !== undefined || caps.resources !== undefined || caps.prompts !== undefined)) {
      return { verdict: "check", traces: [trace] };
    }
    return { verdict: "fail", note: `capabilities must declare tools/resources/prompts: ${JSON.stringify(caps)}`, traces: [trace] };
  },

  // MCP-004: initialized notification must not return an error.
  "MCP-004": async (url) => {
    const initReq  = rpcReq("initialize", {
      protocolVersion: "2024-11-05",
      clientInfo: { name: "testpass-runner", version: "0.1.0" },
      capabilities: {},
    }, 303);
    const notifReq = { jsonrpc: "2.0", method: "notifications/initialized", params: {} };
    const initR  = await send(url, initReq);
    const notifR = await send(url, notifReq);
    const traces: HttpTrace[] = [
      { request: { url, body: initReq }, response: initR },
      { request: { url, body: notifReq }, response: notifR },
    ];
    const initBody  = initR.body as Record<string, unknown> | null;
    const notifBody = notifR.body as Record<string, unknown> | null;
    if (!initBody?.result) {
      return { verdict: "fail", note: `initialize failed: ${JSON.stringify(initBody)}`, traces };
    }
    const notifErr = notifBody && "error" in notifBody && (notifBody.error as Record<string, unknown>)?.code !== undefined;
    if (!notifErr) return { verdict: "check", traces };
    return { verdict: "fail", note: `initialized notification returned error: ${JSON.stringify(notifBody)}`, traces };
  },

  // MCP-005: ping must return an empty result within 5 seconds.
  "MCP-005": async (url) => {
    const req   = rpcReq("ping", {}, 304);
    const start = Date.now();
    const r     = await send(url, req, 5_500);
    const latency = Date.now() - start;
    const trace: HttpTrace = { request: { url, body: req }, response: r };
    if (latency > 5_000) {
      return { verdict: "fail", note: `ping took ${latency}ms (exceeds 5000ms limit)`, traces: [trace] };
    }
    const body   = r.body as Record<string, unknown> | null;
    const result = body?.result;
    if (result === undefined || result === null || (typeof result === "object" && Object.keys(result as object).length === 0)) {
      return { verdict: "check", traces: [trace] };
    }
    return { verdict: "fail", note: `ping must return empty result, got ${JSON.stringify(result)}`, traces: [trace] };
  },

  // MCP-006: Unknown method must return error.code -32601 without crashing.
  "MCP-006": async (url) => {
    const req = rpcReq("__testpass_unknown_mcp__", {}, 305);
    const r   = await send(url, req);
    const trace: HttpTrace = { request: { url, body: req }, response: r };
    const body = r.body as Record<string, unknown> | null;
    const err  = body?.error as Record<string, unknown> | undefined;
    if (err?.code === -32601) return { verdict: "check", traces: [trace] };
    if (err) return { verdict: "fail", note: `Expected error.code -32601, got ${JSON.stringify(err.code)}`, traces: [trace] };
    return { verdict: "fail", note: `Unknown method must return error, got ${JSON.stringify(body)}`, traces: [trace] };
  },

  // FB-010: github_action failures must create tenant-scoped Signals with
  // an /admin/signals fallback and fixture marker context.
  "FB-010": async (url, config) => {
    const hash = apiKeyHash();
    if (!hash) {
      return { verdict: "na", note: "TESTPASS_TOKEN is unset, cannot run authenticated signal smoke.", traces: [] };
    }

    const fixtureOwner = `unclick-fb010-fixture-${Date.now()}`;
    const fixtureRepo = "missing-repo";
    const req = rpcReq("tools/call", {
      name: "github_action",
      arguments: {
        action: "get_repo",
        owner: fixtureOwner,
        repo: fixtureRepo,
      },
    }, 410);
    const r = await send(url, req, 15_000);
    const trace: HttpTrace = { request: { url, body: req }, response: r };

    let lastRows: Array<Record<string, unknown>> = [];
    for (let attempt = 0; attempt < 10; attempt++) {
      lastRows = await fetchSignals(config, hash);
      const match = matchingGithubSignal(lastRows, fixtureOwner);
      if (match) {
        if (match.deep_link === "/admin/signals") {
          return { verdict: "check", traces: [trace] };
        }
        return {
          verdict: "fail",
          note: `Expected deep_link /admin/signals for ${fixtureOwner}, got ${JSON.stringify(match.deep_link)}`,
          traces: [trace],
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return {
      verdict: "fail",
      note: `No github_action signal found for fixture owner ${fixtureOwner}; recent rows: ${JSON.stringify(lastRows.slice(0, 3))}`,
      traces: [trace],
    };
  },

  // GIT-HYGIENE-001: session worktrees must be clean before handoff.
  "GIT-HYGIENE-001": async () => {
    const r = await runGitStatusPorcelain();
    const trace: HttpTrace = {
      request: {
        url: "local:git-status",
        body: { command: "git status --porcelain", cwd: process.cwd() },
      },
      response: {
        status: r.status,
        body: { stdout: r.stdout, stderr: r.stderr },
        latency_ms: r.latency_ms,
      },
    };

    if (!r.ok) {
      if (/not a git repository/i.test(r.stderr)) {
        return { verdict: "na", note: "git status is not available outside a git worktree", traces: [trace] };
      }
      return {
        verdict: "fail",
        note: `git status --porcelain failed: ${r.stderr || `exit ${r.status}`}`,
        traces: [trace],
      };
    }

    const result = checkGitStatusClean(r.stdout);
    if (result.pass) return { verdict: "check", note: result.reason, traces: [trace] };
    return {
      verdict: "fail",
      note: `${result.reason}: ${(result.missing || []).join(", ")}`,
      traces: [trace],
    };
  },
};

export function isDeterministicCheckRegistered(id: string): boolean {
  return Boolean(HANDLERS[id]);
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Run all registered deterministic check handlers against `targetUrl`.
 * Items with no registered handler are skipped (left as pending).
 * Checks run in parallel; each writes its own evidence + verdict row.
 */
export async function runDeterministicChecks(
  config:    RunManagerConfig,
  runId:     string,
  targetUrl: string,
  pack:      Pack,
  profile:   RunProfile,
): Promise<void> {
  const items = pack.items.filter(
    (i) => !i.profiles || i.profiles.includes(profile),
  );

  await Promise.all(
    items.map(async (item) => {
      const handler = HANDLERS[item.id];
      if (!handler) return;

      const checkStart = Date.now();
      let outcome: CheckOutcome;
      try {
        outcome = await handler(targetUrl, config);
      } catch (err) {
        outcome = {
          verdict: "other",
          note:    `Runner exception: ${(err as Error).message}`,
          traces:  [],
        };
      }
      const time_ms = Date.now() - checkStart;

      let evidenceRef: string | undefined;
      if (outcome.traces.length > 0) {
        try {
          evidenceRef = await createEvidence(config, {
            kind:    "http_trace",
            payload: outcome.traces.length === 1 ? outcome.traces[0] : outcome.traces,
          });
        } catch {
          // evidence write failure is non-fatal
        }
      }

      await updateItem(config, runId, item.id, {
        verdict:          outcome.verdict,
        on_fail_comment:  outcome.note,
        time_ms,
        cost_usd:         0,
        evidence_ref:     evidenceRef,
      });
    }),
  );
}
