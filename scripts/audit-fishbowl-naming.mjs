#!/usr/bin/env node
// scripts/audit-fishbowl-naming.mjs
//
// Boardroom / Fishbowl / Popcorn compatibility map audit.
//
// Closes UnClick todo "Architecture QC: Boardroom/Fishbowl compatibility map v1"
// (child of 87fb888e).
//
// Scans the working tree for legacy Fishbowl / Popcorn naming and groups
// matches by layer (api/, lib/, tests, ui, docs). The output is the input to
// the compat-map doc — it tells reviewers which files still need migration
// and which legacy names are still load-bearing.
//
// Pure stdlib. Always exits 0 (informational).

import { promises as fs } from "node:fs";
import * as path from "node:path";

const PATTERNS = {
  fishbowl: /\bfishbowl\b/i,
  popcorn: /\bpopcorn\b/i,
  // Boardroom is current canonical, but it sometimes appears alongside legacy names
  // for context. We track it separately so the compat map can show "X file
  // uses both names interchangeably, prefer Boardroom".
  boardroom: /\bboardroom\b/i,
};

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".turbo", ".cache", "coverage", ".vercel"]);
const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".jsx", ".md", ".mdx", ".json", ".yml", ".yaml"]);
const MAX_FILE_BYTES = 2_000_000;

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

export function classifyLayer(rel) {
  const p = rel.replace(/\\/g, "/").toLowerCase();
  if (/\.test\.|\.spec\./.test(p) || p.startsWith("tests/")) return "tests";
  if (p.startsWith("api/")) return "api";
  if (p.startsWith("src/lib/") || p.startsWith("lib/")) return "lib";
  if (p.startsWith("src/pages/") || p.startsWith("src/components/") || p.startsWith("src/")) return "ui";
  if (p.startsWith("docs/") || p.endsWith(".md")) return "docs";
  if (p.startsWith("scripts/")) return "scripts";
  return "other";
}

function shouldScan(file) {
  const ext = path.extname(file).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
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
    if (e.name.startsWith(".") && e.name !== ".github") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* walk(full, root, depth + 1);
    } else if (e.isFile() && shouldScan(full)) {
      yield { full, rel: path.relative(root, full) };
    }
  }
}

export async function auditNaming(root) {
  const matches = []; // { file, layer, hits: { fishbowl, popcorn, boardroom } }
  let filesScanned = 0;

  for await (const { full, rel } of walk(root, root)) {
    let stat;
    try { stat = await fs.stat(full); } catch { continue; }
    if (stat.size > MAX_FILE_BYTES) continue;
    let body;
    try { body = await fs.readFile(full, "utf8"); } catch { continue; }
    filesScanned += 1;

    const counts = { fishbowl: 0, popcorn: 0, boardroom: 0 };
    const lines = body.split(/\r?\n/);
    for (const line of lines) {
      for (const [k, re] of Object.entries(PATTERNS)) {
        if (re.test(line)) counts[k] += 1;
      }
    }
    if (counts.fishbowl + counts.popcorn === 0) continue;
    matches.push({
      file: rel.replace(/\\/g, "/"),
      layer: classifyLayer(rel),
      hits: counts,
      coexists_with_boardroom: counts.boardroom > 0,
    });
  }

  // Group by layer.
  const byLayer = {};
  for (const m of matches) {
    if (!byLayer[m.layer]) byLayer[m.layer] = [];
    byLayer[m.layer].push(m);
  }
  for (const layer of Object.keys(byLayer)) {
    byLayer[layer].sort((a, b) => a.file.localeCompare(b.file));
  }

  // Summary
  const summary = {
    files_with_fishbowl: matches.filter((m) => m.hits.fishbowl > 0).length,
    files_with_popcorn: matches.filter((m) => m.hits.popcorn > 0).length,
    files_with_both_legacy: matches.filter((m) => m.hits.fishbowl > 0 && m.hits.popcorn > 0).length,
    files_with_legacy_and_boardroom: matches.filter((m) => m.coexists_with_boardroom).length,
  };

  return {
    root,
    filesScanned,
    summary,
    by_layer: byLayer,
    matches,
  };
}

export function renderText(report) {
  const lines = [];
  lines.push(`Scanned ${report.filesScanned} files under ${report.root}`);
  lines.push("Summary:");
  lines.push(`  files containing "fishbowl": ${report.summary.files_with_fishbowl}`);
  lines.push(`  files containing "popcorn":  ${report.summary.files_with_popcorn}`);
  lines.push(`  files containing both legacy names: ${report.summary.files_with_both_legacy}`);
  lines.push(`  files containing legacy AND "boardroom": ${report.summary.files_with_legacy_and_boardroom}`);
  lines.push("");

  if (Object.keys(report.by_layer).length === 0) {
    lines.push("✔ No legacy Fishbowl/Popcorn references found.");
    return lines.join("\n");
  }

  const layerOrder = ["api", "lib", "ui", "scripts", "tests", "docs", "other"];
  for (const layer of layerOrder) {
    const items = report.by_layer[layer];
    if (!items || items.length === 0) continue;
    lines.push(`[${layer}] (${items.length} file${items.length === 1 ? "" : "s"})`);
    for (const m of items) {
      const tags = [];
      if (m.hits.fishbowl > 0) tags.push(`fishbowl×${m.hits.fishbowl}`);
      if (m.hits.popcorn > 0) tags.push(`popcorn×${m.hits.popcorn}`);
      if (m.coexists_with_boardroom) tags.push("alongside boardroom");
      lines.push(`  ${m.file}  (${tags.join(", ")})`);
    }
    lines.push("");
  }

  lines.push("Next step: refer matches to docs/fishbowl-compat-map.md for canonical naming + migration order.");
  return lines.join("\n");
}

async function main() {
  const root = path.resolve(getArg("root", process.cwd()));
  try { await fs.access(root); } catch {
    console.error(`Root path does not exist: ${root}`);
    process.exit(2);
  }
  const report = await auditNaming(root);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderText(report));
  }
  process.exit(0);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  main();
}
