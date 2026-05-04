#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

function parseBoolean(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function compactOutput(value, max = 2000) {
  const text = String(value ?? "").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function normalizeToken(value) {
  return String(value ?? "").trim().toLowerCase();
}

function prNumber(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function checkName(check = {}) {
  return String(check.name || check.context || check.workflowName || "unknown").trim();
}

export function isMergeCheckGreen(check = {}) {
  const state = String(check.state || "").trim().toUpperCase();
  const conclusion = String(check.conclusion || "").trim().toUpperCase();
  const status = String(check.status || "").trim().toUpperCase();

  if (state) {
    return state === "SUCCESS";
  }

  if (conclusion) {
    return conclusion === "SUCCESS" || conclusion === "SKIPPED";
  }

  return status === "COMPLETED" && (conclusion === "SUCCESS" || conclusion === "SKIPPED");
}

export function summarizeMergeChecks(checks = []) {
  const items = Array.isArray(checks) ? checks : [];
  if (items.length === 0) {
    return { ok: false, reason: "missing_checks", failed: [] };
  }

  const failed = items
    .filter((check) => !isMergeCheckGreen(check))
    .map((check) => ({
      name: checkName(check),
      status: check.status || check.state || "",
      conclusion: check.conclusion || check.state || "",
    }));

  return failed.length === 0
    ? { ok: true, failed: [] }
    : { ok: false, reason: "check_not_green", failed };
}

function reviewToken(job = {}) {
  return normalizeToken(job.proof?.reviewer || job.worker || job.review_kind || job.requested_reviewers?.[0]);
}

function reviewAck(job = {}) {
  return normalizeToken(job.proof?.ack || job.proof?.result || job.ack);
}

export function listMergeReviewJobs({ ledger, reviews, pr } = {}) {
  const wantedPr = prNumber(pr?.number ?? pr?.pr_number);
  const ledgerJobs = Array.isArray(ledger?.jobs) ? ledger.jobs : [];
  const directReviews = Array.isArray(reviews) ? reviews : [];

  return [...ledgerJobs, ...directReviews].filter((job) => {
    if (job.job_type && job.job_type !== "review") {
      return false;
    }

    const jobPr = prNumber(job.pr_number ?? job.prNumber);
    return wantedPr === null || jobPr === null || jobPr === wantedPr;
  });
}

export function hasMergeReviewPass({ reviews = [], reviewer }) {
  const wanted = normalizeToken(reviewer);
  return reviews.some((job) => {
    const tokens = [
      reviewToken(job),
      job.review_kind,
      job.worker,
      ...(job.requested_reviewers || []),
    ].map(normalizeToken);
    return tokens.includes(wanted) && reviewAck(job) === "pass";
  });
}

export function findMergeReviewBlocker(reviews = []) {
  return reviews.find((job) => job.status === "blocked" || reviewAck(job) === "blocker");
}

export function findMergeProofJob({ ledger, proofJob, pr } = {}) {
  if (proofJob) {
    return proofJob;
  }

  const wantedPr = prNumber(pr?.number ?? pr?.pr_number);
  const jobs = Array.isArray(ledger?.jobs) ? ledger.jobs : [];
  return jobs.find((job) => {
    const jobPr = prNumber(job.pr_number ?? job.prNumber);
    if (wantedPr !== null && jobPr !== null && jobPr !== wantedPr) {
      return false;
    }

    return job.status === "proof_submitted" && normalizeToken(job.proof?.result) === "done";
  });
}

export function evaluateMergeReadiness({
  pr,
  ledger,
  proofJob,
  reviews,
  requiredReviewers = ["gatekeeper", "popcorn", "forge"],
} = {}) {
  if (!pr) {
    return { ok: false, result: "blocker", reason: "missing_pr" };
  }

  if (pr.isDraft || pr.draft) {
    return { ok: false, result: "blocker", reason: "pr_is_draft" };
  }

  const mergeState = String(pr.mergeStateStatus || pr.merge_state_status || "").trim().toUpperCase();
  if (mergeState === "DIRTY") {
    return { ok: false, result: "blocker", reason: "pr_is_dirty" };
  }

  if (mergeState && mergeState !== "CLEAN") {
    return { ok: false, result: "blocker", reason: "pr_not_clean", merge_state: mergeState };
  }

  const activeBlockers = [
    ...(Array.isArray(pr.blockers) ? pr.blockers : []),
    ...(pr.hasHold || pr.hold ? ["HOLD"] : []),
  ].filter(Boolean);
  if (activeBlockers.length > 0) {
    return { ok: false, result: "blocker", reason: "active_hold_or_blocker", blockers: activeBlockers };
  }

  const checks = summarizeMergeChecks(pr.statusCheckRollup || pr.checks || []);
  if (!checks.ok) {
    return { ok: false, result: "blocker", reason: checks.reason, failed_checks: checks.failed };
  }

  const submittedProof = findMergeProofJob({ ledger, proofJob, pr });
  if (!submittedProof) {
    return { ok: false, result: "blocker", reason: "missing_submitted_proof" };
  }

  if (submittedProof.status === "blocked" || normalizeToken(submittedProof.proof?.result) === "blocker") {
    return { ok: false, result: "blocker", reason: "proof_blocked" };
  }

  const reviewJobs = listMergeReviewJobs({ ledger, reviews, pr });
  const reviewBlocker = findMergeReviewBlocker(reviewJobs);
  if (reviewBlocker) {
    return {
      ok: false,
      result: "blocker",
      reason: "review_blocker",
      reviewer: reviewToken(reviewBlocker),
      blocker: reviewBlocker.proof?.blocker || reviewBlocker.blocker || "",
    };
  }

  const missingReviewers = requiredReviewers.filter((reviewer) => !hasMergeReviewPass({ reviews: reviewJobs, reviewer }));
  if (missingReviewers.length > 0) {
    return { ok: false, result: "blocker", reason: "missing_review_pass", missing_reviewers: missingReviewers };
  }

  return {
    ok: true,
    result: "ready",
    reason: "merge_ready",
    pr_number: pr.number ?? pr.pr_number ?? null,
    proof_job_id: submittedProof.job_id || null,
    reviewers: requiredReviewers,
  };
}

export async function runGhMerge({ prNumber: number, cwd = process.cwd(), subject = "", body = "" } = {}) {
  if (!number) {
    return { ok: false, exit_code: null, output: "Missing PR number" };
  }

  const args = ["pr", "merge", String(number), "--squash", "--delete-branch=false"];
  if (subject) {
    args.push("--subject", subject);
  }
  if (body) {
    args.push("--body", body);
  }

  return new Promise((resolve) => {
    const child = spawn("gh", args, {
      cwd,
      shell: false,
      windowsHide: true,
      env: process.env,
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
      resolve({ ok: false, exit_code: null, output: compactOutput(error.message) });
    });
    child.on("close", (code) => {
      resolve({ ok: code === 0, exit_code: code, output: compactOutput(`${stdout}\n${stderr}`) });
    });
  });
}

export async function executeMergeController({
  pr,
  ledger,
  proofJob,
  reviews,
  requiredReviewers,
  execute = false,
  merge = runGhMerge,
  cwd = process.cwd(),
} = {}) {
  const readiness = evaluateMergeReadiness({
    pr,
    ledger,
    proofJob,
    reviews,
    requiredReviewers,
  });

  if (!readiness.ok) {
    return readiness;
  }

  if (!execute) {
    return {
      ...readiness,
      action: "advisory_ready",
      execute: false,
    };
  }

  const merged = await merge({
    prNumber: pr.number ?? pr.pr_number,
    cwd,
    subject: pr.mergeSubject || pr.title || "",
    body: pr.mergeBody || "",
  });

  if (!merged.ok) {
    return {
      ok: false,
      result: "blocker",
      reason: "merge_command_failed",
      output: merged.output,
      exit_code: merged.exit_code,
    };
  }

  return {
    ...readiness,
    action: "merged",
    execute: true,
    output: merged.output,
  };
}

export async function readMergeControllerInput(filePath) {
  if (!filePath) {
    return { ok: false, reason: "missing_input_path" };
  }

  return JSON.parse(await readFile(filePath, "utf8"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  readMergeControllerInput(getArg("input", process.env.PINBALLWAKE_MERGE_INPUT || ""))
    .then((input) =>
      executeMergeController({
        ...input,
        execute: process.argv.includes("--execute") || parseBoolean(process.env.PINBALLWAKE_MERGE_EXECUTE),
      }),
    )
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
