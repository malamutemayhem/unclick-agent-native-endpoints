/**
 * TestPass API - Vercel serverless function
 *
 * Actions:
 *   GET  ?action=get_run&run_id=<uuid>                - fetch run + items
 *   GET  ?action=status&run_id=<uuid>                 - alias of get_run used by the admin UI
 *   GET  ?action=report_html&run_id=<uuid>            - self-contained HTML report
 *   GET  ?action=report_json&run_id=<uuid>            - JSON dump of run + items
 *   GET  ?action=report_md&run_id=<uuid>              - markdown fix list for failing checks
 *   POST ?action=start_run                            - create run, probe target, seed items
 *   POST ?action=run                                  - alias of start_run with flat body shape
 *   POST ?action=save_pack                            - validate + upsert a pack (owner = actor)
 *   POST ?action=complete_run                         - finalize an in-flight run
 *
 * Authentication: Bearer token in Authorization header. Two valid shapes:
 *   1. Supabase JWT (browser admin UI session)
 *   2. UnClick API key prefixed with "uc_" (MCP callers, e.g. testpass_run
 *      tool from a connected agent). Resolved against api_keys.key_hash.
 * Both paths resolve to the same actor_user_id used for tenancy and RLS.
 * Service role key used server-side for DB writes (bypasses RLS which
 * checks actor_user_id = auth.uid() - that match happens at read time).
 *
 * Body shape for start_run:
 *   { pack_slug: string, target: RunTarget, profile?: RunProfile }
 * Body shape for run (admin UI):
 *   { target_url: string, profile?: RunProfile, pack_slug?: string, pack_id?: string }
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as crypto from "node:crypto";
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

function sha256hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Resolve an UnClick API key (uc_...) to an actor user id by hashing it
 * and looking up an active row in api_keys. Returns null if the key isn't
 * found, isn't active, or has no linked user_id. Uses the service role key
 * to bypass RLS on api_keys (same pattern as api/mcp.ts).
 */
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

/**
 * Resolve the bearer token to an actor user id. UnClick API keys are
 * prefixed with "uc_" and looked up in api_keys; anything else is tried
 * as a Supabase JWT. Returns null if neither path succeeds.
 */
async function resolveActorUserId(
  supabaseUrl: string,
  serviceKey: string,
  token: string,
): Promise<string | null> {
  if (token.startsWith("uc_")) {
    return getActorUserIdFromApiKey(supabaseUrl, serviceKey, token);
  }
  return getActorUserId(supabaseUrl, token);
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

interface StartRunBody {
  pack_slug?: string;
  pack_id?: string;
  target?: RunTarget;
  profile?: RunProfile;
  task_id?: string;
}

// Accept any canonical UUID (v1-v5). UUIDv5 is the recommended derivation but
// strict version-pinning would needlessly reject conformant clients that pick
// a different deterministic scheme. Bad input gets a 400 so the partial unique
// index never sees a malformed key.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validateTaskId(raw: unknown): { value?: string; error?: string } {
  if (raw === undefined || raw === null || raw === "") return {};
  if (typeof raw !== "string") return { error: "task_id must be a string UUID" };
  if (!UUID_RE.test(raw)) return { error: "task_id must be a UUID (v1-v5, recommended v5)" };
  return { value: raw.toLowerCase() };
}

interface StartRunContext {
  supabaseUrl: string;
  serviceKey: string;
  actorUserId: string;
}

async function performStartRun(
  ctx: StartRunContext,
  body: StartRunBody,
): Promise<{ status: number; payload: Record<string, unknown> }> {
  if (!body.target?.url) {
    return { status: 400, payload: { error: "target.url required" } };
  }
  if (!body.pack_slug && !body.pack_id) {
    return { status: 400, payload: { error: "pack_slug or pack_id required" } };
  }
  const taskIdCheck = validateTaskId(body.task_id);
  if (taskIdCheck.error) return { status: 400, payload: { error: taskIdCheck.error } };

  const profile: RunProfile = body.profile ?? "standard";
  const slug = body.pack_slug ?? "testpass-core";

  const packId = body.pack_id ?? await getPackIdBySlug(ctx.supabaseUrl, ctx.serviceKey, slug);
  if (!packId) return { status: 404, payload: { error: `Pack '${slug}' not found` } };

  // Built-in packs ship as YAML on disk. User-saved packs could be loaded
  // from testpass_packs.yaml jsonb once the runner learns that path; for
  // now we require the YAML file so deterministic/agent runners can
  // consume it directly.
  const packPath = path.resolve(__dirname, `../packages/testpass/packs/${slug}.yaml`);
  let pack;
  try {
    pack = loadPackFromFile(packPath);
  } catch {
    return { status: 422, payload: { error: `Pack YAML not found on server for '${slug}'` } };
  }

  const config = { supabaseUrl: ctx.supabaseUrl, serviceRoleKey: ctx.serviceKey };
  const { id: runId, was_duplicate } = await createRun(config, {
    packId,
    packName: pack.name ?? slug,
    target: body.target,
    profile,
    actorUserId: ctx.actorUserId,
    taskId: taskIdCheck.value,
  });

  if (was_duplicate) {
    // Skip probe/seed/run; surface the existing row's current state so the
    // caller can poll status as if it had submitted the original request.
    const summary = await computeVerdictSummary(config, runId);
    return {
      status: 200,
      payload: {
        run_id: runId,
        was_duplicate: true,
        task_id: taskIdCheck.value,
        summary,
      },
    };
  }

  let evidenceRef: string | undefined;
  try {
    const probeResult = await probeServer(body.target.url, { timeoutMs: 12_000 });
    evidenceRef = await createEvidence(config, { kind: "tool_list", payload: probeResult });
  } catch (err) {
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
    if (body.target.url) {
      try {
        await runDeterministicChecks(config, runId, body.target.url, pack, profile);
      } catch (err) {
        console.error(`TestPass deterministic run failed for ${runId}:`, (err as Error).message);
      }
    }

    try {
      await runAgentChecks(config, runId, body.target.url, pack, profile, evidenceRef);
    } catch (err) {
      console.error(`TestPass agent run failed for ${runId}:`, (err as Error).message);
    }
  }

  const summary = await computeVerdictSummary(config, runId);
  const isDone  = summary.pending === 0;
  await updateRunStatus(
    config,
    runId,
    isDone ? (summary.fail > 0 ? "failed" : "complete") : "running",
    summary,
  );

  return {
    status: 201,
    payload: {
      run_id: runId,
      evidence_ref: evidenceRef ?? null,
      summary,
      was_duplicate: false,
      task_id: taskIdCheck.value ?? null,
    },
  };
}

