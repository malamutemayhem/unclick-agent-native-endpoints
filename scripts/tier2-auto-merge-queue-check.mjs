#!/usr/bin/env node

import { spawn } from "node:child_process";

function parseBoundedInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function compact(value, max = 160) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function normalizeMergeState(value) {
  return String(value ?? "").trim().toUpperCase() || "UNKNOWN";
}

function boundedNumber(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
}

function prNumber(pr = {}) {
  const parsed = Number.parseInt(String(pr.number ?? pr.pr_number ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function scoreTier2PullRequestRisk(pr = {}) {
  const reasons = [];
  let score = 0;
  const mergeState = normalizeMergeState(pr.mergeStateStatus ?? pr.merge_state_status);
  const changedFiles = boundedNumber(pr.changedFiles ?? pr.changed_files);
  const changedLines = boundedNumber(pr.additions) + boundedNumber(pr.deletions);
  const headRefName = String(pr.headRefName || pr.head?.ref || "").trim();

  if (Boolean(pr.isDraft ?? pr.draft)) {
    score += 35;
    reasons.push("draft");
  }

  if (mergeState !== "CLEAN") {
    score += 30;
    reasons.push(`merge_state_${mergeState.toLowerCase()}`);
  }

  if (changedFiles > 30) {
    score += 25;
    reasons.push("many_files");
  } else if (changedFiles > 12) {
    score += 15;
    reasons.push("several_files");
  }

  if (changedLines > 2000) {
    score += 25;
    reasons.push("large_diff");
  } else if (changedLines > 500) {
    score += 15;
    reasons.push("medium_diff");
  }

  if (/\b(auth|billing|payment|stripe|secret|credential|migration|schema|rls|tenant)\b/i.test(headRefName)) {
    score += 25;
    reasons.push("sensitive_branch_name");
  }

  const boundedScore = Math.min(100, score);
  return {
    score: boundedScore,
    level: boundedScore >= 60 ? "high" : boundedScore >= 30 ? "medium" : "low",
    reasons,
  };
}

function safePrSummary(pr = {}) {
  const risk = scoreTier2PullRequestRisk(pr);
  return {
    number: prNumber(pr),
    isDraft: Boolean(pr.isDraft ?? pr.draft),
    mergeStateStatus: normalizeMergeState(pr.mergeStateStatus ?? pr.merge_state_status),
    url: String(pr.url || pr.html_url || "").trim(),
    headRefName: compact(pr.headRefName || pr.head?.ref || "", 120),
    changedFiles: boundedNumber(pr.changedFiles ?? pr.changed_files),
    additions: boundedNumber(pr.additions),
    deletions: boundedNumber(pr.deletions),
    risk_score: risk.score,
    risk_level: risk.level,
    risk_reasons: risk.reasons,
  };
}

function auditReasons(summary = {}) {
  const reasons = [];
  if (summary.isDraft) reasons.push("draft");
  if (summary.mergeStateStatus !== "CLEAN") {
    reasons.push(`merge_state_${String(summary.mergeStateStatus || "UNKNOWN").toLowerCase()}`);
  }
  if (summary.risk_level !== "low") {
    reasons.push(`risk_${summary.risk_level || "unknown"}`);
  }
  for (const reason of summary.risk_reasons || []) {
    if (!reasons.includes(reason)) reasons.push(reason);
  }
  return reasons;
}

function auditKey(summary = {}, index = 0) {
  return summary.number ? `#${summary.number}` : `unknown-${index + 1}`;
}

export function evaluateTier2AutoMergeQueue({ prs = [], now = new Date().toISOString() } = {}) {
  const openPrs = Array.isArray(prs) ? prs : [];
  const summaries = openPrs.map(safePrSummary);
  if (openPrs.length === 0) {
    return {
      ok: true,
      action: "tier2_auto_merge_queue_check",
      result: "idle",
      reason: "open_pr_queue_empty",
      now,
      open_pr_count: 0,
      safe_to_merge_count: 0,
      execute: false,
      no_execute_reason: "audit_only_no_merge_execution",
      low_risk_count: 0,
      candidate_count: 0,
      candidate_pr_numbers: [],
      blocked_prs: [],
      blocked_reasons_by_pr: {},
      summaries: [],
    };
  }

  const candidates = [];
  const blockedPrs = [];
  const blockedReasonsByPr = {};

  for (const [index, summary] of summaries.entries()) {
    const reasons = auditReasons(summary);
    if (reasons.length === 0) {
      candidates.push(summary);
      continue;
    }
    const key = auditKey(summary, index);
    blockedPrs.push({ number: summary.number, reasons });
    blockedReasonsByPr[key] = reasons;
  }

  return {
    ok: true,
    action: "tier2_auto_merge_queue_check",
    result: "queue_not_empty",
    reason: "scheduled_noop_check_only",
    now,
    open_pr_count: openPrs.length,
    safe_to_merge_count: 0,
    execute: false,
    no_execute_reason: "audit_only_no_merge_execution",
    low_risk_count: candidates.length,
    candidate_count: candidates.length,
    candidate_pr_numbers: candidates.map((summary) => summary.number).filter(Number.isFinite),
    blocked_prs: blockedPrs,
    blocked_reasons_by_pr: blockedReasonsByPr,
    summaries,
  };
}

export async function runCommandJson(command, args, { cwd = process.cwd(), env = process.env } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({ ok: false, exit_code: null, reason: "command_failed", output: compact(error.message, 500) });
    });
    child.on("close", (code) => {
      if (code !== 0) {
        resolve({ ok: false, exit_code: code, reason: "command_failed", output: compact(stderr || stdout, 500) });
        return;
      }
      try {
        resolve({ ok: true, value: JSON.parse(stdout || "[]") });
      } catch {
        resolve({ ok: false, exit_code: code, reason: "invalid_json", output: compact(stdout, 500) });
      }
    });
  });
}

export async function fetchOpenPullRequests({
  repo = process.env.GITHUB_REPOSITORY || "malamutemayhem/unclick-agent-native-endpoints",
  limit = parseBoundedInt(process.env.TIER2_AUTOMERGE_PR_LIMIT, 30, 1, 100),
  cwd = process.cwd(),
  runJson = runCommandJson,
} = {}) {
  const result = await runJson(
    "gh",
    [
      "pr",
      "list",
      "--repo",
      repo,
      "--state",
      "open",
      "--limit",
      String(limit),
      "--json",
      "number,isDraft,mergeStateStatus,url,headRefName,changedFiles,additions,deletions",
    ],
    { cwd },
  );
  if (!result.ok) return result;
  return { ok: true, prs: Array.isArray(result.value) ? result.value : [] };
}

export async function runTier2AutoMergeQueueCheck(options = {}) {
  const fetched = await fetchOpenPullRequests(options);
  if (!fetched.ok) {
    return {
      ok: false,
      action: "tier2_auto_merge_queue_check",
      result: "blocker",
      reason: fetched.reason || "fetch_open_prs_failed",
      execute: false,
      output: fetched.output || "",
    };
  }

  return evaluateTier2AutoMergeQueue({
    prs: fetched.prs,
    now: options.now || new Date().toISOString(),
  });
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  runTier2AutoMergeQueueCheck()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(compact(error?.message || error, 500));
      process.exitCode = 1;
    });
}
