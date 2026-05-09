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

function text(value) {
  return String(value ?? "").trim();
}

function normalize(value) {
  return text(value).toLowerCase();
}

function compactText(value, max = 700) {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  return raw.length > max ? `${raw.slice(0, max - 3)}...` : raw;
}

function runName(run = {}) {
  return text(run.workflowName || run.name || run.context || "unknown");
}

function runState(run = {}) {
  return normalize(run.state || run.status);
}

function runConclusion(run = {}) {
  return normalize(run.conclusion || run.result || run.state);
}

function runPassed(run = {}) {
  const conclusion = runConclusion(run);
  if (conclusion) return conclusion === "success" || conclusion === "skipped";
  return runState(run) === "completed";
}

function runPending(run = {}) {
  return ["queued", "in_progress", "waiting", "requested", "pending"].includes(runState(run));
}

function findRun(runs = [], expected = "") {
  const needle = normalize(expected);
  return safeList(runs).find((run) => normalize(runName(run)).includes(needle));
}

function deploymentPassed(deployment = {}) {
  const state = normalize(deployment.state || deployment.status || deployment.readyState);
  return ["ready", "success", "deployed", "completed"].includes(state);
}

function deploymentPending(deployment = {}) {
  const state = normalize(deployment.state || deployment.status || deployment.readyState);
  return ["pending", "queued", "building", "in_progress", "initializing"].includes(state);
}

function smokePassed(check = {}) {
  return normalize(check.status || check.result || check.state) === "passed" || check.ok === true;
}

function smokePending(check = {}) {
  return ["pending", "queued", "running", "in_progress"].includes(normalize(check.status || check.state));
}

export function evaluatePublishRoom({
  pr,
  mergeCommit,
  runs = [],
  deployments = [],
  smokeChecks = [],
  requiredWorkflows = ["CI", "Publish MCP server"],
  requireDeployment = true,
  requireSmoke = false,
} = {}) {
  const prNumber = pr?.number ?? pr?.pr_number ?? null;
  const commit = text(mergeCommit?.oid || mergeCommit || pr?.merge_commit);
  const steps = [];

  if (!commit) {
    return {
      ok: false,
      action: "publish_room",
      result: "blocker",
      reason: "missing_merge_commit",
      pr_number: prNumber,
      steps: [{ stage: "intake", result: "blocker", reason: "missing_merge_commit" }],
    };
  }

  steps.push({ stage: "intake", result: "merge_commit_loaded", commit });

  const workflow_results = requiredWorkflows.map((workflow) => {
    const run = findRun(runs, workflow);
    if (!run) return { workflow, result: "missing" };
    if (runPending(run)) return { workflow, result: "pending", url: run.url || "", run_id: run.databaseId || run.id || null };
    if (!runPassed(run)) return { workflow, result: "failed", conclusion: run.conclusion || run.state || "", url: run.url || "" };
    return { workflow, result: "passed", url: run.url || "", run_id: run.databaseId || run.id || null };
  });

  const deployment_results = safeList(deployments).map((deployment) => {
    if (deploymentPending(deployment)) return { name: deployment.name || deployment.url || "deployment", result: "pending", url: deployment.url || deployment.targetUrl || "" };
    if (!deploymentPassed(deployment)) return { name: deployment.name || deployment.url || "deployment", result: "failed", state: deployment.state || deployment.status || "", url: deployment.url || deployment.targetUrl || "" };
    return { name: deployment.name || deployment.url || "deployment", result: "passed", url: deployment.url || deployment.targetUrl || "" };
  });

  const smoke_results = safeList(smokeChecks).map((check) => {
    if (smokePending(check)) return { name: check.name || "smoke", result: "pending", detail: check.detail || "" };
    if (!smokePassed(check)) return { name: check.name || "smoke", result: "failed", detail: check.detail || check.error || "" };
    return { name: check.name || "smoke", result: "passed", detail: check.detail || "" };
  });

  const failed = [
    ...workflow_results.filter((item) => item.result === "failed"),
    ...deployment_results.filter((item) => item.result === "failed"),
    ...smoke_results.filter((item) => item.result === "failed"),
  ];
  const pending = [
    ...workflow_results.filter((item) => item.result === "pending" || item.result === "missing"),
    ...(requireDeployment && deployment_results.length === 0 ? [{ name: "deployment", result: "missing" }] : []),
    ...deployment_results.filter((item) => item.result === "pending"),
    ...(requireSmoke && smoke_results.length === 0 ? [{ name: "smoke", result: "missing" }] : []),
    ...smoke_results.filter((item) => item.result === "pending"),
  ];

  if (failed.length > 0) {
    steps.push({ stage: "publish", result: "blocker", failed });
    return {
      ok: false,
      action: "publish_room",
      result: "blocker",
      reason: "publish_failed",
      pr_number: prNumber,
      merge_commit: commit,
      failed,
      repair_packet: {
        worker: "forge",
        chip: `Repair publish failure for PR #${prNumber ?? "unknown"}`,
        context: compactText(failed.map((item) => `${item.workflow || item.name}: ${item.conclusion || item.state || item.detail || "failed"}`).join("; ")),
        expected_proof: "Fix the failed publish/deploy/smoke check and rerun the relevant proof.",
        deadline: "next builder pulse",
        ack: "done/blocker",
      },
      workflow_results,
      deployment_results,
      smoke_results,
      steps,
    };
  }

  if (pending.length > 0) {
    steps.push({ stage: "publish", result: "waiting", pending });
    return {
      ok: true,
      action: "publish_room",
      result: "waiting",
      reason: "publish_checks_pending",
      pr_number: prNumber,
      merge_commit: commit,
      pending,
      workflow_results,
      deployment_results,
      smoke_results,
      steps,
    };
  }

  steps.push({ stage: "publish", result: "published" });
  return {
    ok: true,
    action: "publish_room",
    result: "published",
    reason: "release_live_green",
    pr_number: prNumber,
    merge_commit: commit,
    receipt: {
      title: compactText(pr?.title || `PR #${prNumber ?? "unknown"}`),
      status: "published",
      proof: [...workflow_results, ...deployment_results, ...smoke_results].map((item) => `${item.workflow || item.name}: ${item.result}`),
    },
    workflow_results,
    deployment_results,
    smoke_results,
    steps,
  };
}

export async function readPublishRoomInput(filePath) {
  if (!filePath) return { ok: false, reason: "missing_input_path" };
  return JSON.parse(await readFile(filePath, "utf8"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  readPublishRoomInput(getArg("input", process.env.PINBALLWAKE_PUBLISH_ROOM_INPUT || ""))
    .then((input) => evaluatePublishRoom(input))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
