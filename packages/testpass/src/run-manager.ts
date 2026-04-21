/**
 * run-manager - Supabase REST API wrapper for TestPass run lifecycle.
 *
 * Creates/updates runs, items, and evidence rows without pulling in the
 * Supabase SDK (keeps the package edge-compatible and dependency-light).
 */

import type { Pack } from "./types.js";
import type { RunTarget, RunProfile, RunStatus, VerdictSummary } from "./types.js";

export interface RunManagerConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
}

async function supaFetch(
  config: RunManagerConfig,
  path: string,
  method: string,
  body?: unknown,
  extra?: Record<string, string>
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
  if (!res.ok) throw new Error(`Supabase ${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

export async function createRun(
  config: RunManagerConfig,
  params: {
    packId: string;
    target: RunTarget;
    profile: RunProfile;
    actorUserId: string;
  }
): Promise<string> {
  const rows = (await supaFetch(config, "testpass_runs", "POST", {
    pack_id: params.packId,
    target: params.target,
    profile: params.profile,
    actor_user_id: params.actorUserId,
    status: "running",
    verdict_summary: { total: 0, check: 0, na: 0, fail: 0, other: 0, pending: 0, pass_rate: 0 },
  })) as Array<{ id: string }>;
  return rows[0].id;
}

export async function updateRunStatus(
  config: RunManagerConfig,
  runId: string,
  status: RunStatus,
  summary?: VerdictSummary
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status !== "running") patch.completed_at = new Date().toISOString();
  if (summary) patch.verdict_summary = summary;
  await supaFetch(config, `testpass_runs?id=eq.${runId}`, "PATCH", patch);
}

export async function createEvidence(
  config: RunManagerConfig,
  params: {
    kind: string;
    payload: unknown;
  }
): Promise<string> {
  const rows = (await supaFetch(config, "testpass_evidence", "POST", {
    kind: params.kind,
    payload: params.payload,
  })) as Array<{ id: string }>;
  return rows[0].id;
}

export async function seedPendingItems(
  config: RunManagerConfig,
  runId: string,
  pack: Pack,
  profile: RunProfile,
  evidenceRef?: string
): Promise<void> {
  const items = pack.items.filter(
    (i) => !i.profiles || i.profiles.includes(profile)
  );
  if (items.length === 0) return;
  await supaFetch(
    config,
    "testpass_items",
    "POST",
    items.map((i) => ({
      run_id: runId,
      check_id: i.id,
      title: i.title,
      category: i.category,
      severity: i.severity,
      verdict: "pending",
      evidence_ref: evidenceRef ?? null,
    }))
  );
}

export async function updateItem(
  config: RunManagerConfig,
  runId: string,
  checkId: string,
  update: {
    verdict: string;
    on_fail_comment?: string;
    time_ms?: number;
    cost_usd?: number;
  }
): Promise<void> {
  await supaFetch(
    config,
    `testpass_items?run_id=eq.${runId}&check_id=eq.${encodeURIComponent(checkId)}`,
    "PATCH",
    update
  );
}

export async function computeVerdictSummary(
  config: RunManagerConfig,
  runId: string
): Promise<VerdictSummary> {
  const items = (await supaFetch(
    config,
    `testpass_items?run_id=eq.${runId}&select=verdict`,
    "GET"
  )) as Array<{ verdict: string }>;

  const summary: VerdictSummary = {
    total: items.length,
    check: 0, na: 0, fail: 0, other: 0, pending: 0,
    pass_rate: 0,
  };
  for (const item of items) {
    const v = item.verdict as keyof VerdictSummary;
    if (v in summary && v !== "total" && v !== "pass_rate") {
      (summary[v] as number)++;
    }
  }
  const decided = summary.check + summary.na + summary.fail + summary.other;
  summary.pass_rate = decided > 0 ? summary.check / decided : 0;
  return summary;
}
