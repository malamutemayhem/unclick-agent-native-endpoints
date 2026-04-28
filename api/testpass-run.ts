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
import * as path from "node:path";
import * as url from "node:url";
import type { RunProfile, RunTarget } from "../packages/testpass/src/types.js";

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
      }
    : ((req.body ?? {}) as {
        pack_id?: string;
        pack_name?: string;
        profile?: RunProfile;
        server_url?: string;
      });

  if (!input.pack_id) return json(res, 400, { error: "pack_id required" });

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

  const packPath = path.resolve(__dirname, `../packages/testpass/packs/${packSlug}.yaml`);
  let pack;
  try {
    pack = loadPackFromFile(packPath);
  } catch {
    return json(res, 422, { error: `Pack YAML not found on server for '${packSlug}'` });
  }

  const target: RunTarget = { type: "url", url: input.server_url ?? "" };

  const runId = await createRun(config, {
    packId: packRow.id,
    packName: input.pack_name ?? pack.name ?? packSlug,
    target,
    profile,
    actorUserId,
  });

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
    await updateRunStatus(
      config,
      runId,
      isDone ? (summary.fail > 0 ? "failed" : "complete") : "running",
      summary,
    );
    return summary;
  };

  if (profile === "smoke") {
    const summary = await runWork();
    const status = summary.pending === 0 ? (summary.fail > 0 ? "failed" : "complete") : "running";
    return json(res, 200, { run_id: runId, status, verdict_summary: summary });
  }

  runWork().catch((err) => {
    console.error(`testpass-run background work failed for ${runId}:`, (err as Error).message);
  });
  return json(res, 202, { run_id: runId, status: "running" });
}
