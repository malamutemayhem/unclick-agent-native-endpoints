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

function compactText(value, max = 500) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function prNumber(pr = {}) {
  const parsed = Number.parseInt(String(pr.number ?? pr.pr_number ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasGreenChecks(pr = {}) {
  const checks = safeList(pr.statusCheckRollup || pr.checks);
  return checks.length > 0 && checks.every((check) => {
    const conclusion = String(check.conclusion || check.state || "").toUpperCase();
    const status = String(check.status || "").toUpperCase();
    return conclusion === "SUCCESS" || conclusion === "SKIPPED" || status === "COMPLETED";
  });
}

export function evaluateCloseSupersedeRoom({
  pr,
  supersededBy,
  mainContainsChange = false,
  ownerDecision = "",
} = {}) {
  const number = prNumber(pr);
  if (!pr) {
    return { ok: false, action: "close_supersede_room", result: "blocker", reason: "missing_pr" };
  }

  const decision = normalize(ownerDecision || pr.owner_decision || pr.priority);
  if (decision === "keep" || decision === "survivor" || decision === "primary") {
    return {
      ok: true,
      action: "close_supersede_room",
      result: "keep",
      reason: "owner_marked_primary",
      pr_number: number,
    };
  }

  if (decision === "close" || decision === "superseded" || mainContainsChange) {
    return {
      ok: true,
      action: "close_supersede_room",
      result: "ready_to_close",
      reason: mainContainsChange ? "change_already_on_main" : "owner_marked_superseded",
      pr_number: number,
      execute: false,
      close_comment: compactText(
        `Closing/superseding PR #${number ?? "unknown"} because ${supersededBy ? `PR #${supersededBy} is the survivor lane` : "the change is already covered"}.`,
      ),
    };
  }

  if (supersededBy) {
    return {
      ok: true,
      action: "close_supersede_room",
      result: "hold_rebase_or_close",
      reason: "superseded_by_survivor",
      pr_number: number,
      superseded_by: supersededBy,
      packet: {
        worker: "owner/xpass",
        chip: `Decide close/rebase for PR #${number}`,
        context: compactText(`PR #${number} overlaps survivor PR #${supersededBy}.`),
        expected_proof: "Reply close/rebase/keep with reason and proof if rebased.",
        deadline: "next owner pulse",
        ack: "done/blocker",
      },
    };
  }

  if (!hasGreenChecks(pr)) {
    return {
      ok: true,
      action: "close_supersede_room",
      result: "hold",
      reason: "checks_not_green",
      pr_number: number,
    };
  }

  return {
    ok: true,
    action: "close_supersede_room",
    result: "needs_owner_decision",
    reason: "no_close_or_keep_signal",
    pr_number: number,
  };
}

export async function readCloseSupersedeRoomInput(filePath) {
  if (!filePath) return { ok: false, reason: "missing_input_path" };
  return JSON.parse(await readFile(filePath, "utf8"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  readCloseSupersedeRoomInput(getArg("input", process.env.PINBALLWAKE_CLOSE_SUPERSEDE_ROOM_INPUT || ""))
    .then((input) => evaluateCloseSupersedeRoom(input))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
