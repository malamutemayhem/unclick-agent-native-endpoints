/**
 * TestPass API - Vercel serverless function
 *
 * Actions:
 *   GET  ?action=get_run&run_id=<uuid>              - fetch run + items
 *   GET  ?action=report_html&run_id=<uuid>          - self-contained HTML report
 *   GET  ?action=report_json&run_id=<uuid>          - JSON dump of run + items
 *   GET  ?action=report_md&run_id=<uuid>            - Markdown fix-list grouped by severity
 *   POST ?action=start_run                          - create run, probe target, seed items
 *   POST ?action=complete_run                       - recompute verdict + finalize status
 *
 * Authentication: Supabase JWT Bearer token (session user = actor).
 * Service role key used server-side for DB writes (bypasses RLS which
 * checks actor_user_id = auth.uid() - that match happens at read time).
 *
 * Body shape for start_run:
 *   { pack_slug: string, target: RunTarget, profile?: RunProfile }
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
import {
  generateHtmlReport,
  generateJsonReport,
  generateMarkdownFixList,
} from "../packages/testpass/src/reporter.js";
import { runDeterministicChecks } from "../packages/testpass/src/runner/deterministic.js";
import { runAgentChecks } from "../packages/testpass/src/runner/agent.js";
import { runMultiPass } from "../packages/testpass/src/runner/controller.js";
import { healFailedChecks } from "../packages/testpass/src/runner/healer.js";
import { loadPackFromFile, loadPackFromYaml, packToJsonb } from "../packages/testpass/src/pack-loader.js";
import * as path from "node:path";
import * as url from "node:url";
import type { RunTarget, RunProfile } from "../packages/testpass/src/types.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const CORS = {
  "Access-Control-Allow-Origin": "https://unclick.world",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type",
};

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

async function getActorUserId(
  supabaseUrl: string,
  token: string
): Promise<string | null> {
  const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const u = (await r.json()) as { id?: string };
  return u.id ?? null;
}

async function getPackIdBySlug(
  supabaseUrl: string,
  serviceKey: string,
  slug: string
): Promise<string | null> {
  const r = await fetch(
    `${supabaseUrl}/rest/v1/testpass_packs?slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!r.ok) return null;
  const rows = (await r.json()) as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

async function assertRunOwnership(
  supabaseUrl: string,
  serviceKey: string,
  runId: string,
  actorUserId: string
): Promise<boolean> {
  const r = await fetch(
    `${supabaseUrl}/rest/v1/testpass_runs?id=eq.${runId}&actor_user_id=eq.${actorUserId}&select=id&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!r.ok) return false;
  const rows = (await r.json()) as Array<{ id: string }>;
  return rows.length > 0;
}

async function getRunWithItems(
  supabaseUrl: string,
  serviceKey: string,
  runId: string,
  actorUserId: string
) {
  const [runRes, itemsRes] = await Promise.all([
    fetch(
      `${supabaseUrl}/rest/v1/testpass_runs?id=eq.${runId}&actor_user_id=eq.${actorUserId}&select=*&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    ),
    fetch(
      `${supabaseUrl}/rest/v1/testpass_items?run_id=eq.${runId}&select=*&order=created_at.asc`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    ),
  ]);
  const run = ((await runRes.json()) as unknown[])[0] ?? null;
  const items = (await itemsRes.json()) as unknown[];
  return { run, items };
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

  const actorUserId = await getActorUserId(supabaseUrl, token);
  if (!actorUserId) return json(res, 401, { error: "Invalid session" });

  const action = req.query.action as string;
  const config = { supabaseUrl, serviceRoleKey: serviceKey };

  if (req.method === "GET" && action === "get_run") {
    const runId = req.query.run_id as string;
    if (!runId) return json(res, 400, { error: "run_id required" });
    const data = await getRunWithItems(supabaseUrl, serviceKey, runId, actorUserId);
    if (!data.run) return json(res, 404, { error: "Run not found" });
    return json(res, 200, data);
  }

  if (req.method === "GET" && action === "status") {
    const runId = req.query.run_id as string;
    if (!runId) return json(res, 400, { error: "run_id required" });
    const r = await fetch(
      `${supabaseUrl}/rest/v1/testpass_runs?id=eq.${runId}&actor_user_id=eq.${actorUserId}&select=status,verdict_summary&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    const rows = (await r.json()) as Array<{
      status: string;
      verdict_summary: { fail?: number } | null;
    }>;
    const row = rows[0];
    if (!row) return json(res, 404, { error: "Run not found" });
    return json(res, 200, {
      status: row.status,
      verdict_summary: row.verdict_summary ?? {},
      fail_count: row.verdict_summary?.fail ?? 0,
    });
  }

  if (req.method === "GET" && (action === "report_html" || action === "report_json" || action === "report_md")) {
    const runId = req.query.run_id as string;
    if (!runId) return json(res, 400, { error: "run_id required" });
    const owns = await assertRunOwnership(supabaseUrl, serviceKey, runId, actorUserId);
    if (!owns) return json(res, 404, { error: "Run not found" });

    try {
      if (action === "report_html") {
        const html = await generateHtmlReport(config, runId);
        return raw(res, 200, "text/html; charset=utf-8", html);
      }
      if (action === "report_json") {
        const body = await generateJsonReport(config, runId);
        return json(res, 200, body);
      }
      const md = await generateMarkdownFixList(config, runId);
      return raw(res, 200, "text/markdown; charset=utf-8", md);
    } catch (err) {
      return json(res, 500, { error: (err as Error).message });
    }
  }

  if (req.method === "POST" && action === "start_run") {
    const body = req.body as {
      pack_slug?: string;
      target?: RunTarget;
      profile?: RunProfile;
    };
    if (!body.pack_slug || !body.target?.url) {
      return json(res, 400, { error: "pack_slug and target.url required" });
    }
    const profile: RunProfile = body.profile ?? "standard";

    // Resolve pack from DB (built-ins have null owner)
    const packId = await getPackIdBySlug(supabaseUrl, serviceKey, body.pack_slug);
    if (!packId) return json(res, 404, { error: `Pack '${body.pack_slug}' not found` });

    // Load pack definition from bundled YAML (built-in packs only for now)
    const packPath = path.resolve(__dirname, `../packages/testpass/packs/${body.pack_slug}.yaml`);
    let pack;
    try {
      pack = loadPackFromFile(packPath);
    } catch {
      return json(res, 422, { error: `Pack YAML not found on server for '${body.pack_slug}'` });
    }

    const runId = await createRun(config, {
      packId,
      target: body.target,
      profile,
      actorUserId,
    });

    // Probe the target MCP server and store evidence (non-blocking on failures)
    let evidenceRef: string | undefined;
    try {
      const probeResult = await probeServer(body.target.url, { timeoutMs: 12_000 });
      evidenceRef = await createEvidence(config, {
        kind: "tool_list",
        payload: probeResult,
      });
    } catch (err) {
      // Probe failed - run continues with pending items, no evidence ref
      console.error(`TestPass probe failed for run ${runId}:`, (err as Error).message);
    }

    await seedPendingItems(config, runId, pack, profile, evidenceRef);

    if (profile === "deep") {
      try {
        await runMultiPass(config, runId, body.target.url, pack, "deep");
      } catch (err) {
        console.error(`TestPass multi-pass run failed for ${runId}:`, (err as Error).message);
      }
    } else {
      // Run deterministic checks inline. Agent checks (check_type: agent)
      // with no registered handler are left pending for a future runner.
      if (body.target.url) {
        try {
          await runDeterministicChecks(config, runId, body.target.url, pack, profile);
        } catch (err) {
          console.error(`TestPass deterministic run failed for ${runId}:`, (err as Error).message);
        }
      }

      // Run agent checks for any items still pending after the deterministic pass.
      try {
        await runAgentChecks(config, runId, body.target.url, pack, profile, evidenceRef);
      } catch (err) {
        console.error(`TestPass agent run failed for ${runId}:`, (err as Error).message);
      }
    }

    // Finalize: any item still pending means agent checks are not configured.
    const summary = await computeVerdictSummary(config, runId);
    const isDone  = summary.pending === 0;
    await updateRunStatus(
      config,
      runId,
      isDone ? (summary.fail > 0 ? "failed" : "complete") : "running",
      summary,
    );

    return json(res, 201, { run_id: runId, evidence_ref: evidenceRef ?? null, summary });
  }

  if (req.method === "POST" && action === "save_pack") {
    const body = req.body as { pack_id?: string; yaml?: string };
    if (!body.pack_id) return json(res, 400, { error: "pack_id required" });
    if (!body.yaml) return json(res, 400, { error: "yaml required" });

    let pack;
    try {
      pack = loadPackFromYaml(body.yaml);
    } catch (err) {
      return json(res, 422, { error: `Invalid pack: ${(err as Error).message}` });
    }

    const upsert = await fetch(`${supabaseUrl}/rest/v1/testpass_packs?on_conflict=slug`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        slug: body.pack_id,
        name: pack.name,
        version: pack.version,
        description: pack.description ?? "",
        yaml: packToJsonb(pack),
        owner_user_id: actorUserId,
      }),
    });
    if (!upsert.ok) {
      const text = await upsert.text();
      return json(res, 500, { error: `save_pack failed: ${text}` });
    }
    return json(res, 200, { ok: true, pack_id: body.pack_id });
  }

  if (req.method === "POST" && action === "edit_item") {
    const body = req.body as {
      run_id?: string;
      item_id?: string;
      verdict?: string;
      notes?: string;
    };
    if (!body.run_id) return json(res, 400, { error: "run_id required" });
    if (!body.item_id) return json(res, 400, { error: "item_id required" });
    const verdictMap: Record<string, string> = { pass: "check", fail: "fail", na: "na" };
    const dbVerdict = verdictMap[body.verdict ?? ""];
    if (!dbVerdict) return json(res, 400, { error: "verdict must be pass|fail|na" });

    // Confirm the run belongs to the caller before mutating items.
    const ownerCheck = await fetch(
      `${supabaseUrl}/rest/v1/testpass_runs?id=eq.${body.run_id}&actor_user_id=eq.${actorUserId}&select=id&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    const ownerRows = (await ownerCheck.json()) as Array<{ id: string }>;
    if (!ownerRows[0]) return json(res, 404, { error: "Run not found" });

    const patch: Record<string, unknown> = { verdict: dbVerdict };
    if (typeof body.notes === "string") patch.on_fail_comment = body.notes;

    const upd = await fetch(
      `${supabaseUrl}/rest/v1/testpass_items?id=eq.${body.item_id}&run_id=eq.${body.run_id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify(patch),
      }
    );
    if (!upd.ok) {
      const text = await upd.text();
      return json(res, 500, { error: `edit_item failed: ${text}` });
    }
    const rows = (await upd.json()) as unknown[];
    const item = rows[0];
    if (!item) return json(res, 404, { error: "Item not found" });
    return json(res, 200, { item });
  }

  if (req.method === "POST" && action === "heal") {
    const body = req.body as { run_id?: string; pack_slug?: string };
    if (!body.run_id) return json(res, 400, { error: "run_id required" });
    if (!body.pack_slug) return json(res, 400, { error: "pack_slug required" });

    const packPath = path.resolve(__dirname, `../packages/testpass/packs/${body.pack_slug}.yaml`);
    let pack;
    try {
      pack = loadPackFromFile(packPath);
    } catch {
      return json(res, 422, { error: `Pack YAML not found on server for '${body.pack_slug}'` });
    }

    let healed = 0;
    try {
      healed = await healFailedChecks(config, body.run_id, pack);
    } catch (err) {
      console.error(`TestPass heal failed for ${body.run_id}:`, (err as Error).message);
    }

    const summary = await computeVerdictSummary(config, body.run_id);
    const isDone = summary.pending === 0;
    await updateRunStatus(
      config,
      body.run_id,
      isDone ? (summary.fail > 0 ? "failed" : "complete") : "running",
      summary,
    );
    return json(res, 200, { healed, summary });
  }

  // Complete a specific run (called when agent checks land after Chunk 4+)
  if (req.method === "POST" && action === "complete_run") {
    const body = req.body as { run_id?: string };
    if (!body.run_id) return json(res, 400, { error: "run_id required" });
    const summary = await computeVerdictSummary(config, body.run_id);
    const hasFailures = summary.fail > 0 || summary.pending > 0;
    await updateRunStatus(config, body.run_id, hasFailures ? "failed" : "complete", summary);
    return json(res, 200, { summary });
  }

  return json(res, 404, { error: "Unknown action" });
}