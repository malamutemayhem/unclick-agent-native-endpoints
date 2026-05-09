#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

import {
  evaluateMergeReadiness,
  runGhMerge,
} from "./pinballwake-merge-controller.mjs";

function parseBoolean(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function compactText(value, max = 800) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function prNumber(pr = {}) {
  const parsed = Number.parseInt(String(pr.number ?? pr.pr_number ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function nonDraftPr(pr = {}) {
  return {
    ...pr,
    isDraft: false,
    draft: false,
  };
}

function normalizeSignal(value) {
  return String(value ?? "").trim().toLowerCase();
}

function hasActiveHoldOrBlocker(pr = {}) {
  return Boolean(pr.hasHold || pr.hold || (Array.isArray(pr.blockers) && pr.blockers.length > 0));
}

function summarizeMergeRoomSteps(steps) {
  return steps.map((step) => step.result).join(" -> ");
}

function step(stage, result, extra = {}) {
  return { stage, result, ...extra };
}

function fallbackEvidenceAccepted(evidence = {}) {
  if (!evidence) return false;
  return evidence.full_ack_set === true || normalizeSignal(evidence.master_decision) === "fallback_ready";
}

export function evaluateMergeRoom({
  pr,
  ledger,
  proofJob,
  reviews,
  requiredReviewers,
  fallbackEvidence,
  allowDraftLift = false,
} = {}) {
  const steps = [];

  if (!pr) {
    steps.push(step("intake", "blocker", { reason: "missing_pr" }));
    return {
      ok: false,
      action: "merge_room",
      result: "blocker",
      reason: "missing_pr",
      steps,
      summary: summarizeMergeRoomSteps(steps),
    };
  }

  const number = prNumber(pr);
  steps.push(step("intake", "pr_loaded", { pr_number: number }));

  if (hasActiveHoldOrBlocker(pr)) {
    steps.push(step("safety", "blocker", { reason: "active_hold_or_blocker" }));
    return {
      ok: false,
      action: "merge_room",
      result: "blocker",
      reason: "active_hold_or_blocker",
      pr_number: number,
      steps,
      summary: summarizeMergeRoomSteps(steps),
    };
  }

  const direct = evaluateMergeReadiness({
    pr,
    ledger,
    proofJob,
    reviews,
    requiredReviewers,
  });

  if (direct.ok) {
    steps.push(step("readiness", "merge_ready", { reason: direct.reason }));
    return {
      ...direct,
      action: "merge_room",
      result: "ready_to_merge",
      pr_number: number,
      draft_lift_required: false,
      execute_plan: ["merge", "watch_post_merge"],
      steps,
      summary: summarizeMergeRoomSteps(steps),
    };
  }

  if (direct.reason !== "pr_is_draft") {
    steps.push(step("readiness", "blocker", { reason: direct.reason }));
    return {
      ...direct,
      action: "merge_room",
      result: "blocker",
      pr_number: number,
      steps,
      summary: summarizeMergeRoomSteps(steps),
    };
  }

  steps.push(step("readiness", "draft_blocks_merge"));

  if (!allowDraftLift && !fallbackEvidenceAccepted(fallbackEvidence)) {
    steps.push(step("draft", "needs_master_lift", { reason: "draft_lift_not_authorized" }));
    return {
      ok: false,
      action: "merge_room",
      result: "needs_lift",
      reason: "draft_lift_not_authorized",
      pr_number: number,
      missing: ["master_lift_authorization"],
      steps,
      summary: summarizeMergeRoomSteps(steps),
    };
  }

  const afterLift = evaluateMergeReadiness({
    pr: nonDraftPr(pr),
    ledger,
    proofJob,
    reviews,
    requiredReviewers,
  });

  if (!afterLift.ok) {
    steps.push(step("draft", "lift_blocked", { reason: afterLift.reason }));
    return {
      ...afterLift,
      action: "merge_room",
      result: "blocker",
      pr_number: number,
      steps,
      summary: summarizeMergeRoomSteps(steps),
    };
  }

  steps.push(step("draft", "ready_to_lift"));
  steps.push(step("readiness", "merge_ready_after_lift", { reason: afterLift.reason }));

  return {
    ...afterLift,
    action: "merge_room",
    result: "ready_to_lift_and_merge",
    pr_number: number,
    draft_lift_required: true,
    execute_plan: ["lift_draft", "merge", "watch_post_merge"],
    fallback_used: fallbackEvidenceAccepted(fallbackEvidence),
    steps,
    summary: summarizeMergeRoomSteps(steps),
  };
}

export async function runGhReady({ prNumber: number, cwd = process.cwd() } = {}) {
  if (!number) {
    return { ok: false, exit_code: null, output: "Missing PR number" };
  }

  return new Promise((resolve) => {
    const child = spawn("gh", ["pr", "ready", String(number)], {
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
      resolve({ ok: false, exit_code: null, output: compactText(error.message) });
    });
    child.on("close", (code) => {
      resolve({ ok: code === 0, exit_code: code, output: compactText(`${stdout}\n${stderr}`) });
    });
  });
}

export async function executeMergeRoom({
  pr,
  ledger,
  proofJob,
  reviews,
  requiredReviewers,
  fallbackEvidence,
  allowDraftLift = false,
  execute = false,
  ready = runGhReady,
  merge = runGhMerge,
  cwd = process.cwd(),
} = {}) {
  const decision = evaluateMergeRoom({
    pr,
    ledger,
    proofJob,
    reviews,
    requiredReviewers,
    fallbackEvidence,
    allowDraftLift,
  });

  if (!decision.ok) {
    return decision;
  }

  if (!execute) {
    return {
      ...decision,
      execute: false,
      mode: "advisory",
    };
  }

  const number = decision.pr_number;
  const executeSteps = [...decision.steps];

  if (decision.draft_lift_required) {
    const lifted = await ready({ prNumber: number, cwd });
    if (!lifted.ok) {
      executeSteps.push(step("draft", "lift_failed", { output: lifted.output }));
      return {
        ok: false,
        action: "merge_room",
        result: "blocker",
        reason: "draft_lift_failed",
        pr_number: number,
        output: lifted.output,
        exit_code: lifted.exit_code,
        steps: executeSteps,
        summary: summarizeMergeRoomSteps(executeSteps),
      };
    }
    executeSteps.push(step("draft", "lifted"));
  }

  const merged = await merge({
    prNumber: number,
    cwd,
    subject: pr.mergeSubject || pr.title || "",
    body: pr.mergeBody || "",
  });
  if (!merged.ok) {
    executeSteps.push(step("merge", "merge_failed", { output: merged.output }));
    return {
      ok: false,
      action: "merge_room",
      result: "blocker",
      reason: "merge_command_failed",
      pr_number: number,
      output: merged.output,
      exit_code: merged.exit_code,
      steps: executeSteps,
      summary: summarizeMergeRoomSteps(executeSteps),
    };
  }

  executeSteps.push(step("merge", "merged"));
  executeSteps.push(step("post_merge", "watch_required"));

  return {
    ...decision,
    execute: true,
    result: "merged",
    output: merged.output,
    steps: executeSteps,
    summary: summarizeMergeRoomSteps(executeSteps),
  };
}

export async function readMergeRoomInput(filePath) {
  if (!filePath) {
    return { ok: false, reason: "missing_input_path" };
  }

  return JSON.parse(await readFile(filePath, "utf8"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  readMergeRoomInput(getArg("input", process.env.PINBALLWAKE_MERGE_ROOM_INPUT || ""))
    .then((input) =>
      executeMergeRoom({
        ...input,
        allowDraftLift: input.allowDraftLift || parseBoolean(process.env.PINBALLWAKE_MERGE_ROOM_ALLOW_DRAFT_LIFT),
        execute: process.argv.includes("--execute") || parseBoolean(process.env.PINBALLWAKE_MERGE_ROOM_EXECUTE),
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
