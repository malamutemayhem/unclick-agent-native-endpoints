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

function compactText(value, max = 500) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

export function createReleaseNotesRoomReceipt({
  pr,
  mergeCommit,
  proof = [],
  risks = [],
  nextActions = [],
  audience = "internal",
} = {}) {
  const prNumber = pr?.number ?? pr?.pr_number ?? null;
  if (!pr && !mergeCommit) {
    return { ok: false, action: "release_notes_room", result: "blocker", reason: "missing_release_context" };
  }

  const title = compactText(pr?.title || `Release ${mergeCommit?.oid || mergeCommit || ""}`, 140);
  const lines = [
    `Release receipt: ${title}`,
    prNumber ? `PR: #${prNumber}` : "",
    mergeCommit ? `Commit: ${mergeCommit?.oid || mergeCommit}` : "",
    "",
    "What changed:",
    compactText(pr?.summary || pr?.body_summary || pr?.body || "Change merged into the UnClick Autopilot lane.", 900),
    "",
    "Proof:",
    ...safeList(proof).map((item) => `- ${compactText(item, 220)}`),
    "",
    "Risk notes:",
    ...(safeList(risks).length ? safeList(risks).map((item) => `- ${compactText(item, 220)}`) : ["- No new release risk noted."]),
    "",
    "Next:",
    ...(safeList(nextActions).length ? safeList(nextActions).map((item) => `- ${compactText(item, 220)}`) : ["- Watch normal post-merge checks."]),
  ].filter((line) => line !== "");

  return {
    ok: true,
    action: "release_notes_room",
    result: "receipt",
    audience,
    pr_number: prNumber,
    merge_commit: mergeCommit?.oid || mergeCommit || null,
    receipt: lines.join("\n"),
  };
}

export async function readReleaseNotesRoomInput(filePath) {
  if (!filePath) return { ok: false, reason: "missing_input_path" };
  return JSON.parse(await readFile(filePath, "utf8"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  readReleaseNotesRoomInput(getArg("input", process.env.PINBALLWAKE_RELEASE_NOTES_ROOM_INPUT || ""))
    .then((input) => createReleaseNotesRoomReceipt(input))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
