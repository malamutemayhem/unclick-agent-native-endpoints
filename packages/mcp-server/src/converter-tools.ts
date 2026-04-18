// ─── Pure-local converter tool implementations ───────────────────────────────
// All run entirely inside the MCP process - no API calls.

import { marked } from "marked";
import TurndownService from "turndown";
import * as yaml from "js-yaml";
import { XMLParser, XMLBuilder } from "fast-xml-parser";
import TOML from "@iarna/toml";
import { parse as csvParse } from "csv-parse/sync";
import { stringify as csvStringify } from "csv-stringify/sync";

// ══════════════════════════════════════════════════════════════════════════════
// MARKDOWN ↔ HTML
// ══════════════════════════════════════════════════════════════════════════════

export function markdownToHtml(markdown: string): { html: string } {
  const html = marked.parse(markdown, { async: false }) as string;
  return { html };
}

export function htmlToMarkdown(html: string): { markdown: string } {
  const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
  const markdown = td.turndown(html);
  return { markdown };
}

// ══════════════════════════════════════════════════════════════════════════════
// JSON ↔ YAML
// ══════════════════════════════════════════════════════════════════════════════

export function jsonToYaml(json: string, indent = 2): { yaml: string } {
  const parsed = JSON.parse(json);
  const result = yaml.dump(parsed, { indent });
  return { yaml: result };
}

export function yamlToJson(yamlStr: string, indent = 2): { json: string } {
  const parsed = yaml.load(yamlStr);
  const result = JSON.stringify(parsed, null, indent);
  return { json: result };
}

// ══════════════════════════════════════════════════════════════════════════════
// JSON ↔ XML
// ══════════════════════════════════════════════════════════════════════════════

export function jsonToXml(json: string, rootKey = "root"): { xml: string } {
  const parsed = JSON.parse(json);
  const builder = new XMLBuilder({ format: true, indentBy: "  " });
  const wrapped = typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed
    : { [rootKey]: parsed };
  const result = builder.build(wrapped) as string;
  return { xml: result };
}

export function xmlToJson(xml: string, indent = 2): { json: string } {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const parsed = parser.parse(xml);
  const result = JSON.stringify(parsed, null, indent);
  return { json: result };
}

// ══════════════════════════════════════════════════════════════════════════════
// JSON ↔ TOML
// ══════════════════════════════════════════════════════════════════════════════

export function jsonToToml(json: string): { toml: string } {
  const parsed = JSON.parse(json);
  if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) {
    throw new Error("TOML requires a top-level object (not an array or primitive)");
  }
  const result = TOML.stringify(parsed as TOML.JsonMap);
  return { toml: result };
}

export function tomlToJson(tomlStr: string, indent = 2): { json: string } {
  const parsed = TOML.parse(tomlStr);
  const result = JSON.stringify(parsed, null, indent);
  return { json: result };
}

// ══════════════════════════════════════════════════════════════════════════════
// CSV ↔ JSON
// ══════════════════════════════════════════════════════════════════════════════

export function csvToJson(
  csv: string,
  options: { header?: boolean; delimiter?: string } = {}
): { json: string; rows: number; columns: number } {
  const { header = true, delimiter = "," } = options;
  const records = csvParse(csv, {
    columns: header,
    skip_empty_lines: true,
    delimiter,
    cast: true,
  }) as unknown[];
  const firstRow = records[0];
  const columns = firstRow
    ? header
      ? Object.keys(firstRow as object).length
      : (firstRow as unknown[]).length
    : 0;
  return {
    json: JSON.stringify(records, null, 2),
    rows: records.length,
    columns,
  };
}

export function jsonToCsv(
  json: string,
  options: { delimiter?: string } = {}
): { csv: string; rows: number } {
  const { delimiter = "," } = options;
  const parsed = JSON.parse(json) as unknown[];
  if (!Array.isArray(parsed)) {
    throw new Error("Input must be a JSON array");
  }
  const csv = csvStringify(parsed, {
    header: true,
    delimiter,
    cast: {
      boolean: (v) => String(v),
    },
  });
  return { csv, rows: parsed.length };
}

// ══════════════════════════════════════════════════════════════════════════════
// JSON FORMAT / MINIFY
// ══════════════════════════════════════════════════════════════════════════════

export function jsonFormat(
  json: string,
  indent: number | "tab" | "minify" = 2
): { json: string } {
  const parsed = JSON.parse(json);
  if (indent === "minify") {
    return { json: JSON.stringify(parsed) };
  }
  const spaces = indent === "tab" ? "\t" : indent;
  return { json: JSON.stringify(parsed, null, spaces) };
}

// ══════════════════════════════════════════════════════════════════════════════
// JSON ↔ JSONL (newline-delimited JSON)
// ══════════════════════════════════════════════════════════════════════════════

export function jsonToJsonl(json: string): { jsonl: string; lines: number } {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error("Input must be a JSON array to convert to JSONL");
  }
  const lines = parsed.map((item) => JSON.stringify(item));
  return { jsonl: lines.join("\n"), lines: lines.length };
}

export function jsonlToJson(jsonl: string, indent = 2): { json: string; lines: number } {
  const lines = jsonl
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const parsed = lines.map((line) => JSON.parse(line) as unknown);
  return { json: JSON.stringify(parsed, null, indent), lines: parsed.length };
}
