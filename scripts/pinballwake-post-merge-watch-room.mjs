#!/usr/bin/env node

import { readFile } from "node:fs/promises";

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function safeList(value) {
  return Array.isArray(value) ? value : [];
}

function compactText(value, max = 800) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function runName(run = {}) {
  return String(run.workflowName || run.name || run.context || "unknown").trim();
}

function runStatus(run = {}) {
  return normalize(run.status || run.state);
}

function runConclusion(run = {}) {
  return normalize(run.conclusion || run.result || run.state);
}

function isRunSuccess(run = {}) {
  const conclusion = runConclusion(run);
  if (conclusion) {
    return conclusion === "success" || conclusion === "skipped";
  }

  return runStatus(run) === "completed" && ["success", "skipped"].includes(conclusion);
}

function isRunPending(run = {}) {
  const status = runStatus(run);
  return status === "queued" || status === "in_progress" || status === "waiting" || status === "requested";
}

function matchesExpected(run = {}, expectedName = "") {
  const expected = normalize(expectedName);
  if (!expected) return false;
  return normalize(runName(run)).includes(expected);
}

function latestMatchingRun(runs = [], expectedName = "") {
  return safeList(runs).find((run) => matchesExpected(run, expectedName));
}

export function evaluatePostMergeWatchRoom({
  pr,
  mergeCommit,
  runs = [],
  expectedWorkflows = ["CI", "Publish MCP server"],
  requireAllExpected = true,
} = {}) {
  const prNumber = pr?.number ?? pr?.pr_number ?? null;
  const commit = String(mergeCommit?.oid || mergeCommit || pr?.merge_commit || "").trim();
  const steps = [];

  if (!commit) {
    steps.push({ stage: "intake", result: "blocker", reason: "missing_merge_commit" });
    return {
      ok: false,
      action: "post_merge_watch_room",
      result: "blocker",
      reason: "missing_merge_commit",
      pr_number: prNumber,
      steps,
    };
  }

  steps.push({ stage: "intake", result: "merge_commit_loaded", commit });

  const workflowResults = expectedWorkflows.map((workflow) => {
    const run = latestMatchingRun(runs, workflow);
    if (!run) {
      return { workflow, result: "missing" };
    }
    if (isRunPending(run)) {
      return { workflow, result: "pending", run_id: run.databaseId || run.id || null, url: run.url || "" };
    }
    if (!isRunSuccess(run)) {
      return {
        workflow,
        result: "failed",
        run_id: run.databaseId || run.id || null,
        conclusion: run.conclusion || run.state || "",
        url: run.url || "",
      };
    }
    return { workflow, result: "passed", run_id: run.databaseId || run.id || null, url: run.url || "" };
  });

  const missing = workflowResults.filter((item) => item.result === "missing");
  const pending = workflowResults.filter((item) => item.result === "pending");
  const failed = workflowResults.filter((item) => item.result === "failed");

  if (failed.length > 0) {
    steps.push({ stage: "checks", result: "blocker", failed });
    return {
      ok: false,
      action: "post_merge_watch_room",
      result: "blocker",
      reason: "post_merge_check_failed",
      pr_number: prNumber,
      merge_commit: commit,
      failed,
      repair_packet: {
        worker: "forge",
        chip: `Repair post-merge failure for PR #${prNumber ?? "unknown"}`,
        context: compactText(failed.map((item) => `${item.workflow}: ${item.conclusion || "failed"}`).join("; ")),
        expected_proof: "Fix the failing post-merge check and rerun the failed workflow proof.",
        deadline: "next builder pulse",
        ack: "done/blocker",
      },
      workflow_results: workflowResults,
      steps,
    };
  }

  if (pending.length > 0 || (requireAllExpected && missing.length > 0)) {
    steps.push({ stage: "checks", result: "waiting", pending, missing });
    return {
      ok: true,
      action: "post_merge_watch_room",
      result: "waiting",
      reason: pending.length > 0 ? "post_merge_checks_pending" : "post_merge_checks_missing",
      pr_number: prNumber,
      merge_commit: commit,
      pending,
      missing,
      workflow_results: workflowResults,
      steps,
    };
  }

  steps.push({ stage: "checks", result: "passed" });
  return {
    ok: true,
    action: "post_merge_watch_room",
    result: "passed",
    reason: "post_merge_green",
    pr_number: prNumber,
    merge_commit: commit,
    workflow_results: workflowResults,
    steps,
  };
}

export async function readPostMergeWatchRoomInput(filePath) {
  if (!filePath) {
    return { ok: false, reason: "missing_input_path" };
  }

  return JSON.parse(await readFile(filePath, "utf8"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  readPostMergeWatchRoomInput(getArg("input", process.env.PINBALLWAKE_POST_MERGE_WATCH_INPUT || ""))
    .then((input) => evaluatePostMergeWatchRoom(input))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