async function upsertPack(
  supabaseUrl: string,
  serviceKey: string,
  actorUserId: string,
  packYaml: string,
): Promise<{ status: number; payload: Record<string, unknown> }> {
  let pack;
  try {
    pack = loadPackFromYaml(packYaml);
  } catch (err) {
    return { status: 422, payload: { error: (err as Error).message } };
  }

  const body = {
    slug:          pack.id,
    name:          pack.name,
    version:       pack.version,
    description:   pack.description ?? "",
    yaml:          packToJsonb(pack),
    owner_user_id: actorUserId,
  };

  const res = await fetch(
    `${supabaseUrl}/rest/v1/testpass_packs?on_conflict=slug`,
    {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        apikey:        serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer:        "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(body),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    return { status: 500, payload: { error: `Upsert failed: ${res.status} ${text}` } };
  }
  const rows = text ? (JSON.parse(text) as Array<Record<string, unknown>>) : [];
  return { status: 200, payload: { pack: rows[0] ?? null } };
}

function buildFixListMarkdown(
  run: Record<string, unknown> | null,
  items: Array<Record<string, unknown>>,
): string {
  const failItems = items.filter((i) => i.verdict === "fail");
  const header = `# TestPass Fix List\n\nRun: \`${run?.id ?? "?"}\`  \nStatus: \`${run?.status ?? "?"}\`  \nFailing checks: ${failItems.length} of ${items.length}\n`;
  if (failItems.length === 0) {
    return `${header}\n_No failing checks._\n`;
  }
  const lines = failItems.map((i) => {
    const comment = i.on_fail_comment ? `\n  - ${String(i.on_fail_comment).trim()}` : "";
    return `- [ ] **${i.check_id}** (${i.severity}, ${i.category}) - ${i.title}${comment}`;
  });
  return `${header}\n## Fixes\n\n${lines.join("\n")}\n`;
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

  const action = req.query.action as string;
  const config = { supabaseUrl, serviceRoleKey: serviceKey };

  if (req.method === "GET" && (action === "get_run" || action === "status")) {
    const runId = req.query.run_id as string;
    if (!runId) return json(res, 400, { error: "run_id required" });
    const data = await getRunWithItems(supabaseUrl, serviceKey, runId, actorUserId);
    if (!data.run) return json(res, 404, { error: "Run not found" });
    return json(res, 200, data);
  }

  if (req.method === "GET" && (action === "report_html" || action === "report_json")) {
    const runId = req.query.run_id as string;
    if (!runId) return json(res, 400, { error: "run_id required" });
    const owns = await assertRunOwnership(supabaseUrl, serviceKey, runId, actorUserId);
    if (!owns) return json(res, 404, { error: "Run not found" });

    try {
      if (action === "report_html") {
        const html = await generateHtmlReport(config, runId);
        return raw(res, 200, "text/html; charset=utf-8", html);
      }
      const body = await generateJsonReport(config, runId);
      return json(res, 200, body);
    } catch (err) {
      return json(res, 500, { error: (err as Error).message });
    }
  }

  if (req.method === "GET" && action === "report_md") {
    const runId = req.query.run_id as string;
    if (!runId) return json(res, 400, { error: "run_id required" });
    const data = await getRunWithItems(supabaseUrl, serviceKey, runId, actorUserId);
    if (!data.run) return json(res, 404, { error: "Run not found" });
    const markdown = buildFixListMarkdown(
      data.run as Record<string, unknown>,
      data.items as Array<Record<string, unknown>>,
    );
    return json(res, 200, { markdown });
  }

  if (req.method === "POST" && action === "start_run") {
    const body = req.body as StartRunBody;
    const result = await performStartRun(
      { supabaseUrl, serviceKey, actorUserId },
      body,
    );
    return json(res, result.status, result.payload);
  }

  if (req.method === "POST" && action === "run") {
    const raw = req.body as {
      target_url?: string;
      target?: RunTarget;
      profile?: RunProfile;
      pack_slug?: string;
      pack_id?: string;
      task_id?: string;
    };
    const target: RunTarget | undefined = raw.target
      ?? (raw.target_url ? { type: "mcp", url: raw.target_url } : undefined);
    const result = await performStartRun(
      { supabaseUrl, serviceKey, actorUserId },
      { target, profile: raw.profile, pack_slug: raw.pack_slug, pack_id: raw.pack_id, task_id: raw.task_id },
    );
    return json(res, result.status, result.payload);
  }

  if (req.method === "POST" && action === "save_pack") {
    const body = req.body as { pack_yaml?: string };
    if (!body?.pack_yaml) return json(res, 400, { error: "pack_yaml required" });
    const result = await upsertPack(supabaseUrl, serviceKey, actorUserId, body.pack_yaml);
    return json(res, result.status, result.payload);
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
