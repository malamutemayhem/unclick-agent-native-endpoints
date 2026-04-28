/**
 * runner - Deterministic UXPass executor (Chunk 2 MVP).
 *
 * Fetches the target URL once plus a sidecar /llms.txt probe, then evaluates
 * every check in CORE_CHECKS against the captured context. Findings are
 * written to uxpass_findings via run-manager and the run row is updated
 * with the composite UX Score.
 *
 * No browser, no LLM. Playwright capture, hat-panel parallel LLM calls and
 * the Synthesiser land in later chunks; this runner is the bridge that
 * unblocks dogfood + visibility while those chunks get built.
 */

import {
  CORE_CHECKS,
  computeUxScore,
  evaluateAllChecks,
  type CheckContext,
} from "./checks.js";
import { createFindings, updateRunStatus, type RunManagerConfig } from "./run-manager.js";
import type { RunSummary, RuntimeFinding } from "./types.js";

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

export function summarise(findings: RuntimeFinding[]): RunSummary {
  const summary: RunSummary = {
    total: findings.length,
    pass: 0,
    fail: 0,
    na: 0,
    pending: 0,
    pass_rate: 0,
  };
  for (const f of findings) {
    if (f.verdict === "pass") summary.pass++;
    else if (f.verdict === "fail") summary.fail++;
    else if (f.verdict === "na") summary.na++;
    else summary.pending++;
  }
  const decided = summary.pass + summary.fail;
  summary.pass_rate = decided > 0 ? summary.pass / decided : 0;
  return summary;
}

/**
 * Capture + evaluate without touching the database. Used by tests and any
 * caller that wants the raw findings (e.g. the local CLI when offline).
 */
export async function evaluateUrl(
  targetUrl: string,
  opts: CaptureOptions = {},
): Promise<{
  findings: RuntimeFinding[];
  summary: RunSummary;
  uxScore: number;
  context: CheckContext;
}> {
  const context = await captureContext(targetUrl, opts);
  const findings = evaluateAllChecks(context);
  return {
    findings,
    summary: summarise(findings),
    uxScore: computeUxScore(findings),
    context,
  };
}

/**
 * Full executor: capture, evaluate, persist findings, update the run row.
 * Returns the summary for the caller to surface to the agent.
 */
export async function runDeterministicChecks(
  config: RunManagerConfig,
  runId: string,
  targetUrl: string,
  opts: CaptureOptions = {},
): Promise<{ summary: RunSummary; uxScore: number; checkCount: number }> {
  let findings: RuntimeFinding[];
  try {
    const context = await captureContext(targetUrl, opts);
    findings = evaluateAllChecks(context);
  } catch (err) {
    const message = (err as Error).message;
    findings = CORE_CHECKS.map((spec) => ({
      check_id: spec.id,
      hat: spec.hat,
      category: spec.category,
      severity: spec.severity,
      title: spec.title,
      verdict: "na" as const,
      evidence: { capture_error: message },
      remediation: spec.remediation,
    }));
    await createFindings(config, runId, findings);
    const summary = summarise(findings);
    await updateRunStatus(config, runId, {
      status: "failed",
      ux_score: null,
      summary: { ...summary, capture_error: message },
    });
    return { summary, uxScore: 0, checkCount: findings.length };
  }

  await createFindings(config, runId, findings);
  const summary = summarise(findings);
  const uxScore = computeUxScore(findings);
  await updateRunStatus(config, runId, {
    status: "complete",
    ux_score: uxScore,
    summary,
  });
  return { summary, uxScore, checkCount: findings.length };
}
