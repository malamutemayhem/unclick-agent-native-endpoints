#!/usr/bin/env node
// scripts/check-dirty-branch.mjs
//
// Chip-firer dirty-branch hygiene check.
//
// Closes UnClick todo "Chip-firer dirty-branch hygiene: 3 PRs in a row leaking
// api/memory-admin.ts + server.ts" (promoted by efficiency sweep 2026-05-07).
//
// What it does: scans a `git diff` (default: against origin/main) for "leak-prone"
// files that have a history of being accidentally included in unrelated PRs.
// If those files are touched AND the PR title/body doesn't reference them by
// name, the check flags it.
//
// Exit codes:
//   0 = clean (no leak-prone files touched, OR they're touched intentionally per scope)
//   1 = leak warning (leak-prone files touched without scope mention)
//   2 = usage/I/O error
//
// Usage (local pre-push):
//   node scripts/check-dirty-branch.mjs --base origin/main --pr-body-file ./pr-body.md
//   git diff --name-only origin/main | node scripts/check-dirty-branch.mjs --stdin --pr-body-file ./pr-body.md
//
// Usage (CI):
//   node scripts/check-dirty-branch.mjs --base origin/${GITHUB_BASE_REF} --pr-body "$PR_BODY"

import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

// Files known to leak across PRs. This list is the canonical leak-prone set,
// per the ScopePack on the chip-firer dirty-branch hygiene todo. Add to it as
// new leak patterns emerge.
export const LEAK_PRONE_FILES = [
  "api/memory-admin.ts",
  "server.ts",
];

// The PR scope is considered to reference a leak-prone file when the PR
// title or body contains the file name OR a recognised mnemonic.
const SCOPE_MENTION_PATTERNS = (file) => [
  new RegExp(escapeRegex(file), "i"),
  // Common short forms:
  ...(file === "api/memory-admin.ts" ? [/\bmemory[- ]?admin\b/i, /\bmemory[- ]?admin(?:\sAPI)?\b/i] : []),
  ...(file === "server.ts" ? [/\bserver\.ts\b/i, /\bbootstrap\b/i, /\bentry[- ]?point\b/i] : []),
];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a === `--${name}` || a.startsWith(prefix));
  if (!found) return fallback;
  if (found === `--${name}`) {
    const idx = process.argv.indexOf(found);
    return process.argv[idx + 1] ?? fallback;
  }
  return found.slice(prefix.length);
}

async function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function gitDiffNameOnly(base) {
  try {
    const { stdout } = await execFileP("git", ["diff", "--name-only", base, "--"], { encoding: "utf8" });
    return stdout;
  } catch (err) {
    throw new Error(`git diff against ${base} failed: ${err?.stderr ?? err?.message ?? err}`);
  }
}

async function loadDiff() {
  if (process.argv.includes("--stdin") || (!process.stdin.isTTY && !getArg("base"))) {
    return await readStdin();
  }
  const base = getArg("base", "origin/main");
  return await gitDiffNameOnly(base);
}

async function loadPrBody() {
  const inline = getArg("pr-body");
  if (typeof inline === "string") return inline;
  const file = getArg("pr-body-file");
  if (file) {
    try {
      return await fs.readFile(file, "utf8");
    } catch (err) {
      throw new Error(`Could not read --pr-body-file: ${err?.message ?? err}`);
    }
  }
  return ""; // no PR body provided — anything touched is "unmentioned"
}

export function parseChangedFiles(diffText) {
  return diffText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("warning:"))
    .map((l) => l.replace(/\\/g, "/"));
}

export function detectLeaks({ changedFiles, prBody, leakProneFiles = LEAK_PRONE_FILES }) {
  const leaks = [];
  for (const file of leakProneFiles) {
    if (!changedFiles.includes(file)) continue;
    const mentioned = SCOPE_MENTION_PATTERNS(file).some((re) => re.test(prBody));
    if (!mentioned) {
      leaks.push({ file, reason: "leak_prone_file_touched_without_scope_mention" });
    }
  }
  return leaks;
}

export function render({ changedFiles, leaks }) {
  const lines = [];
  lines.push(`Scanned ${changedFiles.length} changed file(s) against leak-prone list (${LEAK_PRONE_FILES.join(", ")}).`);
  if (leaks.length === 0) {
    lines.push("✔ No dirty-branch leaks detected.");
  } else {
    lines.push(`⚠ ${leaks.length} dirty-branch leak(s) detected:`);
    for (const l of leaks) {
      lines.push(`  - ${l.file}: ${l.reason}`);
    }
    lines.push("");
    lines.push("If the change to these files is INTENTIONAL, add a mention to the PR title/body and re-run.");
    lines.push("If it's UNINTENTIONAL, revert the file:");
    for (const l of leaks) {
      lines.push(`  git checkout origin/main -- ${l.file}`);
    }
  }
  return lines.join("\n");
}

async function main() {
  let diffText;
  let prBody;
  try {
    diffText = await loadDiff();
    prBody = await loadPrBody();
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
  const changedFiles = parseChangedFiles(diffText);
  const leaks = detectLeaks({ changedFiles, prBody });
  console.log(render({ changedFiles, leaks }));
  process.exit(leaks.length === 0 ? 0 : 1);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  main();
}
