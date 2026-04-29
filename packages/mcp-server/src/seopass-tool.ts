import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";

const PACKS_DIR = path.resolve(
  process.env.SEOPASS_PACKS_DIR ??
    path.join(process.cwd(), "packages", "seopass", "packs", "registered"),
);

const REQUIRED_PACK_KEYS = ["name", "url", "checks", "lighthouse", "crawl", "budgets"] as const;

function ensurePacksDir(): void {
  fs.mkdirSync(PACKS_DIR, { recursive: true });
}

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
}

function loadRegisteredPack(name: string): Record<string, unknown> | null {
  ensurePacksDir();
  const candidate = fs.readdirSync(PACKS_DIR).find((file) => file.startsWith(`${safeFilename(name)}-`));
  if (!candidate) return null;
  return yaml.load(fs.readFileSync(path.join(PACKS_DIR, candidate), "utf8")) as Record<string, unknown>;
}

function lighthousePlan(pack: Record<string, unknown>): Record<string, unknown> {
  const lighthouse = (pack.lighthouse ?? {}) as Record<string, unknown>;
  return {
    runner: "lighthouse",
    target_url: pack.url,
    strategy: lighthouse.strategy ?? "mobile",
    categories: lighthouse.categories ?? ["seo"],
    output: ["json"],
    notes: [
      "Chunk 1 scaffold only: this builds the Lighthouse execution plan.",
      "A later chip will execute Lighthouse, persist runs, and emit findings.",
    ],
  };
}

export async function seopassRun(args: Record<string, unknown>): Promise<unknown> {
  const url = typeof args.url === "string" ? args.url : undefined;
  const packName = typeof args.pack_name === "string" ? args.pack_name : undefined;
  if (!url && !packName) return { error: "Either url or pack_name is required" };

  const pack = packName ? loadRegisteredPack(packName) : null;
  const targetUrl = url ?? (typeof pack?.url === "string" ? pack.url : undefined);
  if (!targetUrl) return { error: `No registered SEOPass pack found for '${packName}'` };

  return {
    status: "planned",
    pass: "seopass",
    target_url: targetUrl,
    checks: pack?.checks ?? ["lighthouse-performance", "crawlability", "metadata", "structured-data"],
    lighthouse_plan: lighthousePlan({ ...(pack ?? {}), url: targetUrl }),
    note: "SEOPass Chunk 1 is scaffold-only. Execution and persistence land in a later chip.",
  };
}

export async function seopassStatus(args: Record<string, unknown>): Promise<unknown> {
  const runId = typeof args.run_id === "string" ? args.run_id : "";
  if (!runId) return { error: "run_id is required" };
  return {
    run_id: runId,
    status: "not_implemented",
    note: "SEOPass run persistence lands in a later chip.",
  };
}

export async function seopassRegisterPack(args: Record<string, unknown>): Promise<unknown> {
  const packYaml = typeof args.pack_yaml === "string" ? args.pack_yaml : "";
  if (!packYaml) return { error: "pack_yaml is required" };

  let parsed: unknown;
  try {
    parsed = yaml.load(packYaml);
  } catch (err) {
    return { error: `pack_yaml is not valid YAML: ${(err as Error).message}` };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: "pack_yaml must be a YAML object at the top level" };
  }
  const pack = parsed as Record<string, unknown>;
  const missing = REQUIRED_PACK_KEYS.filter((key) => pack[key] === undefined);
  if (missing.length > 0) return { error: "pack is missing required keys", missing };

  const name = typeof pack.name === "string" ? pack.name : "";
  if (!name) return { error: "pack name must be a non-empty string" };

  ensurePacksDir();
  const packId = `${safeFilename(name)}-${crypto.randomBytes(4).toString("hex")}`;
  const filePath = path.join(PACKS_DIR, `${packId}.yaml`);
  fs.writeFileSync(filePath, packYaml, "utf8");
  return { pack_id: packId, name, file: filePath };
}

export async function seopassLighthousePlan(args: Record<string, unknown>): Promise<unknown> {
  const url = typeof args.url === "string" ? args.url : "";
  if (!url) return { error: "url is required" };
  return lighthousePlan({
    url,
    lighthouse: {
      strategy: args.strategy === "desktop" ? "desktop" : "mobile",
      categories: Array.isArray(args.categories) ? args.categories : ["performance", "accessibility", "best-practices", "seo"],
    },
  });
}
