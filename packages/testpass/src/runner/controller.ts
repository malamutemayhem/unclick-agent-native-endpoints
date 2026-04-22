/**
 * Multi-pass controller for TestPass.
 *
 * Executes the smoke -> standard -> deep sequence against a target, stopping
 * early on a high smoke pass rate, a critical-severity failure after standard,
 * or when accumulated agent cost exceeds the configured budget.
 *
 * Each pass runs deterministic checks first, then agent checks for any items
 * still pending. Items that are not part of a given profile are left untouched
 * by that pass.
 */

import type { Pack, RunProfile } from "../types.js";
import type { RunManagerConfig } from "../run-manager.js";
import { updateRunStatus, computeVerdictSummary } from "../run-manager.js";
import { runDeterministicChecks } from "./deterministic.js";
import { runAgentChecks } from "./agent.js";

const DEFAULT_MAX_COST_USD = 0.5;

const PASS_ORDER: RunProfile[] = ["smoke", "standard", "deep"];

async function fetchItems(
  config: RunManagerConfig,
  runId: string,
  select: string,
): Promise<Array<Record<string, unknown>>> {
  const res = await fetch(
    `${config.supabaseUrl}/rest/v1/testpass_items?run_id=eq.${runId}&select=${select}`,
    {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
      },
    },
  );
  if (!res.ok) return [];
  return (await res.json()) as Array<Record<string, unknown>>;
}

async function sumCostUsd(config: RunManagerConfig, runId: string): Promise<number> {
  const rows = await fetchItems(config, runId, "cost_usd");
  return rows.reduce((acc, r) => acc + Number(r.cost_usd ?? 0), 0);
}

async function hasCriticalFailure(config: RunManagerConfig, runId: string): Promise<boolean> {
  const rows = await fetchItems(config, runId, "severity,verdict");
  return rows.some((r) => r.severity === "critical" && r.verdict === "fail");
}

export async function runMultiPass(
  config: RunManagerConfig,
  runId: string,
  targetUrl: string,
  pack: Pack,
  maxProfile: RunProfile,
  maxCostUsd: number = DEFAULT_MAX_COST_USD,
): Promise<void> {
  const maxIdx = PASS_ORDER.indexOf(maxProfile);
  const stopAt = maxIdx === -1 ? PASS_ORDER.length - 1 : maxIdx;

  for (let i = 0; i <= stopAt; i++) {
    const profile = PASS_ORDER[i];

    await runDeterministicChecks(config, runId, targetUrl, pack, profile);
    await runAgentChecks(config, runId, targetUrl, pack, profile);

    const cost = await sumCostUsd(config, runId);
    if (cost > maxCostUsd) {
      const summary = await computeVerdictSummary(config, runId);
      await updateRunStatus(config, runId, "budget_exceeded", summary);
      return;
    }

    if (profile === "smoke") {
      const summary = await computeVerdictSummary(config, runId);
      if (summary.pass_rate >= 0.95) break;
    } else if (profile === "standard") {
      if (await hasCriticalFailure(config, runId)) break;
    }
  }
}
