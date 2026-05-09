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

function compactText(value, max = 700) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function chooseWorker(failures = []) {
  const text = failures.map((failure) => `${failure.workflow || failure.name || ""} ${failure.detail || failure.error || failure.conclusion || ""}`).join(" ").toLowerCase();
  if (text.includes("hold") || text.includes("safety") || text.includes("secret") || text.includes("security")) return "gatekeeper";
  if (text.includes("qc") || text.includes("visual") || text.includes("copy")) return "popcorn";
  if (text.includes("testpass") || text.includes("xpass") || text.includes("credential")) return "xpass";
  return "forge";
}

function severityFor(failures = []) {
  const text = failures.map((failure) => `${failure.workflow || failure.name || ""} ${failure.detail || failure.error || failure.conclusion || ""}`).join(" ").toLowerCase();
  if (text.includes("prod") || text.includes("security") || text.includes("secret") || text.includes("data loss")) return "critical";
  if (text.includes("publish") || text.includes("deploy") || text.includes("ci") || text.includes("test")) return "high";
  return "medium";
}

export function createRepairRoomPacket({
  pr,
  mergeCommit,
  failures = [],
  source = "post_merge_watch",
  ownedFiles = [],
} = {}) {
  const items = safeList(failures);
  if (items.length === 0) {
    return {
      ok: true,
      action: "repair_room",
      result: "no_repair_needed",
      reason: "no_failures",
    };
  }

  const severity = severityFor(items);
  const worker = chooseWorker(items);
  const prNumber = pr?.number ?? pr?.pr_number ?? null;
  const context = compactText(
    items.map((failure) => `${failure.workflow || failure.name || "check"}: ${failure.detail || failure.error || failure.conclusion || failure.result || "failed"}`).join("; "),
  );

  return {
    ok: true,
    action: "repair_room",
    result: "repair_packet",
    severity,
    source,
    packet: {
      worker,
      chip: `${severity.toUpperCase()} repair for ${prNumber ? `PR #${prNumber}` : "latest release"}`,
      context,
      owned_files_hint: safeList(ownedFiles),
      expected_proof: "Patch only the failing surface, rerun the failed proof, and report done/blocker with exact output.",
      deadline: severity === "critical" ? "immediate" : "next builder pulse",
      ack: "done/blocker",
    },
    merge_commit: mergeCommit?.oid || mergeCommit || null,
  };
}

export async function readRepairRoomInput(filePath) {
  if (!filePath) return { ok: false, reason: "missing_input_path" };
  return JSON.parse(await readFile(filePath, "utf8"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  readRepairRoomInput(getArg("input", process.env.PINBALLWAKE_REPAIR_ROOM_INPUT || ""))
    .then((input) => createRepairRoomPacket(input))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
