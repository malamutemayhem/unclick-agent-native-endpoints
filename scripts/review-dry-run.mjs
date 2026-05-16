import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const REQUIRED_SECTIONS = [
  "summary",
  "changes",
  "owner and lift status",
  "review handoff",
  "testing",
];

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stripHtmlComments(value) {
  return String(value || "").replace(/<!--[\s\S]*?-->/g, "");
}

function normaliseHeading(value) {
  return compact(value).toLowerCase();
}

export function extractMarkdownSections(markdown) {
  const sections = new Map();
  let current = null;
  let buffer = [];

  for (const line of String(markdown || "").split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      if (current) sections.set(current, buffer.join("\n"));
      current = normaliseHeading(heading[1]);
      buffer = [];
      continue;
    }
    if (current) buffer.push(line);
  }

  if (current) sections.set(current, buffer.join("\n"));
  return sections;
}

export function hasMeaningfulSectionContent(value) {
  const stripped = stripHtmlComments(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== "-")
    .filter((line) => !/^-?\s*(owner|non-overlap|status|reviewer or lane|human decision pending|merge policy)\s*:\s*$/i.test(line));

  return stripped.length > 0;
}

export function validateReviewBody(markdown, options = {}) {
  const requiredSections = options.requiredSections || REQUIRED_SECTIONS;
  const sections = extractMarkdownSections(markdown);
  const missing_sections = [];
  const empty_sections = [];

  for (const section of requiredSections) {
    if (!sections.has(section)) {
      missing_sections.push(section);
      continue;
    }
    if (!hasMeaningfulSectionContent(sections.get(section))) {
      empty_sections.push(section);
    }
  }

  return {
    ok: missing_sections.length === 0 && empty_sections.length === 0,
    required_sections: [...requiredSections],
    missing_sections,
    empty_sections,
  };
}

export async function readReviewBodyFromArgs(args, cwd = process.cwd()) {
  const bodyFileIndex = args.indexOf("--body-file");
  if (bodyFileIndex !== -1) {
    const file = args[bodyFileIndex + 1];
    if (!file) throw new Error("--body-file requires a path");
    return readFile(file, "utf8");
  }

  const githubEventIndex = args.indexOf("--github-event");
  if (githubEventIndex !== -1) {
    const file = args[githubEventIndex + 1];
    if (!file) throw new Error("--github-event requires a path");
    const event = JSON.parse(await readFile(file, "utf8"));
    return event.pull_request?.body || "";
  }

  const templateIndex = args.indexOf("--template");
  if (templateIndex !== -1) {
    const file = args[templateIndex + 1] || `${cwd}/.github/PULL_REQUEST_TEMPLATE.md`;
    return readFile(file, "utf8");
  }

  throw new Error("Usage: node scripts/review-dry-run.mjs --body-file <path> | --github-event <event.json> | --template [path]");
}

function formatList(items) {
  return items.length ? items.join(", ") : "none";
}

function emitWarning(message) {
  if (process.env.GITHUB_ACTIONS === "true") {
    console.log(`::warning title=Review enforcement::${message}`);
  }
}

export async function main(args = process.argv.slice(2)) {
  let body;
  try {
    body = await readReviewBodyFromArgs(args);
  } catch (error) {
    console.error(error.message);
    return 2;
  }

  const result = validateReviewBody(body);
  if (result.ok) {
    console.log(`PASS: review dry-run found required sections: ${formatList(result.required_sections)}`);
    return 0;
  }

  const message = `Missing sections: ${formatList(result.missing_sections)}. Empty sections: ${formatList(result.empty_sections)}.`;
  emitWarning(message);
  console.error(`HOLD: review dry-run incomplete. ${message}`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
