/**
 * run-manager - Supabase REST wrapper for the UXPass run lifecycle.
 *
 * Mirrors packages/testpass/src/run-manager.ts: no Supabase SDK dependency,
 * keeps the package edge-compatible.
 */

import type {
  RunStatus,
  RunSummary,
  RunTarget,
  RuntimeFinding,
  UxpassRunRow,
  UxpassFindingRow,
} from "./types.js";

export interface RunManagerConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
}

async function supaFetch(
  config: RunManagerConfig,
  path: string,
  method: string,
  body?: unknown,
  extra?: Record<string, string>,
): Promise<unknown> {
  const res = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      Prefer: "return=representation",
      ...extra,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

export async function createRun(
  config: RunManagerConfig,
  params: {
    target: RunTarget;
    packSlug?: string;
    actorUserId: string;
  },
): Promise<string> {
  const payload: Record<string, unknown> = {
    target: params.target,
    pack_slug: params.packSlug ?? "uxpass-core",
    actor_user_id: params.actorUserId,
    status: "running",
    started_at: new Date().toISOString(),
    summary: {},
  };
  const rows = (await supaFetch(config, "uxpass_runs", "POST", payload)) as Array<{ id: string }>;
  return rows[0].id;
}

export async function updateRunStatus(
  config: RunManagerConfig,
  runId: string,
  update: {
    status: RunStatus;
    ux_score?: number | null;
    summary?: RunSummary | Record<string, unknown>;
    cost_usd?: number;
    tokens_used?: number;
  },
): Promise<void> {
  const patch: Record<string, unknown> = { status: update.status };
  if (update.status !== "running" && update.status !== "queued") {
    patch.completed_at = new Date().toISOString();
  }
  if (update.ux_score !== undefined) patch.ux_score = update.ux_score;
  if (update.summary !== undefined) patch.summary = update.summary;
  if (update.cost_usd !== undefined) patch.cost_usd = update.cost_usd;
  if (update.tokens_used !== undefined) patch.tokens_used = update.tokens_used;
  await supaFetch(config, `uxpass_runs?id=eq.${runId}`, "PATCH", patch);
}

export async function createFindings(
  config: RunManagerConfig,
  runId: string,
  findings: RuntimeFinding[],
): Promise<number> {
  if (findings.length === 0) return 0;
  const rows = findings.map((f) => ({
    run_id: runId,
    check_id: f.check_id,
    hat: f.hat,
    category: f.category,
    severity: f.severity,
    title: f.title,
    verdict: f.verdict,
    evidence: f.evidence ?? {},
    remediation: f.remediation ?? null,
    time_ms: f.time_ms ?? 0,
  }));
  const inserted = (await supaFetch(config, "uxpass_findings", "POST", rows)) as unknown[];
  return inserted.length;
}

export async function getRunWithFindings(
  config: RunManagerConfig,
  runId: string,
  actorUserId: string,
): Promise<{ run: UxpassRunRow | null; findings: UxpassFindingRow[] }> {
  const [runRes, findingsRes] = await Promise.all([
    fetch(
      `${config.supabaseUrl}/rest/v1/uxpass_runs?id=eq.${runId}&actor_user_id=eq.${actorUserId}&select=*&limit=1`,
      { headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}` } },
    ),
    fetch(
      `${config.supabaseUrl}/rest/v1/uxpass_findings?run_id=eq.${runId}&select=*&order=created_at.asc`,
      { headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}` } },
    ),
  ]);
  const runRows = (await runRes.json()) as UxpassRunRow[];
  const findings = (await findingsRes.json()) as UxpassFindingRow[];
  return { run: runRows[0] ?? null, findings };
}

export async function assertRunOwnership(
  config: RunManagerConfig,
  runId: string,
  actorUserId: string,
): Promise<boolean> {
  const r = await fetch(
    `${config.supabaseUrl}/rest/v1/uxpass_runs?id=eq.${runId}&actor_user_id=eq.${actorUserId}&select=id&limit=1`,
    { headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}` } },
  );
  if (!r.ok) return false;
  const rows = (await r.json()) as Array<{ id: string }>;
  return rows.length > 0;
}
