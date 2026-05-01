/**
 * runner - Deterministic UXPass executor.
 *
 * Fetches the target URL once plus a sidecar /llms.txt probe, then evaluates
 * every check in CORE_CHECKS against the captured context. Findings (failures
 * only) are written to uxpass_findings and the run row is updated with the
 * UX Score, breakdown jsonb, and summary text.
 *
 * No browser, no LLM. Playwright capture, hat-panel parallel LLM calls and
 * the Synthesiser land in later chunks; this runner is the bridge that
 * unblocks dogfood + visibility while those chunks get built.
 */

import {
  CORE_CHECKS,
  buildBreakdown,
  computeUxScore,
  evaluateAllChecks,
  failingFindings,
  type CheckContext,
} from "./checks.js";
import { createFindings, updateRunStatus, type RunManagerConfig } from "./run-manager.js";
import type { CheckEvaluation, RunBreakdown, RunSummaryStats, RuntimeFinding } from "./types.js";

export interface CaptureOptions {
  fetchTimeoutMs?: number;
  fetch?: typeof fetch;
}

export async function captureContext(
  url: string,
  opts: CaptureOptions = {},
): Promise<CheckContext> {
  const f = opts.fetch ?? fetch;
  const timeoutMs = opts.fetchTimeoutMs ?? 12_000;

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  let status = 0;
  let bodyText = "";
  let headers: Record<string, string> = {};
  let bodySize = 0;
  try {
    const res = await f(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "UXPass/0.1 (+https://unclick.world)" },
    });
    status = res.status;
    res.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    bodyText = await res.text();
    bodySize = Buffer.byteLength(bodyText, "utf8");
  } finally {
    clearTimeout(tid);
  }
  const responseTimeMs = Date.now() - start;

  // Best-effort sidecar probe; never blocks the run.
  let llmsTxtStatus: number | null = null;
  try {
    const llmsUrl = new URL("/llms.txt", url).toString();
    const lc = new AbortController();
    const ltid = setTimeout(() => lc.abort(), 5_000);
    try {
      const lr = await f(llmsUrl, {
        signal: lc.signal,
        headers: { "User-Agent": "UXPass/0.1 (+https://unclick.world)" },
      });
      llmsTxtStatus = lr.status;
    } finally {
      clearTimeout(ltid);
    }
  } catch {
    llmsTxtStatus = null;
  }

  return { url, status, headers, responseTimeMs, bodyText, bodySize, llmsTxtStatus };
}

export function summariseStats(evaluations: CheckEvaluation[]): RunSummaryStats {
  const stats: RunSummaryStats = { total: evaluations.length, pass: 0, fail: 0, na: 0, pass_rate: 0 };
  for (const e of evaluations) {
    if (e.verdict === "pass") stats.pass++;
    else if (e.verdict === "fail") stats.fail++;
    else stats.na++;
  }
  const decided = stats.pass + stats.fail;
  stats.pass_rate = decided > 0 ? stats.pass / decided : 0;
  return stats;
}

function buildSummaryText(stats: RunSummaryStats, uxScore: number): string {
  if (stats.total === 0) return "No checks ran.";
  return `${stats.pass} of ${stats.total} deterministic checks passed; ${stats.fail} failing. UX Score ${uxScore.toFixed(1)}.`;
}

function uniqueHats(evaluations: CheckEvaluation[]): string[] {
  return Array.from(new Set(evaluations.map((e) => e.hat))).sort();
}

/**
 * Capture + evaluate without touching the database. Used by tests and any
 * caller that wants the raw evaluations (e.g. the local CLI when offline).
 */
export async function evaluateUrl(
  targetUrl: string,
  opts: CaptureOptions = {},
): Promise<{
  evaluations: CheckEvaluation[];
  findings: RuntimeFinding[];
  stats: RunSummaryStats;
  uxScore: number;
  breakdown: RunBreakdown;
  context: CheckContext;
}> {
  const context = await captureContext(targetUrl, opts);
  const evaluations = evaluateAllChecks(context);
  return {
    evaluations,
    findings: failingFindings(evaluations),
    stats: summariseStats(evaluations),
    uxScore: computeUxScore(evaluations),
    breakdown: buildBreakdown(evaluations),
    context,
  };
}

/**
 * Full executor: capture, evaluate, persist failing findings, update run row.
 */
export async function runDeterministicChecks(
  config: RunManagerConfig,
  runId: string,
  targetUrl: string,
  opts: CaptureOptions = {},
): Promise<{
  status: "complete" | "failed";
  stats: RunSummaryStats;
  uxScore: number;
  checkCount: number;
  hats: string[];
}> {
  let evaluations: CheckEvaluation[];
  try {
    const context = await captureContext(targetUrl, opts);
    evaluations = evaluateAllChecks(context);
  } catch (err) {
    const message = (err as Error).message;
    await updateRunStatus(config, runId, {
      status: "failed",
      ux_score: null,
      summary: `Capture failed: ${message}`,
      error: message,
    });
    return {
      status: "failed",
      stats: { total: 0, pass: 0, fail: 0, na: 0, pass_rate: 0 },
      uxScore: 0,
      checkCount: 0,
      hats: uniqueHats(CORE_CHECKS as unknown as CheckEvaluation[]),
    };
  }

  const findings = failingFindings(evaluations);
  await createFindings(config, runId, findings);

  const stats = summariseStats(evaluations);
  const uxScore = computeUxScore(evaluations);
  const breakdown = buildBreakdown(evaluations);
  const summary = buildSummaryText(stats, uxScore);

  await updateRunStatus(config, runId, {
    status: "complete",
    ux_score: uxScore,
    breakdown,
    summary,
  });

  return {
    status: "complete",
    stats,
    uxScore,
    checkCount: evaluations.length,
    hats: uniqueHats(evaluations),
  };
}
