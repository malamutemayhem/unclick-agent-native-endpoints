import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import { PackSchema } from "./pack-schema.js";
import type { Pack } from "./types.js";

/**
 * Load and validate a TestPass pack from a YAML file path.
 * Throws a descriptive error if the file is missing or the schema is invalid.
 */
export function loadPackFromFile(filePath: string): Pack {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`TestPass pack not found: ${abs}`);
  }
  const raw = fs.readFileSync(abs, "utf-8");
  return loadPackFromYaml(raw);
}

/**
 * Load and validate a TestPass pack from a YAML string.
 */
export function loadPackFromYaml(yamlString: string): Pack {
  let parsed: unknown;
  try {
    parsed = yaml.load(yamlString);
  } catch (err) {
    throw new Error(`YAML parse error: ${(err as Error).message}`);
  }
  const result = PackSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Pack schema validation failed:\n${issues}`);
  }
  return result.data;
}

/**
 * Serialize a validated pack back to a YAML string (round-trip).
 */
export function packToYaml(pack: Pack): string {
  return yaml.dump(pack, { indent: 2, lineWidth: 100 });
}

/**
 * Serialize a validated pack to a jsonb-compatible plain object for DB storage.
 */
export function packToJsonb(pack: Pack): Record<string, unknown> {
  return JSON.parse(JSON.stringify(pack)) as Record<string, unknown>;
}

/**
 * Restore a pack from jsonb (DB row) back to a validated Pack.
 */
export function packFromJsonb(jsonb: unknown): Pack {
  const result = PackSchema.safeParse(jsonb);
  if (!result.success) {
    throw new Error(`Invalid pack jsonb: ${result.error.message}`);
  }
  return result.data;
}
