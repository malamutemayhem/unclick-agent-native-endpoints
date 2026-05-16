#!/usr/bin/env node
// scripts/review-dry-run.mjs
//
// Local wrapper for Build E's review enforcement check. Runs the same body
// check the CI workflow runs, so authors can dry-run before pushing.
//
// Usage:
//   node scripts/review-dry-run.mjs --body-file PATH       # read body from file
//   node scripts/review-dry-run.mjs --pr 797               # fetch via gh CLI
//   git log -1 --pretty=%B | node scripts/review-dry-run.mjs --stdin   # check a commit message
//   node scripts/review-dry-run.mjs < my-pr-body.md        # piped stdin
//
// Exit codes:
//   0 = all markers present
//   1 = one or more markers missing (warning, not fatal — match CI's non-blocking shape)
//   2 = usage / I/O error

import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

const CHECKS = [
  {
    id: "closes_or_refs",
    re: /(?:Closes:|Refs:)\s*\S+/i,
    message: "Missing 'Closes:' or 'Refs:' line linking the UnClick todo.",
  },
  {
    id: "reviewer_pass",
    re: /Reviewer PASS|Reviewer\/Safety PASS/i,
    message: "Missing 'Reviewer PASS <SHA>' marker (can be added as a PR comment after review).",
  },
  {
    id: "safety_pass",
    re: /Safety PASS|Reviewer\/Safety PASS/i,
    message: "Missing 'Safety PASS <SHA>' marker (can be added as a PR comment after review).",
  },
  {
    id: "test_command",
    re: /\b(node\s+--test|npm\s+test|pnpm\s+test|vitest|playwright)\b/i,
    message: "No test command found in PR body. Paste the smallest meaningful check.",
  },
];

function getArg(name, fallback = undefined) {
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

async function fetchPrBody(prNumber) {
  try {
    const { stdout } = await execFileP("gh", ["pr", "view", String(prNumber), "--json", "body", "-q", ".body"], {
      encoding: "utf8",
    });
    return stdout;
  } catch (err) {
    throw new Error(`gh CLI failed to fetch PR #${prNumber}: ${err?.stderr ?? err?.message ?? err}`);
  }
}

async function getBody() {
  const bodyFile = getArg("body-file");
  if (bodyFile) {
    return await fs.readFile(bodyFile, "utf8");
  }
  const pr = getArg("pr");
  if (pr) {
    return await fetchPrBody(pr);
  }
  if (process.argv.includes("--stdin") || !process.stdin.isTTY) {
    return await readStdin();
  }
  throw new Error(
    "No input. Use one of:\n" +
    "  --body-file PATH   read body from a file\n" +
    "  --pr NUMBER        fetch via gh CLI\n" +
    "  --stdin            (or pipe content) read from stdin",
  );
}

function checkBody(body) {
  const present = [];
  const missing = [];
  for (const check of CHECKS) {
    if (check.re.test(body)) present.push(check.id);
    else missing.push({ id: check.id, message: check.message });
  }
  return { present, missing };
}

function render(report) {
  const lines = [];
  if (report.missing.length === 0) {
    lines.push("✔ Review enforcement: all markers present.");
  } else {
    lines.push(`⚠ Review enforcement: ${report.missing.length} marker(s) missing.`);
    for (const m of report.missing) lines.push(`  - ${m.message}`);
    lines.push("");
    lines.push("Markers found: " + (report.present.length ? report.present.join(", ") : "(none)"));
    lines.push("");
    lines.push("This is a non-blocking warning. Merge is gated by Reviewer/Safety PASS on the latest HEAD SHA, not by this check.");
  }
  return lines.join("\n");
}

async function main() {
  let body;
  try {
    body = await getBody();
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
  const report = checkBody(body);
  console.log(render(report));
  process.exit(report.missing.length === 0 ? 0 : 1);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  main();
}

// Exports for unit testing.
export { CHECKS, checkBody, render };
