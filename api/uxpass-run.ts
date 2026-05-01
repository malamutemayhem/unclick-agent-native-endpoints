/**
 * UXPass cron + CI escape hatch - GET/POST /api/uxpass-run
 *
 * Vercel cron and CI pipelines hit this endpoint to run the deterministic
 * UXPass executor against a target URL without going through the MCP layer.
 *
 * Auth options:
 *   1. Bearer ${CRON_SECRET}  - same pattern as /api/testpass-run, used by
 *      Vercel scheduled crons. Requires UXPASS_CRON_USER_ID env var to be
 *      set to a real auth.users.id; that id is used as actor_user_id.
 *   2. Bearer <Supabase JWT>  - used by ad-hoc invocations from a logged-in
 *      operator; resolves the JWT to the calling user.
 *
 * Query/body: { url?: string, target_url?: string, pack_slug?: string }
 * Returns: { run_id, status, ux_score, stats }
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash } from "node:crypto";
import { CORE_CHECKS } from "../packages/uxpass/src/checks.js";
import { createRun } from "../packages/uxpass/src/run-manager.js";
import { runDeterministicChecks } from "../packages/uxpass/src/runner.js";
import {
  buildUxPassRunFailureDispatchRow,
  DEFAULT_UXPASS_RUN_HANDOFF_AGENT_ID,
  planUxPassRunFailureHandoff,
  uxPassRunFailureDispatchId,
} from "./lib/uxpass-run-handoff.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type",
};

const CORE_HATS = Array.from(new Set(CORE_CHECKS.map((c) => c.hat))).sort();

function json(res: VercelResponse, status: number, body: unknown) {
  res.status(status).setHeader("Content-Type", "application/json");
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  res.end(JSON.stringify(body));
}

async function getActorUserIdFromJwt(
  supabaseUrl: string,
  token: string,
): Promise<string | null> {
  const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!r.ok) return null;
  const u = (await r.json()) as { id?: string };
  return u.id ?? null;
}

function sha256hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function getApiKeyHashForUser(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
): Promise<string | null> {
  const r = await fetch(
    `${supabaseUrl}/rest/v1/api_keys?user_id=eq.${encodeURIComponent(userId)}&is_active=eq.true&select=key_hash,api_key&order=last_used_at.desc.nullslast,created_at.desc&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  if (!r.ok) return null;
  const rows = (await r.json().catch(() => [])) as Array<{
    key_hash?: string | null;
    api_key?: string | null;
  }>;
  const row = rows[0];
  return row?.key_hash ?? (row?.api_key ? sha256hex(row.api_key) : null);
}

function shouldCreateScheduledFailureDispatch(params: {
  isCron: boolean;
  source?: string;
}): boolean {
  return params.isCron || params.source === "scheduled";
}

async function createUxPassRunFailureDispatch(params: {
  supabaseUrl: string;
  serviceKey: string;
  apiKeyHash: string | null;
  runId: string;
  targetUrl: string;
  isScheduled: boolean;
  status?: string | null;
  errorMessage?: string | null;
  taskId?: string | null;
}) {
  if (!params.apiKeyHash) return;
  const targetAgentId = process.env.UXPASS_WAKE_AGENT_ID ?? DEFAULT_UXPASS_RUN_HANDOFF_AGENT_ID;
  const plan = planUxPassRunFailureHandoff({
    runId: params.runId,
    targetUrl: params.targetUrl,
    targetAgentId,
    isScheduled: params.isScheduled,
    status: params.status,
    errorMessage: params.errorMessage,
    taskId: params.taskId,
  });
  if (!plan) return;

  const row = buildUxPassRunFailureDispatchRow({
    apiKeyHash: params.apiKeyHash,
    dispatchId: uxPassRunFailureDispatchId(params.runId),
    plan,
    now: new Date(),
  });

  const response = await fetch(`${params.supabaseUrl}/rest/v1/mc_agent_dispatches`, {
    method: "POST",
    headers: {
      apikey: params.serviceKey,
      Authorization: `Bearer ${params.serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates",
    },
    body: JSON.stringify(row),
  });
  if (!response.ok && response.status !== 409) {
    const body = await response.text().catch(() => "");
    console.error(
      `uxpass-run failed to create failure dispatch for ${params.runId}:`,
      response.status,
      body,
    );
  }
}

function queryString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return json(res, 204, {});

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return json(res, 500, { error: "Server misconfigured: missing Supabase env vars" });
  }

  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json(res, 401, { error: "Missing Bearer token" });

  if (req.method !== "GET" && req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const isCron = Boolean(process.env.CRON_SECRET) && token === process.env.CRON_SECRET;

  let actorUserId: string | null = null;
  if (isCron) {
    actorUserId = process.env.UXPASS_CRON_USER_ID ?? null;
    if (!actorUserId) {
      return json(res, 500, {
        error: "UXPASS_CRON_USER_ID env var is not set; cron runs cannot attribute findings to a user.",
      });
    }
  } else {
    actorUserId = await getActorUserIdFromJwt(supabaseUrl, token);
    if (!actorUserId) return json(res, 401, { error: "Invalid session" });
  }

  const input = req.method === "GET"
    ? {
        url: queryString(req.query.url) ?? queryString(req.query.target_url),
        task_id: queryString(req.query.task_id),
        source: queryString(req.query.source),
      }
    : ((req.body ?? {}) as {
        url?: string;
        target_url?: string;
        task_id?: string;
        source?: string;
      });

  const targetUrl = input.url ?? input.target_url ?? "";
  if (!targetUrl) return json(res, 400, { error: "url required" });

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return json(res, 400, { error: "url must be an absolute URL" });
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return json(res, 400, { error: "url must use http or https" });
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (input.task_id !== undefined && input.task_id !== "" && !UUID_RE.test(input.task_id)) {
    return json(res, 400, { error: "task_id must be a UUID (v1-v5, recommended v5)" });
  }
  const taskId = input.task_id && input.task_id !== "" ? input.task_id.toLowerCase() : undefined;

  const config = { supabaseUrl, serviceRoleKey: serviceKey };
  const isScheduledAction = shouldCreateScheduledFailureDispatch({
    isCron,
    source: input.source,
  });
  const apiKeyHash = isScheduledAction
    ? await getApiKeyHashForUser(supabaseUrl, serviceKey, actorUserId)
    : null;
  const { id: runId, was_duplicate } = await createRun(config, {
    targetUrl,
    actorUserId,
    hats: CORE_HATS,
    viewports: ["desktop"],
    themes: ["light"],
    taskId,
  });

  if (was_duplicate) {
    const lookup = await fetch(
      `${supabaseUrl}/rest/v1/uxpass_runs?id=eq.${runId}&actor_user_id=eq.${actorUserId}&select=status,ux_score,target_url,breakdown&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    const rows = (await lookup.json()) as Array<{
      status?: string;
      ux_score?: number | null;
      target_url?: string;
      breakdown?: unknown;
    }>;
    const existing = rows[0] ?? {};
    return json(res, 200, {
      run_id: runId,
      was_duplicate: true,
      task_id: taskId,
      status: existing.status ?? "running",
      ux_score: existing.ux_score ?? null,
      target_url: existing.target_url ?? targetUrl,
      stats: existing.breakdown ?? {},
    });
  }

  try {
    const result = await runDeterministicChecks(config, runId, targetUrl);
    if (result.status === "failed") {
      await createUxPassRunFailureDispatch({
        supabaseUrl,
        serviceKey,
        apiKeyHash,
        runId,
        targetUrl,
        isScheduled: isScheduledAction,
        status: result.status,
        taskId: taskId ?? null,
      });
    }
    return json(res, 200, {
      run_id: runId,
      status: result.status,
      ux_score: result.uxScore,
      target_url: targetUrl,
      stats: result.stats,
      was_duplicate: false,
      task_id: taskId ?? null,
    });
  } catch (err) {
    await createUxPassRunFailureDispatch({
      supabaseUrl,
      serviceKey,
      apiKeyHash,
      runId,
      targetUrl,
      isScheduled: isScheduledAction,
      status: "failed",
      errorMessage: err instanceof Error ? err.message : String(err),
      taskId: taskId ?? null,
    });
    return json(res, 500, {
      run_id: runId,
      error: `runner failed: ${(err as Error).message}`,
      was_duplicate: false,
      task_id: taskId ?? null,
    });
  }
}
