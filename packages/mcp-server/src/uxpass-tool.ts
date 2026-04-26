/**
 * uxpass-tool - MCP handlers for UXPass (Chunk 1 stubs).
 *
 * UXPass is the UI/UX sister to TestPass. The full execution pipeline
 * (capture, hat panel, synthesiser, reports) ships in Chunks 2 to 4.
 * Chunk 1 wires the MCP surface so agents can discover the contract,
 * does a minimal pack YAML validity check, and persists registered packs
 * to a local file under packs/registered/ so the wiring is end-to-end
 * testable before the backend lands.
 *
 * Note on schema validation: the canonical zod schema for UXPass packs
 * lives in @unclick/uxpass and is unit-tested there. This MCP wrapper
 * cannot depend on the workspace package because mcp-server is published
 * standalone to npm. The check here is intentionally shallow (parse YAML,
 * confirm the required top-level keys exist). Full validation runs server
 * side when the UXPass API ships in a later chunk.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import yaml from "js-yaml";

const STUB_NOTE =
  "UXPass run execution lands in Chunks 2 to 4. Chunk 1 wires the MCP surface and schema only.";

const PACKS_DIR = path.resolve(
  process.env.UXPASS_PACKS_DIR ??
    path.join(process.cwd(), "packages", "uxpass", "packs", "registered"),
);

const REQUIRED_PACK_KEYS = [
  "name",
  "url",
  "viewports",
  "themes",
  "hats",
  "synthesiser",
  "budgets",
  "remediation",
] as const;

function ensurePacksDir(): void {
  try {
    fs.mkdirSync(PACKS_DIR, { recursive: true });
  } catch {
    // best effort. The handler returns a clear error if writeFileSync fails.
  }
}

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
}

export async function uxpassRun(args: Record<string, unknown>): Promise<unknown> {
  const packName = typeof args.pack_name === "string" ? args.pack_name : undefined;
  const url = typeof args.url === "string" ? args.url : undefined;
  const hats = Array.isArray(args.hats)
    ? args.hats.filter((h): h is string => typeof h === "string")
    : undefined;

  if (!packName && !url) {
    return { error: "Either pack_name or url is required" };
  }

  const runId = `uxpass_${crypto.randomBytes(8).toString("hex")}`;
  return {
    run_id: runId,
    status: "queued",
    pack_name: packName ?? null,
    url: url ?? null,
    hats: hats ?? null,
    note: STUB_NOTE,
  };
}

export async function uxpassStatus(args: Record<string, unknown>): Promise<unknown> {
  const runId = typeof args.run_id === "string" ? args.run_id : "";
  if (!runId) return { error: "run_id is required" };

  return {
    run_id: runId,
    status: "queued",
    ux_score: null,
    summary: STUB_NOTE,
  };
}

export async function uxpassReportHtml(args: Record<string, unknown>): Promise<unknown> {
  const runId = typeof args.run_id === "string" ? args.run_id : "";
  if (!runId) return { error: "run_id is required" };

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>UXPass Report ${runId}</title></head>
<body>
  <h1>UXPass Report</h1>
  <p>Run id: <code>${runId}</code></p>
  <p>Run not yet implemented. ${STUB_NOTE}</p>
</body>
</html>`;
  return { run_id: runId, format: "html", body: html };
}

export async function uxpassReportJson(args: Record<string, unknown>): Promise<unknown> {
  const runId = typeof args.run_id === "string" ? args.run_id : "";
  if (!runId) return { error: "run_id is required" };

  return {
    run_id: runId,
    format: "json",
    body: {
      run_id: runId,
      status: "queued",
      ux_score: null,
      hat_verdicts: [],
      note: STUB_NOTE,
    },
  };
}

export async function uxpassReportMd(args: Record<string, unknown>): Promise<unknown> {
  const runId = typeof args.run_id === "string" ? args.run_id : "";
  if (!runId) return { error: "run_id is required" };

  const md = [
    `# UXPass Report ${runId}`,
    "",
    "Run not yet implemented.",
    "",
    STUB_NOTE,
    "",
  ].join("\n");
  return { run_id: runId, format: "md", body: md };
}

export async function uxpassRegisterPack(args: Record<string, unknown>): Promise<unknown> {
  const packYaml = typeof args.pack_yaml === "string" ? args.pack_yaml : "";
  if (!packYaml) return { error: "pack_yaml is required" };

  let parsed: unknown;
  try {
    parsed = yaml.load(packYaml);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `pack_yaml is not valid YAML: ${message}` };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: "pack_yaml must be a YAML object at the top level" };
  }
  const obj = parsed as Record<string, unknown>;
  const missing = REQUIRED_PACK_KEYS.filter((k) => obj[k] === undefined);
  if (missing.length > 0) {
    return {
      error: "pack is missing required keys",
      missing,
      hint: "Required keys are name, url, viewports, themes, hats, synthesiser, budgets, remediation. See @unclick/uxpass for the full zod schema.",
    };
  }

  const name = typeof obj.name === "string" ? obj.name : "";
  if (!name) return { error: "pack name must be a non-empty string" };

  ensurePacksDir();
  const packId = `${safeFilename(name)}-${crypto.randomBytes(4).toString("hex")}`;
  const filePath = path.join(PACKS_DIR, `${packId}.yaml`);
  try {
    fs.writeFileSync(filePath, packYaml, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `failed to persist pack: ${message}` };
  }

  return {
    pack_id: packId,
    name,
    file: filePath,
    note: "Persisted to local file. Database-backed persistence and full schema validation land with the backend in a later chunk.",
  };
}
