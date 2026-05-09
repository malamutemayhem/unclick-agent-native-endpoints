#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import {
  claimCodingRoomLedgerJob,
  createCodingRoomJobLedger,
  readCodingRoomJobLedger,
  writeCodingRoomJobLedger,
} from "./pinballwake-coding-room.mjs";
import {
  DEFAULT_CODING_ROOM_RUNNER,
  createCodingRoomRunner,
  createCodingRoomRunnerFromEnv,
  runCodingRoomRunnerCycle,
} from "./pinballwake-coding-room-runner.mjs";
import { executeCodingRoomBuildJob, runGitApplyPatch } from "./pinballwake-build-executor.mjs";
import {
  DEFAULT_PROOF_COMMAND_ALLOWLIST,
  executeCodingRoomProofJob,
  runProofCommand,
} from "./pinballwake-proof-executor.mjs";
import { evaluateMergeRoom } from "./pinballwake-merge-room.mjs";

function parseBoolean(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function parseIntOption(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseList(value, fallback = []) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function replaceJob(ledger, job, now = new Date().toISOString()) {
  const next = createCodingRoomJobLedger({
    jobs: ledger?.jobs || [],
    updatedAt: now,
  });
  const index = next.jobs.findIndex((item) => item.job_id === job?.job_id);
  if (index === -1) {
    return { ok: false, reason: "missing_job" };
  }

  next.jobs[index] = job;
  return { ok: true, ledger: next, job };
}

function step(stage, result, extra = {}) {
  return {
    stage,
    result,
    ...extra,
  };
}

function summarizeSteps(steps) {
  return steps.map((item) => item.result).join(" -> ");
}

function jobById(ledger, jobId) {
  return (ledger?.jobs || []).find((job) => job.job_id === jobId);
}

function activeOwnerMatches({ job, runner }) {
  const claimedBy = String(job?.claimed_by || "").trim().toLowerCase();
  const tokens = [runner.id, runner.emoji, runner.agent_id, runner.name]
    .map((token) => String(token || "").trim().toLowerCase())
    .filter(Boolean);
  return Boolean(claimedBy) && tokens.includes(claimedBy);
}

function claimBlock({ ledger, job, reason, steps }) {
  return {
    ok: true,
    action: "pipeline",
    result: "blocker",
    stage: "claim",
    reason,
    job_id: job?.job_id || null,
    ledger,
    job,
    steps,
    summary: summarizeSteps(steps),
  };
}

export async function executeCodingRoomPipeline({
  ledger,
  jobId,
  runner = DEFAULT_CODING_ROOM_RUNNER,
  pr,
  reviews,
  requiredReviewers,
  fallbackEvidence,
  allowDraftLift = false,
  allowlist = DEFAULT_PROOF_COMMAND_ALLOWLIST,
  cwd = process.cwd(),
  applyPatch = runGitApplyPatch,
  runCommand = runProofCommand,
  now = new Date().toISOString(),
  leaseSeconds,
  proofTimeoutMs = 120000,
  buildDryRun = false,
} = {}) {
  const safeRunner = createCodingRoomRunner(runner);
  let working = createCodingRoomJobLedger({
    jobs: ledger?.jobs || [],
    updatedAt: ledger?.updated_at || now,
  });
  const steps = [];
  let job;

  if (jobId) {
    job = jobById(working, jobId);
    if (!job) {
      steps.push(step("claim", "claim_blocked", { reason: "missing_job", job_id: jobId }));
      return {
        ok: false,
        action: "pipeline",
        result: "blocker",
        stage: "claim",
        reason: "missing_job",
        job_id: jobId,
        ledger: working,
        steps,
        summary: summarizeSteps(steps),
      };
    }

    if (job.status === "queued") {
      const claimed = claimCodingRoomLedgerJob({
        ledger: working,
        jobId,
        runner: safeRunner,
        now,
        leaseSeconds,
      });
      if (!claimed.ok) {
        steps.push(step("claim", "claim_blocked", { reason: claimed.reason, file: claimed.file || null }));
        return claimBlock({
          ledger: working,
          job,
          reason: claimed.reason,
          steps,
        });
      }

      working = claimed.ledger;
      job = claimed.job;
      steps.push(step("claim", "claimed", { job_id: job.job_id, claim_id: job.claim_id }));
    } else if (["claimed", "building", "testing"].includes(job.status)) {
      if (!activeOwnerMatches({ job, runner: safeRunner })) {
        steps.push(step("claim", "claim_blocked", { reason: "active_job_not_owned_by_runner", status: job.status }));
        return claimBlock({
          ledger: working,
          job,
          reason: "active_job_not_owned_by_runner",
          steps,
        });
      }

      steps.push(step("claim", "already_claimed", { job_id: job.job_id, status: job.status }));
    } else {
      steps.push(step("claim", "claim_blocked", { reason: "non_runnable_job_status", status: job.status }));
      return claimBlock({
        ledger: working,
        job,
        reason: "non_runnable_job_status",
        steps,
      });
    }
  } else {
    const claimed = runCodingRoomRunnerCycle({
      ledger: working,
      runner: safeRunner,
      now,
      leaseSeconds,
    });
    working = claimed.ledger || working;
    if (!claimed.ok) {
      steps.push(step("claim", "claim_blocked", { reason: claimed.reason }));
      return {
        ok: false,
        action: "pipeline",
        result: "blocker",
        stage: "claim",
        reason: claimed.reason,
        ledger: working,
        steps,
        summary: summarizeSteps(steps),
      };
    }

    if (claimed.action === "idle") {
      steps.push(step("claim", "idle", { reason: claimed.reason, skipped: claimed.skipped || [] }));
      return {
        ok: true,
        action: "pipeline",
        result: "idle",
        reason: claimed.reason,
        ledger: working,
        steps,
        summary: summarizeSteps(steps),
      };
    }

    job = claimed.job;
    steps.push(step("claim", "claimed", { job_id: job.job_id, claim_id: job.claim_id }));
  }

  if (job.job_type && job.job_type !== "code") {
    steps.push(step("build", "build_blocked", { reason: "not_code_job", job_type: job.job_type }));
    return claimBlock({
      ledger: working,
      job,
      reason: "not_code_job",
      steps,
    });
  }

  const build = await executeCodingRoomBuildJob({
    job,
    cwd,
    applyPatch,
    now,
    dryRun: buildDryRun,
  });
  if (!build.ok || !build.job) {
    steps.push(step("build", "build_blocked", { reason: build.reason || "build_failed" }));
    return {
      ok: false,
      action: "pipeline",
      result: "blocker",
      stage: "build",
      reason: build.reason || "build_failed",
      job_id: job.job_id,
      ledger: working,
      steps,
      summary: summarizeSteps(steps),
    };
  }

  const built = replaceJob(working, build.job, now);
  working = built.ok ? built.ledger : working;
  job = build.job;
  if (build.result === "blocker") {
    steps.push(step("build", "build_blocked", { reason: build.blocker || build.reason }));
    return {
      ok: true,
      action: "pipeline",
      result: "blocker",
      stage: "build",
      reason: build.reason,
      blocker: build.blocker,
      job_id: job.job_id,
      ledger: working,
      job,
      steps,
      summary: summarizeSteps(steps),
    };
  }

  steps.push(step("build", buildDryRun ? "build_dry_run" : "built", { changed_files: build.changed_files || [] }));

  if (buildDryRun) {
    return {
      ok: true,
      action: "pipeline",
      result: "planned",
      stage: "build",
      reason: "build_dry_run",
      job_id: job.job_id,
      ledger: working,
      job,
      steps,
      summary: summarizeSteps(steps),
    };
  }

  const proof = await executeCodingRoomProofJob({
    job,
    allowlist,
    cwd,
    timeoutMs: proofTimeoutMs,
    runCommand,
    now,
  });
  if (!proof.ok || !proof.job) {
    steps.push(step("proof", "proof_blocked", { reason: proof.reason || "proof_failed" }));
    return {
      ok: false,
      action: "pipeline",
      result: "blocker",
      stage: "proof",
      reason: proof.reason || "proof_failed",
      job_id: job.job_id,
      ledger: working,
      steps,
      summary: summarizeSteps(steps),
    };
  }

  const proved = replaceJob(working, proof.job, now);
  working = proved.ok ? proved.ledger : working;
  job = proof.job;
  if (proof.result === "blocker") {
    steps.push(step("proof", "proof_blocked", { reason: proof.reason || "proof_blocker" }));
    return {
      ok: true,
      action: "pipeline",
      result: "blocker",
      stage: "proof",
      reason: proof.reason,
      job_id: job.job_id,
      ledger: working,
      job,
      steps,
      summary: summarizeSteps(steps),
    };
  }

  steps.push(step("proof", "proved", { tests: proof.tests || [] }));

  if (!pr) {
    steps.push(step("merge", "merge_not_checked", { reason: "missing_pr" }));
    return {
      ok: true,
      action: "pipeline",
      result: "proof_submitted",
      stage: "proof",
      reason: "missing_pr",
      job_id: job.job_id,
      ledger: working,
      job,
      steps,
      summary: summarizeSteps(steps),
    };
  }

  const merge = evaluateMergeRoom({
    pr,
    ledger: working,
    reviews,
    requiredReviewers,
    fallbackEvidence,
    allowDraftLift,
  });
  steps.push(
    step("merge", merge.ok ? merge.result : "merge_blocked", {
      reason: merge.reason,
      missing_reviewers: merge.missing_reviewers || [],
      failed_checks: merge.failed_checks || [],
      draft_lift_required: merge.draft_lift_required || false,
      execute: false,
    }),
  );

  return {
    ok: true,
    action: "pipeline",
    result: merge.ok ? merge.result : "blocker",
    stage: "merge",
    reason: merge.reason,
    job_id: job.job_id,
    ledger: working,
    job,
    merge,
    steps,
    summary: summarizeSteps(steps),
  };
}

export async function readPipelineExecutorInput(filePath) {
  if (!filePath) {
    return { ok: false, reason: "missing_input_path" };
  }

  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function executeCodingRoomPipelineFile({
  ledgerPath,
  inputPath,
  jobId,
  runner = createCodingRoomRunnerFromEnv(),
  allowlist = DEFAULT_PROOF_COMMAND_ALLOWLIST,
  cwd = process.cwd(),
  applyPatch = runGitApplyPatch,
  runCommand = runProofCommand,
  now = new Date().toISOString(),
  leaseSeconds,
  proofTimeoutMs = 120000,
  buildDryRun = false,
  dryRun = false,
} = {}) {
  if (!ledgerPath) {
    return { ok: false, reason: "missing_ledger_path" };
  }

  const ledger = await readCodingRoomJobLedger(ledgerPath);
  const input = inputPath ? await readPipelineExecutorInput(inputPath) : {};
  const result = await executeCodingRoomPipeline({
    ...input,
    ledger,
    jobId: jobId || input.jobId,
    runner: input.runner || runner,
    allowlist: input.allowlist || allowlist,
    cwd,
    now,
    leaseSeconds,
    proofTimeoutMs,
    buildDryRun: buildDryRun || dryRun,
    applyPatch,
    runCommand,
  });

  if (result.ok && !dryRun) {
    await writeCodingRoomJobLedger(ledgerPath, result.ledger);
  }

  return {
    ...result,
    dry_run: dryRun,
    ledger_path: ledgerPath,
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  executeCodingRoomPipelineFile({
    ledgerPath: getArg("ledger", process.env.CODING_ROOM_LEDGER_PATH || ""),
    inputPath: getArg("input", process.env.PINBALLWAKE_PIPELINE_INPUT || ""),
    jobId: getArg("job-id", process.env.CODING_ROOM_JOB_ID || ""),
    allowlist: parseList(process.env.CODING_ROOM_PROOF_ALLOWLIST, DEFAULT_PROOF_COMMAND_ALLOWLIST),
    leaseSeconds: parseIntOption(getArg("lease-seconds", process.env.CODING_ROOM_LEASE_SECONDS), undefined),
    proofTimeoutMs: parseIntOption(getArg("proof-timeout-ms", process.env.CODING_ROOM_PROOF_TIMEOUT_MS), 120000),
    buildDryRun: process.argv.includes("--build-dry-run") || parseBoolean(process.env.CODING_ROOM_BUILD_DRY_RUN),
    dryRun: process.argv.includes("--dry-run") || parseBoolean(process.env.PINBALLWAKE_PIPELINE_DRY_RUN),
  })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
