#!/usr/bin/env node
// scripts/audit-ai-call-sites.mjs
//
// Inventory script for the AI Spend Guardrails todo. Scans the working tree
// for AI provider call sites (OpenAI, Anthropic, Cohere, Groq, etc.) so each
// can be covered by a spend guardrail before it reaches a provider.
//
// Informational only, always exits 0.

import { promises as fs } from "node:fs";
import * as path from "node:path";

const PATTERNS = [
  // SDKs and clients
  { provider: "openai",     re: /\bnew\s+OpenAI\b|openai\.(?:chat|embeddings|completions|images|audio)/i },
  { provider: "anthropic",  re: /\bnew\s+Anthropic\b|anthropic\.messages\.create/i },
  { provider: "cohere",     re: /\bnew\s+CohereClient\b|cohere\.(?:chat|embed|rerank)/i },
  { provider: "mistral",    re: /\bMistralClient\b|mistral\.chat/i },
  { provider: "groq",       re: /\bnew\s+Groq\b|groq\.chat/i },
  { provider: "togetherai", re: /together\.(?:chat|embeddings)/i },
  { provider: "replicate",  re: /\bnew\s+Replicate\b|replicate\.run|replicate\.predictions/i },
  { provider: "stability",  re: /stability\.ai|stability_api|stability\/v1/i },
  { provider: "elevenlabs", re: /elevenlabs\b|11labs/i },
  { provider: "assemblyai", re: /AssemblyAI|assemblyai\b/i },
  { provider: "deepl",      re: /deepl-node|deepl\.translateText/i },
  // Raw fetches to known model endpoints
  { provider: "openai",     re: /api\.openai\.com/i },
  { provider: "anthropic",  re: /api\.anthropic\.com/i },
  { provider: "perplexity", re: /api\.perplexity\.ai/i },
];

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".turbo", ".cache", "coverage", ".vercel"]);
const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".jsx"]);
const MAX_FILE_BYTES = 2_000_000;

const EXPECTED_REFS = [
  /\baiSpendGuard\.ts$/i,
  /\baiSpendGuard\.test\.ts$/i,
  /\bai-provider-inventory\.ts$/i,
  /\bai-provider-inventory\.test\.ts$/i,
  /\baudit-ai-call-sites\.mjs$/i,
  /\baudit-ai-call-sites\.test\.mjs$/i,
  /\bpackages\/mcp-server\/src\/tool-wiring\.ts$/i,
  /\bpackages\/mcp-server\/src\/keychain-secure-input\.ts$/i,
  /\bsrc\/components\/Tools\.tsx$/i,
  /\bsrc\/pages\/BackstagePass\.tsx$/i,
];

const GUARD_MARKERS = [
  { kind: "withSpendGuard", re: /\bwithSpendGuard\b/ },
  { kind: "provider-inventory", re: /\bdecideAiProviderCall\b/ },
  { kind: "provider-decision-helper", re: /\bdecide(?!AiProviderCall\b)[A-Za-z0-9_]*ProviderCall\b/ },
  { kind: "explicit-env-gate", re: /\b(?:MEMORY_OPENAI_EMBEDDINGS_ENABLED|MEMORY_OPENAI_FACT_EXTRACTION_ENABLED|MEMORY_AI_FACT_EXTRACTION_ENABLED|ARENA_ANTHROPIC_ENABLED|OPENROUTER_WAKE_ALLOW_PAID|AI_CHAT_ENABLED|NUDGEONLY_OPENROUTER_ALLOW_PAID)\b/ },
];

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

function shouldScan(file) {
  return TEXT_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function isExpected(rel) {
  const normalized = rel.replace(/\\/g, "/");
  return EXPECTED_REFS.some((re) => re.test(normalized));
}

function detectGuard(body) {
  return GUARD_MARKERS
    .filter((marker) => marker.re.test(body))
    .map((marker) => marker.kind);
}

async function* walk(dir, root, depth = 0) {
  if (depth > 20) return;
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
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

export async function auditCallSites(root) {
  const callSites = [];     // { file, hits: [{ provider, line, excerpt }] }
  const expectedHits = [];  // helper / tests / this script
  let filesScanned = 0;

  for await (const { full, rel } of walk(root, root)) {
    let stat;
    try { stat = await fs.stat(full); } catch { continue; }
    if (stat.size > MAX_FILE_BYTES) continue;
    let body;
    try { body = await fs.readFile(full, "utf8"); } catch { continue; }
    filesScanned += 1;

    const fileHits = [];
    const lines = body.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      for (const p of PATTERNS) {
        if (p.re.test(lines[i])) {
          fileHits.push({ provider: p.provider, line: i + 1, excerpt: lines[i].trim().slice(0, 220) });
        }
      }
    }
    if (fileHits.length === 0) continue;

    // Detect whether the file already routes the provider request through one
    // of the accepted spend guardrail helpers.
    const guardMarkers = detectGuard(body);
    const guarded = guardMarkers.length > 0;

    const record = { file: rel.replace(/\\/g, "/"), guarded, guardMarkers, hits: fileHits };
    if (isExpected(rel)) expectedHits.push(record);
    else callSites.push(record);
  }

  // Group call sites by provider for summary.
  const by_provider = {};
  for (const cs of callSites) {
    for (const h of cs.hits) {
      by_provider[h.provider] = (by_provider[h.provider] ?? 0) + 1;
    }
  }

  const ungarded = callSites.filter((cs) => !cs.guarded);

  return {
    root,
    filesScanned,
    summary: {
      files_with_ai_calls: callSites.length,
      already_guarded: callSites.length - ungarded.length,
      need_wrapping: ungarded.length,
      total_hits: callSites.reduce((acc, cs) => acc + cs.hits.length, 0),
      by_provider,
    },
    callSites,
    expectedHits,
  };
}

function renderText(report) {
  const lines = [];
  lines.push(`Scanned ${report.filesScanned} files under ${report.root}`);
  lines.push("Summary:");
  for (const k of Object.keys(report.summary)) {
    if (k === "by_provider") continue;
    lines.push(`  ${k}: ${report.summary[k]}`);
  }
  lines.push("  by_provider:");
  for (const [prov, n] of Object.entries(report.summary.by_provider)) {
    lines.push(`    ${prov}: ${n}`);
  }
  lines.push("");

  if (report.callSites.length === 0) {
    lines.push("[ok] No AI call sites detected.");
    return lines.join("\n");
  }

  const ungarded = report.callSites.filter((cs) => !cs.guarded);
  if (ungarded.length > 0) {
    lines.push(`Call sites needing spend guardrail wrapping (${ungarded.length}):`);
    for (const cs of ungarded) {
      lines.push("");
      lines.push(`  ${cs.file}`);
      for (const h of cs.hits) {
        lines.push(`    L${h.line}  [${h.provider}]  ${h.excerpt}`);
      }
    }
  } else {
    lines.push("[ok] All AI call sites are already covered by a spend guardrail.");
  }
  return lines.join("\n");
}

async function main() {
  const root = path.resolve(getArg("root", process.cwd()));
  try { await fs.access(root); } catch {
    console.error(`Root path does not exist: ${root}`);
    process.exit(2);
  }
  const report = await auditCallSites(root);
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

export { PATTERNS, detectGuard, isExpected, shouldScan, renderText };
