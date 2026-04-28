/**
 * UXPass API - Vercel serverless function
 *
 * Actions:
 *   POST ?action=start_run                            - create run, execute deterministic checks, return summary
 *   POST ?action=run                                  - alias of start_run with flat body shape used by the MCP tool
 *   GET  ?action=status&run_id=<uuid>                 - fetch run + findings count
 *   GET  ?action=report_html&run_id=<uuid>            - self-contained HTML report
 *   GET  ?action=report_json&run_id=<uuid>            - JSON dump of run + findings
 *   GET  ?action=report_md&run_id=<uuid>              - markdown fix list
 *
 * Authentication: Bearer token (Supabase JWT or uc_ API key), same shape as
 * /api/testpass. Service role key is used server-side for DB writes.
 *
 * Schema: targets uxpass_runs and uxpass_findings from
 * supabase/migrations/20260428100000_uxpass_schema.sql (PR #227).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as crypto from "node:crypto";
import { CORE_CHECKS } from "../packages/uxpass/src/checks.js";
import {
  createRun,
  getRunWithFindings,
  assertRunOwnership,
} from "../packages/uxpass/src/run-manager.js";
import { runDeterministicChecks } from "../packages/uxpass/src/runner.js";
import {
  generateHtmlReport,
  generateJsonReport,
  generateMarkdownReport,
} from "../packages/uxpass/src/reporter.js";

const CORS = {
  "Access-Control-Allow-Origin": "https://unclick.world",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type",
};

const CORE_HATS = Array.from(new Set(CORE_CHECKS.map((c) => c.hat))).sort();

function json(res: VercelResponse, status: number, body: unknown) {
  res.status(status).setHeader("Content-Type", "application/json");
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  res.end(JSON.stringify(body));
}

function raw(res: VercelResponse, status: number, contentType: string, body: string) {
  res.status(status).setHeader("Content-Type", contentType);
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  res.end(body);
}

function sha256hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

async function getActorUserIdFromJwt(supabaseUrl: string, token: string): Promise<string | null> {
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

async function getActorUserIdFromApiKey(
  supabaseUrl: string,
  serviceKey: string,
  apiKey: string,
): Promise<string | null> {
  const apiKeyHash = sha256hex(apiKey);
  const r = await fetch(
    `${supabaseUrl}/rest/v1/api_keys?key_hash=eq.${encodeURIComponent(apiKeyHash)}&is_active=eq.true&select=user_id&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  if (!r.ok) return null;
  const rows = (await r.json()) as Array<{ user_id: string | null }>;
  return rows[0]?.user_id ?? null;
}

async function resolveActorUserId(
  supabaseUrl: string,
  serviceKey: string,
  token: string,
): Promise<string | null> {
  if (token.startsWith("uc_")) {
    return getActorUserIdFromApiKey(supabaseUrl, serviceKey, token);
  }
  return getActorUserIdFromJwt(supabaseUrl, token);
}

interface StartRunBody {
  target_url?: string;
  url?: string;
  target?: { type?: string; url?: string };
  pack_slug?: string;
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

  const actorUserId = await resolveActorUserId(supabaseUrl, serviceKey, token);
  if (!actorUserId) return json(res, 401, { error: "Invalid session" });

  const action = (req.query.action ?? "") as string;
  const config = { supabaseUrl, serviceRoleKey: serviceKey };

  if (req.method === "GET" && action === "status") {
    const runId = req.query.run_id as string;
    if (!runId) return json(res, 400, { error: "run_id required" });
    const data = await getRunWithFindings(config, runId, actorUserId);
    if (!data.run) return json(res, 404, { error: "Run not found" });
    return json(res, 200, {
      run_id: data.run.id,
      status: data.run.status,
      ux_score: data.run.ux_score,
      target_url: data.run.target_url,
      summary: data.run.summary,
      breakdown: data.run.breakdown,
      started_at: data.run.started_at,
      completed_at: data.run.completed_at,
      finding_count: data.findings.length,
      error: data.run.error,
    });
  }

  if (req.method === "GET" && action === "report_json") {
    const runId = req.query.run_id as string;
    if (!runId) return json(res, 400, { error: "run_id required" });
    const owns = await assertRunOwnership(config, runId, actorUserId);
    if (!owns) return json(res, 404, { error: "Run not found" });
    const body = await generateJsonReport(config, runId, actorUserId);
    return json(res, 200, body);
  }

  if (req.method === "GET" && action === "report_html") {
    const runId = req.query.run_id as string;
    if (!runId) return json(res, 400, { error: "run_id required" });
    const owns = await assertRunOwnership(config, runId, actorUserId);
    if (!owns) return json(res, 404, { error: "Run not found" });
    try {
      const html = await generateHtmlReport(config, runId, actorUserId);
      return raw(res, 200, "text/html; charset=utf-8", html);
    } catch (err) {
      return json(res, 500, { error: (err as Error).message });
    }
  }

  if (req.method === "GET" && action === "report_md") {
    const runId = req.query.run_id as string;
    if (!runId) return json(res, 400, { error: "run_id required" });
    const owns = await assertRunOwnership(config, runId, actorUserId);
    if (!owns) return json(res, 404, { error: "Run not found" });
    try {
      const md = await generateMarkdownReport(config, runId, actorUserId);
      return json(res, 200, { markdown: md });
    } catch (err) {
      return json(res, 500, { error: (err as Error).message });
    }
  }

  if (req.method === "POST" && (action === "start_run" || action === "run")) {
    const body = (req.body ?? {}) as StartRunBody;
    const targetUrl = body.target?.url ?? body.target_url ?? body.url ?? "";
    if (!targetUrl) return json(res, 400, { error: "url, target_url, or target.url required" });

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return json(res, 400, { error: "url must be an absolute URL" });
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return json(res, 400, { error: "url must use http or https" });
    }

    const runId = await createRun(config, {
      targetUrl,
      actorUserId,
      hats: CORE_HATS,
      viewports: ["desktop"],
      themes: ["light"],
    });

    try {
      const result = await runDeterministicChecks(config, runId, targetUrl);
      return json(res, 201, {
        run_id: runId,
        status: "complete",
        ux_score: result.uxScore,
        target_url: targetUrl,
        stats: result.stats,
      });
    } catch (err) {
      return json(res, 500, {
        run_id: runId,
        error: `runner failed: ${(err as Error).message}`,
      });
    }
  }

  return json(res, 404, { error: "Unknown action" });
}
