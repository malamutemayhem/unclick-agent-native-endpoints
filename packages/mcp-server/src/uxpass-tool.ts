/**
 * uxpass-tool - MCP handlers for UXPass.
 *
 * UXPass is the UI/UX sister to TestPass. uxpass_run, uxpass_status, and
 * the three uxpass_report_* tools call back into the UnClick Vercel API at
 * /api/uxpass using the caller's UNCLICK_API_KEY as a Bearer token (same
 * pattern as the testpass tool). The API resolves the key to a user id and
 * persists run + finding rows under that user.
 *
 * uxpass_register_pack still validates and persists packs to a local file
 * under packs/registered/. The full server-side packs table lands in a
 * later chunk; until then the local persistence keeps the wiring testable.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import yaml from "js-yaml";

const API_BASE = (process.env.UNCLICK_API_URL ?? "https://unclick.world").replace(/\/$/, "");

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

function getApiKey(): string {
  const key = process.env.UNCLICK_API_KEY?.trim();
  if (!key) {
    throw new Error("UNCLICK_API_KEY env var is not set. Get your install config at https://unclick.world");
  }
  return key;
}

async function callApi(
  pathAndQuery: string,
  init: { method?: string; body?: unknown } = {},
): Promise<unknown> {
  const apiKey = getApiKey();
  const res = await fetch(`${API_BASE}/api/uxpass${pathAndQuery}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep text */
  }
  if (!res.ok) return { error: `uxpass API failed (HTTP ${res.status})`, body };
  return body;
}

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
  const url = typeof args.url === "string" ? args.url : undefined;
  const packName = typeof args.pack_name === "string" ? args.pack_name : undefined;
  const taskId = typeof args.task_id === "string" && args.task_id ? args.task_id : undefined;

  if (!url && !packName) {
    return { error: "Either url or pack_name is required" };
  }

  // pack_name still resolves locally because pack persistence is file-based
  // until the server-side packs table lands. We resolve it to the pack's
  // declared url and submit a run for that.
  let targetUrl = url;
  if (!targetUrl && packName) {
    try {
      ensurePacksDir();
      const candidate = fs.readdirSync(PACKS_DIR).find((f) => f.startsWith(`${safeFilename(packName)}-`));
      if (!candidate) return { error: `No registered pack found for name '${packName}'` };
      const packYaml = fs.readFileSync(path.join(PACKS_DIR, candidate), "utf8");
      const parsed = yaml.load(packYaml) as { url?: string } | undefined;
      if (!parsed?.url) return { error: `Pack '${packName}' has no url field` };
      targetUrl = parsed.url;
    } catch (err) {
      return { error: `failed to read pack '${packName}': ${(err as Error).message}` };
    }
  }

  const body: Record<string, unknown> = { target_url: targetUrl, pack_slug: "uxpass-core" };
  if (taskId) body.task_id = taskId;
  return callApi("?action=start_run", {
    method: "POST",
    body,
  });
}

export async function uxpassStatus(args: Record<string, unknown>): Promise<unknown> {
  const runId = typeof args.run_id === "string" ? args.run_id : "";
  if (!runId) return { error: "run_id is required" };
  return callApi(`?action=status&run_id=${encodeURIComponent(runId)}`);
}

export async function uxpassReportHtml(args: Record<string, unknown>): Promise<unknown> {
  const runId = typeof args.run_id === "string" ? args.run_id : "";
  if (!runId) return { error: "run_id is required" };
  const apiKey = getApiKey();
  const res = await fetch(
    `${API_BASE}/api/uxpass?action=report_html&run_id=${encodeURIComponent(runId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  const text = await res.text();
  if (!res.ok) {
    let body: unknown = text;
    try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
    return { error: `uxpass report_html failed (HTTP ${res.status})`, body };
  }
  return { run_id: runId, format: "html", body: text };
}

export async function uxpassReportJson(args: Record<string, unknown>): Promise<unknown> {
  const runId = typeof args.run_id === "string" ? args.run_id : "";
  if (!runId) return { error: "run_id is required" };
  const data = await callApi(`?action=report_json&run_id=${encodeURIComponent(runId)}`);
  return { run_id: runId, format: "json", body: data };
}

export async function uxpassReportMd(args: Record<string, unknown>): Promise<unknown> {
  const runId = typeof args.run_id === "string" ? args.run_id : "";
  if (!runId) return { error: "run_id is required" };
  const data = await callApi(`?action=report_md&run_id=${encodeURIComponent(runId)}`);
  if (data && typeof data === "object" && "markdown" in data) {
    return { run_id: runId, format: "md", body: (data as { markdown: string }).markdown };
  }
  return data;
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
    note: "Persisted to local file. Database-backed pack persistence lands in a later chunk; uxpass_run currently resolves pack_name to its declared url and submits a deterministic run.",
  };
}
