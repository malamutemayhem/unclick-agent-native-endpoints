/**
 * Multi-pass controller for TestPass.
 *
 * Runs the smoke -> standard -> deep profiles in sequence against a single
 * run, short-circuiting when a pass is clean enough to skip deeper work and
 * aborting when the cumulative LLM spend trips the configured budget cap.
 *
 * Called by api/testpass.ts when a caller requests profile "deep". Lower
 * profiles still run directly; the controller is only worth the extra
 * round-trips when the caller actually wants the full escalation.
 */

import type { Pack, RunProfile, Severity } from "../types.js";
import type { RunManagerConfig } from "../run-manager.js";
import { updateRunStatus } from "../run-manager.js";
import { runDeterministicChecks } from "./deterministic.js";
import { runAgentChecks } from "./agent.js";

const PROFILE_ORDER: RunProfile[] = ["smoke", "standard", "deep"];
const DEFAULT_MAX_COST_USD = 0.5;
const EARLY_STOP_PASS_RATE = 0.95;

function profilesUpTo(maxProfile: RunProfile): RunProfile[] {
  const idx = PROFILE_ORDER.indexOf(maxProfile);
  return PROFILE_ORDER.slice(0, idx + 1);
}

interface ItemSnapshot {
  check_id: string;
  verdict: string;
  severity: Severity;
  cost_usd: number | null;
}

async function fetchItems(
  config: RunManagerConfig,
  runId: string,
): Promise<ItemSnapshot[]> {
  const url = `${config.supabaseUrl}/rest/v1/testpass_items?run_id=eq.${runId}&select=check_id,verdict,severity,cost_usd`;
  const res = await fetch(url, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
  });
  if (!res.ok) return [];
  return (await res.json()) as ItemSnapshot[];
}

function passRate(items: ItemSnapshot[]): number {
  let decided = 0;
  let passed = 0;
  for (const i of items) {
    if (i.verdict === "pending") continue;
    decided++;
    if (i.verdict === "check") passed++;
  }
  return decided > 0 ? passed / decided : 0;
}

function hasCriticalFailure(items: ItemSnapshot[]): boolean {
  return items.some((i) => i.verdict === "fail" && i.severity === "critical");
}

function totalCostUsd(items: ItemSnapshot[]): number {
  let sum = 0;
  for (const i of items) sum += typeof i.cost_usd === "number" ? i.cost_usd : 0;
  return sum;
}

/**
 * Run smoke -> standard -> deep in order, honouring budget cap and
 * early-stop heuristics. Each pass executes deterministic then agent
 * checks for items scoped to that profile. Callers are expected to
 * compute and persist the final verdict summary after this returns.
 */
export async function runMultiPass(
  config: RunManagerConfig,
  runId: string,
  targetUrl: string,
  pack: Pack,
  maxProfile: RunProfile,
  maxCostUsd: number = DEFAULT_MAX_COST_USD,
): Promise<void> {
  const profiles = profilesUpTo(maxProfile);

  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i];

    try {
      await runDeterministicChecks(config, runId, targetUrl, pack, profile);
    } catch (err) {
      console.error(`Multi-pass deterministic (${profile}) failed for ${runId}:`, (err as Error).message);
    }

    try {
      await runAgentChecks(config, runId, targetUrl, pack, profile);
    } catch (err) {
      console.error(`Multi-pass agent (${profile}) failed for ${runId}:`, (err as Error).message);
    }

    const items = await fetchItems(config, runId);

    if (totalCostUsd(items) >= maxCostUsd) {
      await updateRunStatus(config, runId, "budget_exceeded");
      return;
    }

    const isLast = i === profiles.length - 1;
    if (isLast) break;

    if (profile === "smoke" && passRate(items) >= EARLY_STOP_PASS_RATE) return;
    if (profile === "standard" && hasCriticalFailure(items)) return;
  }
}
