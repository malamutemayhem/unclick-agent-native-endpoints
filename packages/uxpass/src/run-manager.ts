/**
 * run-manager - Supabase REST wrapper for the UXPass run lifecycle.
 *
 * Mirrors packages/testpass/src/run-manager.ts: no Supabase SDK dependency,
 * keeps the package edge-compatible. Targets the schema landed by
 * supabase/migrations/20260428100000_uxpass_schema.sql (PR #227).
 */

import type {
  RunBreakdown,
  RunStatus,
  RuntimeFinding,
  UxpassFindingRow,
  UxpassRunRow,
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
    targetUrl: string;
    actorUserId: string;
    hats?: string[];
    viewports?: string[];
    themes?: string[];
    packId?: string | null;
  },
): Promise<string> {
  const payload: Record<string, unknown> = {
    target_url: params.targetUrl,
    actor_user_id: params.actorUserId,
    status: "running",
    hats: params.hats ?? [],
    viewports: params.viewports ?? ["desktop"],
    themes: params.themes ?? ["light"],
    started_at: new Date().toISOString(),
    breakdown: {},
  };
  if (params.packId) payload.pack_id = params.packId;
  const rows = (await supaFetch(config, "uxpass_runs", "POST", payload)) as Array<{ id: string }>;
  return rows[0].id;
}

export async function updateRunStatus(
  config: RunManagerConfig,
  runId: string,
  update: {
    status: RunStatus;
    ux_score?: number | null;
    breakdown?: RunBreakdown | Record<string, unknown>;
    summary?: string | null;
    error?: string | null;
    cost_usd?: number;
    tokens_used?: number;
  },
): Promise<void> {
  const patch: Record<string, unknown> = { status: update.status };
  if (update.status !== "running" && update.status !== "queued") {
    patch.completed_at = new Date().toISOString();
  }
  if (update.ux_score !== undefined) patch.ux_score = update.ux_score;
  if (update.breakdown !== undefined) patch.breakdown = update.breakdown;
  if (update.summary !== undefined) patch.summary = update.summary;
  if (update.error !== undefined) patch.error = update.error;
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
    hat_id: f.hat_id,
    title: f.title,
    description: f.description,
    severity: f.severity,
    selector: f.selector ?? null,
    viewport: f.viewport ?? null,
    theme: f.theme ?? null,
    evidence: f.evidence,
    remediation: f.remediation,
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
