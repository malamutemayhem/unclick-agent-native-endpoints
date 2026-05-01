/**
 * TestPass CI escape hatch - POST /api/testpass-run
 *
 * Bearer-auth (Supabase JWT) entry point for CI pipelines. Runs a named
 * pack against a target MCP server without going through MCP.
 *
 * Body/query: { pack_id: string, pack_name?: string, profile?: "smoke"|"standard"|"deep", server_url?: string }
 * Returns: { run_id: string, status: RunStatus, verdict_summary?: VerdictSummary }
 *
 * Smoke profile runs synchronously and returns the final verdict.
 * Standard/deep kick off the work and return status "running" immediately.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { probeServer } from "../packages/testpass/src/probe.js";
import {
  createRun,
  createEvidence,
  seedPendingItems,
  updateRunStatus,
  computeVerdictSummary,
} from "../packages/testpass/src/run-manager.js";
import { runDeterministicChecks } from "../packages/testpass/src/runner/deterministic.js";
import { runAgentChecks } from "../packages/testpass/src/runner/agent.js";
import { loadPackFromFile } from "../packages/testpass/src/pack-loader.js";
import { emitSignal } from "../packages/mcp-server/src/signals/emit.js";
import * as path from "node:path";
import * as url from "node:url";
import { createHash } from "node:crypto";
import type { RunProfile, RunTarget } from "../packages/testpass/src/types.js";
import {
  buildTestPassBackgroundFailureDispatchRow,
  DEFAULT_TESTPASS_BACKGROUND_HANDOFF_AGENT_ID,
  planTestPassBackgroundFailureHandoff,
  testPassBackgroundFailureDispatchId,
} from "./lib/testpass-background-handoff.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type",
};

function json(res: VercelResponse, status: number, body: unknown) {
  res.status(status).setHeader("Content-Type", "application/json");
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  res.end(JSON.stringify(body));
}

async function getActorUserId(
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

async function getPackIdBySlug(
  supabaseUrl: string,
  serviceKey: string,
  slug: string,
): Promise<{ id: string; owner_user_id: string } | null> {
  const r = await fetch(
    `${supabaseUrl}/rest/v1/testpass_packs?slug=eq.${encodeURIComponent(slug)}&select=id,owner_user_id&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  if (!r.ok) return null;
  const rows = (await r.json()) as Array<{ id: string; owner_user_id: string }>;
  return rows[0] ?? null;
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

function shouldEmitScheduledSignal(source: string | undefined): boolean {
  return source === "scheduled";
}

function emitScheduledRunSignal(params: {
  apiKeyHash: string | null;
  runId: string;
  packSlug: string;
  packName: string;
  profile: RunProfile;
  target: RunTarget;
  status: string;
  summary: Awaited<ReturnType<typeof computeVerdictSummary>>;
}) {
  if (!params.apiKeyHash) return;
  void emitSignal({
    apiKeyHash: params.apiKeyHash,
    tool: "testpass",
    action: params.status === "failed" ? "scheduled_run_failed" : "scheduled_run_complete",
    severity: params.status === "failed" ? "action_needed" : "info",
    summary: `Scheduled TestPass ${params.status}: ${params.packName} / ${params.profile}`,
    deepLink: `/admin/testpass/runs/${params.runId}`,
    payload: {
      run_id: params.runId,
      pack_slug: params.packSlug,
      pack_name: params.packName,
      profile: params.profile,
      target_url: params.target.url ?? "",
      status: params.status,
      verdict_summary: params.summary,
    },
  });
}

async function createBackgroundFailureDispatch(params: {
  supabaseUrl: string;
  serviceKey: string;
  apiKeyHash: string | null;
  runId: string;
  packSlug: string;
  packName: string;
  profile: RunProfile;
  target: RunTarget;
  error: unknown;
}) {
  if (!params.apiKeyHash) return;
  const targetAgentId =
    process.env.TESTPASS_WAKE_AGENT_ID ?? DEFAULT_TESTPASS_BACKGROUND_HANDOFF_AGENT_ID;
  const plan = planTestPassBackgroundFailureHandoff({
    runId: params.runId,
    packSlug: params.packSlug,
    packName: params.packName,
    profile: params.profile,
    target: params.target,
    targetAgentId,
    errorMessage: params.error instanceof Error ? params.error.message : String(params.error),
  });
  if (!plan) return;

  const row = buildTestPassBackgroundFailureDispatchRow({
    apiKeyHash: params.apiKeyHash,
    dispatchId: testPassBackgroundFailureDispatchId(params.runId),
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
      `testpass-run failed to create background failure dispatch for ${params.runId}:`,
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

  const isCron = Boolean(process.env.CRON_SECRET) && token === process.env.CRON_SECRET;
  if (req.method === "GET" && !isCron) return json(res, 405, { error: "Method not allowed" });
  if (req.method !== "GET" && req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const input = req.method === "GET"
    ? {
        pack_id: queryString(req.query.pack_id),
        pack_name: queryString(req.query.pack_name),
        profile: queryString(req.query.profile) as RunProfile | undefined,
        server_url: queryString(req.query.server_url),
        task_id: queryString(req.query.task_id),
        source: queryString(req.query.source),
      }
    : ((req.body ?? {}) as {
        pack_id?: string;
        pack_name?: string;
        profile?: RunProfile;
        server_url?: string;
        task_id?: string;
        source?: string;
      });

  if (!input.pack_id) return json(res, 400, { error: "pack_id required" });
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (input.task_id !== undefined && input.task_id !== "" && !UUID_RE.test(input.task_id)) {
    return json(res, 400, { error: "task_id must be a UUID (v1-v5, recommended v5)" });
  }
  const taskId = input.task_id && input.task_id !== "" ? input.task_id.toLowerCase() : undefined;

  const profile: RunProfile = input.profile ?? "smoke";
  if (!["smoke", "standard", "deep"].includes(profile)) {
    return json(res, 400, { error: "profile must be smoke|standard|deep" });
  }

  const config = { supabaseUrl, serviceRoleKey: serviceKey };
  const packSlug = input.pack_id;

  const packRow = await getPackIdBySlug(supabaseUrl, serviceKey, packSlug);
  if (!packRow) return json(res, 404, { error: `Pack '${packSlug}' not found` });

  let actorUserId: string | null;
  if (isCron) {
    actorUserId = packRow.owner_user_id ?? process.env.TESTPASS_CRON_USER_ID ?? null;
    if (!actorUserId) {
      return json(res, 500, {
        error:
          "TESTPASS_CRON_USER_ID env var is not set; cron runs against system packs (owner_user_id NULL) cannot attribute runs to a user.",
      });
    }
  } else {
    actorUserId = await getActorUserId(supabaseUrl, token);
    if (!actorUserId) return json(res, 401, { error: "Invalid session" });
  }
  const apiKeyHash = shouldEmitScheduledSignal(input.source) || profile !== "smoke"
    ? await getApiKeyHashForUser(supabaseUrl, serviceKey, actorUserId)
    : null;

  const packPath = path.resolve(__dirname, `../packages/testpass/packs/${packSlug}.yaml`);
  let pack;
  try {
    pack = loadPackFromFile(packPath);
  } catch {
    return json(res, 422, { error: `Pack YAML not found on server for '${packSlug}'` });
  }

  const target: RunTarget = { type: "url", url: input.server_url ?? "" };
  const packName = input.pack_name ?? pack.name ?? packSlug;

  const { id: runId, was_duplicate } = await createRun(config, {
    packId: packRow.id,
    packName,
    target,
    profile,
    actorUserId,
    taskId,
  });

  if (was_duplicate) {
    const summary = await computeVerdictSummary(config, runId);
    const status = summary.pending === 0 ? (summary.fail > 0 ? "failed" : "complete") : "running";
    return json(res, 200, {
      run_id: runId,
      status,
      verdict_summary: summary,
      was_duplicate: true,
      task_id: taskId,
    });
  }

  const runWork = async () => {
    let evidenceRef: string | undefined;
    if (target.url) {
      try {
        const probeResult = await probeServer(target.url, { timeoutMs: 12_000 });
        evidenceRef = await createEvidence(config, { kind: "tool_list", payload: probeResult });
      } catch (err) {
        console.error(`testpass-run probe failed for ${runId}:`, (err as Error).message);
      }
    }

    await seedPendingItems(config, runId, pack, profile, evidenceRef);

    if (target.url) {
      try {
        await runDeterministicChecks(config, runId, target.url, pack, profile);
      } catch (err) {
        console.error(`testpass-run deterministic failed for ${runId}:`, (err as Error).message);
      }
      try {
        await runAgentChecks(config, runId, target.url, pack, profile, evidenceRef);
      } catch (err) {
        console.error(`testpass-run agent failed for ${runId}:`, (err as Error).message);
      }
    }

    const summary = await computeVerdictSummary(config, runId);
    const isDone = summary.pending === 0;
    const status = isDone ? (summary.fail > 0 ? "failed" : "complete") : "running";
    await updateRunStatus(
      config,
      runId,
      status,
      summary,
    );
    if (shouldEmitScheduledSignal(input.source)) {
      emitScheduledRunSignal({
        apiKeyHash,
        runId,
        packSlug,
        packName,
        profile,
        target,
        status,
        summary,
      });
    }
    return summary;
  };

  if (profile === "smoke") {
    const summary = await runWork();
    const status = summary.pending === 0 ? (summary.fail > 0 ? "failed" : "complete") : "running";
    return json(res, 200, {
      run_id: runId,
      status,
      verdict_summary: summary,
      was_duplicate: false,
      task_id: taskId ?? null,
    });
  }

  runWork().catch(async (err) => {
    console.error(`testpass-run background work failed for ${runId}:`, (err as Error).message);
    try {
      await createBackgroundFailureDispatch({
        supabaseUrl,
        serviceKey,
        apiKeyHash,
        runId,
        packSlug,
        packName,
        profile,
        target,
        error: err,
      });
    } catch (dispatchErr) {
      console.error(
        `testpass-run background failure dispatch errored for ${runId}:`,
        (dispatchErr as Error).message,
      );
    }
  });
  return json(res, 202, {
    run_id: runId,
    status: "running",
    was_duplicate: false,
    task_id: taskId ?? null,
  });
}
