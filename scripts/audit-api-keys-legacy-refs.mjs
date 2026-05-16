#!/usr/bin/env node
// scripts/audit-api-keys-legacy-refs.mjs
//
// Audit script for UnClick todo (SECURITY: deactivate legacy plaintext
// api_keys_legacy rows). Scans the working tree for any live code reference
// to `api_keys_legacy` so deactivation can proceed safely — or surface the
// remaining references so they can be removed first.
//
// Pure stdlib. Returns:
//   0 — no live references found (safe to proceed to deactivation runbook)
//   1 — references found (block deactivation; see report)
//   2 — usage / I/O error
//
// Usage:
//   node scripts/audit-api-keys-legacy-refs.mjs
//   node scripts/audit-api-keys-legacy-refs.mjs --root <path>
//   node scripts/audit-api-keys-legacy-refs.mjs --json     # machine-readable output
//
// The script does NOT touch the database. It only scans files on disk. The
// database side is handled by the runbook in docs/security/.

import { promises as fs } from "node:fs";
import * as path from "node:path";

const TARGET = /\bapi[_-]?keys[_-]?legacy\b/i;

// Ignore directories that shouldn't count.
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".cache",
  "coverage",
  ".vercel",
]);

// Files where a reference is *expected* and doesn't count as a live use.
// These are docs / runbooks / this audit script itself.
const EXPECTED_REFERENCE_GLOBS = [
  /\bdocs\/security\/api[_-]keys[_-]legacy/i,
  /\baudit-api-keys-legacy-refs\.mjs$/i,
  /\baudit-api-keys-legacy-refs\.test\.mjs$/i,
  /\bCHANGELOG\.md$/i,
];

const TEXT_EXTENSIONS = new Set([
  ".js", ".mjs", ".cjs", ".jsx",
  ".ts", ".tsx",
  ".md", ".mdx",
  ".sql",
  ".json", ".yml", ".yaml",
  ".html", ".css", ".scss",
  ".sh", ".ps1",
  ".env.example", ".example",
  ".txt",
]);

const MAX_FILE_BYTES = 2_000_000; // skip files larger than 2MB

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

function isExpectedReference(relPath) {
  return EXPECTED_REFERENCE_GLOBS.some((re) => re.test(relPath));
}

function shouldScanFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return true;
  // Files without extension (Dockerfile, Makefile, Procfile) — scan small ones.
  return ext === "";
}

async function* walk(dir, root, depth = 0) {
  if (depth > 20) return;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith(".") && e.name !== ".github" && e.name !== ".env.example") {
      // skip hidden files/dirs except a few known ones
      continue;
    }
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* walk(full, root, depth + 1);
    } else if (e.isFile() && shouldScanFile(full)) {
      const rel = path.relative(root, full);
      yield { full, rel };
    }
  }
}

export async function auditRoot(root) {
  const findings = [];
  const expectedFindings = [];
  let filesScanned = 0;

  for await (const { full, rel } of walk(root, root)) {
    let stat;
    try {
      stat = await fs.stat(full);
    } catch {
      continue;
    }
    if (stat.size > MAX_FILE_BYTES) continue;

    let body;
    try {
      body = await fs.readFile(full, "utf8");
    } catch {
      continue;
    }
    filesScanned += 1;

    const lines = body.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      if (TARGET.test(lines[i])) {
        const finding = {
          file: rel.replace(/\\/g, "/"),
          line: i + 1,
          excerpt: lines[i].trim().slice(0, 220),
        };
        if (isExpectedReference(rel)) expectedFindings.push(finding);
        else findings.push(finding);
      }
    }
  }

  return {
    root,
    target: TARGET.source,
    filesScanned,
    findings,           // live references — these block deactivation
    expectedFindings,   // refs in docs/this script — OK
    safeToProceed: findings.length === 0,
  };
}

function renderText(report) {
  const lines = [];
  lines.push(`Scanned ${report.filesScanned} files under ${report.root}`);
  lines.push(`Pattern: /${report.target}/`);
  if (report.findings.length === 0) {
    lines.push("");
    lines.push("✔ No live references to api_keys_legacy found.");
    lines.push(`  ${report.expectedFindings.length} expected reference(s) in docs / this script (ignored).`);
    lines.push("");
    lines.push("Next step: proceed to docs/security/api_keys_legacy-deactivation.md (manual, owner-auth required).");
  } else {
    lines.push("");
    lines.push(`✗ Found ${report.findings.length} live reference(s) — deactivation is NOT safe yet.`);
    lines.push("");
    for (const f of report.findings) {
      lines.push(`  ${f.file}:${f.line}  ${f.excerpt}`);
    }
    lines.push("");
    lines.push("Remove or refactor each reference, then re-run the audit. Until findings is empty, do not run the deactivation SQL.");
  }
  if (report.expectedFindings.length > 0 && report.findings.length === 0) {
    lines.push("");
    lines.push("Expected references (excluded from blocking):");
    for (const f of report.expectedFindings) {
      lines.push(`  ${f.file}:${f.line}`);
    }
  }
  return lines.join("\n");
}

async function main() {
  const root = path.resolve(getArg("root", process.cwd()));
  let exists = true;
  try {
    await fs.access(root);
  } catch {
    exists = false;
  }
  if (!exists) {
    console.error(`Root path does not exist: ${root}`);
    process.exit(2);
  }

  const report = await auditRoot(root);

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderText(report));
  }
  process.exit(report.safeToProceed ? 0 : 1);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  main();
}

export { TARGET, isExpectedReference, shouldScanFile, renderText };
