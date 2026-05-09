#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import {
  createCodingRoomJobLedger,
  runnerCanClaimCodingRoomJob,
} from "./pinballwake-coding-room.mjs";
import {
  DEFAULT_CODING_ROOM_RUNNER,
  chooseClaimableCodingRoomJob,
  createCodingRoomRunner,
} from "./pinballwake-coding-room-runner.mjs";
import { validateCodingRoomBuildPatch } from "./pinballwake-build-executor.mjs";
import {
  DEFAULT_PROOF_COMMAND_ALLOWLIST,
  getProofCommandsForJob,
  isProofCommandAllowed,
} from "./pinballwake-proof-executor.mjs";
import { evaluateMergeRoom } from "./pinballwake-merge-room.mjs";

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function compactReason(value) {
  return String(value || "").trim() || "unknown";
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

function isCodeJob(job = {}) {
  return !job.job_type || job.job_type === "code";
}

const ACTIVE_RUNNABLE_STATUSES = new Set(["claimed", "building", "testing"]);

function runnerTokens(runner = {}) {
  return [runner.id, runner.emoji, runner.agent_id, runner.name]
    .map((token) => String(token || "").trim().toLowerCase())
    .filter(Boolean);
}

function activeJobOwnerMatchesRunner({ job, runner }) {
  const claimedBy = String(job?.claimed_by || "").trim().toLowerCase();
  return Boolean(claimedBy) && runnerTokens(runner).includes(claimedBy);
}

function buildBlocker(stage, reason, extra = {}) {
  return {
    ok: true,
    action: "dry_run",
    result: "blocker",
    stage,
    reason: compactReason(reason),
    steps: [step(stage, "blocker", { reason: compactReason(reason), ...extra })],
    summary: "blocker",
  };
}

function mergeResultStep(decision) {
  if (decision.ok) {
    return step("merge", decision.result, {
      reason: decision.reason,
      pr_number: decision.pr_number,
      draft_lift_required: decision.draft_lift_required || false,
      execute: false,
    });
  }

  return step("merge", "merge_blocked", {
    reason: decision.reason,
    missing_reviewers: decision.missing_reviewers || [],
    failed_checks: decision.failed_checks || [],
  });
}

export function planCodingRoomPipelineDryRun({
  ledger,
  jobId,
  runner = DEFAULT_CODING_ROOM_RUNNER,
  allowlist = DEFAULT_PROOF_COMMAND_ALLOWLIST,
  pr,
  proofJob,
  reviews,
  requiredReviewers,
  fallbackEvidence,
  allowDraftLift = false,
} = {}) {
  const safeLedger = createCodingRoomJobLedger({
    jobs: cloneJson(ledger?.jobs || []),
    updatedAt: ledger?.updated_at,
  });
  const safeRunner = createCodingRoomRunner(runner);
  const steps = [];

  let job = jobId ? jobById(safeLedger, jobId) : null;
  let skipped = [];

  if (jobId && !job) {
    return buildBlocker("claim", "missing_job", { job_id: jobId });
  }

  if (!job) {
    const choice = chooseClaimableCodingRoomJob({ ledger: safeLedger, runner: safeRunner });
    skipped = choice.skipped || [];
    if (!choice.ok) {
      steps.push(step("claim", "idle", { reason: choice.reason, skipped }));
      return {
        ok: true,
        action: "dry_run",
        result: "idle",
        reason: choice.reason,
        skipped,
        steps,
        summary: summarizeSteps(steps),
        ledger: safeLedger,
      };
    }

    job = choice.job;
  }

  if (job.status === "queued") {
    const claim = runnerCanClaimCodingRoomJob({
      runner: safeRunner,
      job,
      activeJobs: safeLedger.jobs || [],
    });
    if (!claim.ok) {
      steps.push(step("claim", "claim_blocked", { reason: claim.reason, file: claim.file || null }));
      return {
        ok: true,
        action: "dry_run",
        result: "blocker",
        stage: "claim",
        reason: claim.reason,
        job_id: job.job_id,
        steps,
        summary: summarizeSteps(steps),
        ledger: safeLedger,
      };
    }

    steps.push(step("claim", "would_claim", { reason: claim.reason, job_id: job.job_id }));
  } else if (ACTIVE_RUNNABLE_STATUSES.has(job.status)) {
    if (!activeJobOwnerMatchesRunner({ job, runner: safeRunner })) {
      steps.push(step("claim", "claim_blocked", { reason: "active_job_not_owned_by_runner", status: job.status }));
      return {
        ok: true,
        action: "dry_run",
        result: "blocker",
        stage: "claim",
        reason: "active_job_not_owned_by_runner",
        job_id: job.job_id,
        steps,
        summary: summarizeSteps(steps),
        ledger: safeLedger,
      };
    }

    steps.push(step("claim", "already_in_progress", { status: job.status, job_id: job.job_id }));
  } else {
    steps.push(step("claim", "claim_blocked", { reason: "non_runnable_job_status", status: job.status }));
    return {
      ok: true,
      action: "dry_run",
      result: "blocker",
      stage: "claim",
      reason: "non_runnable_job_status",
      status: job.status,
      job_id: job.job_id,
      steps,
      summary: summarizeSteps(steps),
      ledger: safeLedger,
    };
  }

  if (!isCodeJob(job)) {
    steps.push(step("build", "build_skipped", { reason: "not_code_job", job_type: job.job_type }));
  } else {
    const patch = job.build?.patch || "";
    const build = validateCodingRoomBuildPatch({
      patch,
      ownedFiles: job.owned_files || [],
    });
    if (!build.ok) {
      steps.push(step("build", "build_blocked", { reason: build.reason, file: build.file || null }));
      return {
        ok: true,
        action: "dry_run",
        result: "blocker",
        stage: "build",
        reason: build.reason,
        job_id: job.job_id,
        steps,
        summary: summarizeSteps(steps),
        ledger: safeLedger,
      };
    }

    steps.push(step("build", "build_would_validate_patch", { changed_files: build.changed_files }));
  }

  const proofCommands = getProofCommandsForJob(job);
  if (proofCommands.length === 0) {
    steps.push(step("proof", "proof_blocked", { reason: "missing_proof_commands" }));
    return {
      ok: true,
      action: "dry_run",
      result: "blocker",
      stage: "proof",
      reason: "missing_proof_commands",
      job_id: job.job_id,
      steps,
      summary: summarizeSteps(steps),
      ledger: safeLedger,
    };
  }

  const disallowed = proofCommands.find((command) => !isProofCommandAllowed(command, allowlist));
  if (disallowed) {
    steps.push(step("proof", "proof_blocked", { reason: "proof_command_not_allowlisted", command: disallowed }));
    return {
      ok: true,
      action: "dry_run",
      result: "blocker",
      stage: "proof",
      reason: "proof_command_not_allowlisted",
      command: disallowed,
      job_id: job.job_id,
      steps,
      summary: summarizeSteps(steps),
      ledger: safeLedger,
    };
  }

  steps.push(step("proof", "proof_would_run", { commands: proofCommands }));

  if (!pr) {
    steps.push(step("merge", "merge_not_checked", { reason: "missing_pr" }));
    return {
      ok: true,
      action: "dry_run",
      result: "planned",
      stage: "proof",
      reason: "missing_pr",
      job_id: job.job_id,
      steps,
      summary: summarizeSteps(steps),
      ledger: safeLedger,
    };
  }

  const readiness = evaluateMergeRoom({
    pr,
    ledger: safeLedger,
    proofJob,
    reviews,
    requiredReviewers,
    fallbackEvidence,
    allowDraftLift,
  });
  steps.push(mergeResultStep(readiness));

  return {
    ok: true,
    action: "dry_run",
    result: readiness.ok ? readiness.result : "blocker",
    stage: "merge",
    reason: readiness.reason,
    job_id: job.job_id,
    steps,
    summary: summarizeSteps(steps),
    merge: readiness,
    ledger: safeLedger,
  };
}

export async function readPipelineDryRunInput(filePath) {
  if (!filePath) {
    return { ok: false, reason: "missing_input_path" };
  }

  return JSON.parse(await readFile(filePath, "utf8"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  readPipelineDryRunInput(getArg("input", process.env.PINBALLWAKE_PIPELINE_INPUT || ""))
    .then((input) => planCodingRoomPipelineDryRun(input))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
