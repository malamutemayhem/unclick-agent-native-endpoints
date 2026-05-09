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

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function compactText(value, max = 700) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function severityFor(signals = []) {
  const text = signals.map((signal) => `${signal.kind || signal.name || ""} ${signal.detail || signal.error || signal.status || ""}`).join(" ").toLowerCase();
  if (text.includes("secret") || text.includes("security") || text.includes("data loss") || text.includes("outage")) return "critical";
  if (text.includes("publish") || text.includes("deploy") || text.includes("ci") || text.includes("testpass")) return "high";
  return "medium";
}

export function evaluateRollbackRoom({
  pr,
  mergeCommit,
  previousDeployment,
  failureSignals = [],
  execute = false,
  approval = "",
} = {}) {
  const signals = safeList(failureSignals);
  const prNumber = pr?.number ?? pr?.pr_number ?? null;
  const commit = mergeCommit?.oid || mergeCommit || pr?.merge_commit || null;

  if (signals.length === 0) {
    return {
      ok: true,
      action: "rollback_room",
      result: "no_rollback_needed",
      reason: "no_failure_signals",
      pr_number: prNumber,
    };
  }

  const severity = severityFor(signals);
  const plan = {
    strategy: previousDeployment ? "promote_previous_deployment_or_revert_pr" : "revert_pr_commit",
    steps: [
      "Stop new dependent merges.",
      previousDeployment ? "Prefer promoting the previous known-good deployment if production is affected." : "Prepare a GitHub revert PR for the merge commit.",
      "Create a repair packet for the root cause.",
      "Run post-rollback publish checks before declaring recovery.",
    ],
    command_intent: commit ? `revert merge commit ${commit}` : `revert PR #${prNumber ?? "unknown"}`,
    previous_deployment: previousDeployment || null,
  };

  if (!execute) {
    return {
      ok: true,
      action: "rollback_room",
      result: "rollback_advisory",
      reason: "approval_required",
      severity,
      pr_number: prNumber,
      merge_commit: commit,
      plan,
      approval_required: true,
    };
  }

  if (normalize(approval) !== "rollback-approved") {
    return {
      ok: false,
      action: "rollback_room",
      result: "blocker",
      reason: "rollback_approval_required",
      severity,
      pr_number: prNumber,
      merge_commit: commit,
      plan,
    };
  }

  return {
    ok: true,
    action: "rollback_room",
    result: "rollback_execute_authorized",
    reason: "explicit_approval_present",
    severity,
    pr_number: prNumber,
    merge_commit: commit,
    plan,
    packet: {
      worker: "gatekeeper/master",
      chip: `Execute rollback for PR #${prNumber ?? "unknown"}`,
      context: compactText(signals.map((signal) => `${signal.kind || signal.name || "signal"}: ${signal.detail || signal.error || signal.status || "failed"}`).join("; ")),
      expected_proof: "Rollback/revert is complete and post-rollback publish checks pass.",
      deadline: severity === "critical" ? "immediate" : "next release pulse",
      ack: "done/blocker",
    },
  };
}

export async function readRollbackRoomInput(filePath) {
  if (!filePath) return { ok: false, reason: "missing_input_path" };
  return JSON.parse(await readFile(filePath, "utf8"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  readRollbackRoomInput(getArg("input", process.env.PINBALLWAKE_ROLLBACK_ROOM_INPUT || ""))
    .then((input) => evaluateRollbackRoom(input))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
