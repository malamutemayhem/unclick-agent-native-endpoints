#!/usr/bin/env node

import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const GENERATED_PATH = "docs/UnClick-brainmap.generated.md";

const CORE_SOURCES = [
  "AUTOPILOT.md",
  "FLEET_SYNC.md",
  "docs/unclick-context-boot-packet.md",
  "docs/agent-observability.md",
  "docs/pinballwake-nudgeonly-api.md",
  "docs/pinballwake-igniteonly-api.md",
  "docs/fleet-worker-roles.md",
  "docs/adr/0005-two-layer-admin-gating.md",
  "docs/adr/0006-orchestrator-is-user-chat.md",
  "src/App.tsx",
  "src/pages/admin/AdminShell.tsx",
  ".github/workflows/ci.yml",
  ".github/workflows/brainmap-auto-update.yml",
  "package.json",
];

const ALIASES = [
  ["EnterprisePass", "CompliancePass", "Enterprise readiness checks need a public-safe product name."],
  ["SlopPass", "QualityPass", "Roughness and polish checks should be framed constructively."],
  ["Fishbowl", "Boardroom", "Internal worker discussion becomes a user-facing room name."],
  ["To-Do List", "Jobs", "Task queue language maps to the current admin Jobs surface."],
  ["Heartbeat", "Heartbeat Master", "The copy policy that teaches scheduled seats how to pulse."],
  ["NudgeOnlyAPI", "NudgeOnly", "Low-risk receipt nudges, never source-of-truth mutation."],
  ["IgniteOnlyAPI", "IgniteOnly", "Verified worker wake packets, never build, merge, or completion state."],
];

const WORKERS = [
  ["Coordinator", "Routes work, chooses the next room, and keeps lanes aligned."],
  ["Builder", "Implements focused code or content changes from a scoped packet."],
  ["Tester", "Runs proof and reports what passed or blocked."],
  ["Reviewer", "Checks quality, regressions, and missing tests."],
  ["Safety Checker", "Protects secrets, auth, destructive actions, and release gates."],
  ["Ledger", "Records proof, receipts, approvals, and rollback evidence."],
  ["Publisher", "Moves approved work toward deployment and public proof."],
  ["Improver", "Turns repeated pain into system improvements."],
];

const PAGE_MEANINGS = {
  AdminAnalytics: "Internal analytics view for platform signals and usage.",
  AdminAuditLog: "Internal audit trail for sensitive admin actions.",
  AdminBrainmap: "Generated ecosystem map that teaches seats what UnClick is.",
  AdminCodebase: "Internal source and architecture orientation surface.",
  AdminDashboard: "Front door for current operator state.",
  AdminJobs: "Operational job and task queue.",
  AdminKeychain: "Passport and credential connection health.",
  AdminMemory: "Admin view of persistent memory, facts, sessions, and recall.",
  AdminOrchestrator: "Readable continuity stream for seats and operator context.",
  AdminPinballWake: "PinballWake rooms, wake routes, and automation visibility.",
  AdminSeatHeartbeat: "Master heartbeat copy policy for scheduled AI seats.",
  AdminSettings: "Account and admin configuration.",
  AdminSystemHealth: "Health checks and operational status.",
  AdminTools: "Apps, tools, and connector capability surface.",
  AdminUsers: "Internal user management.",
  AdminYou: "Personal account, identity, and access panel.",
  BrainMap: "Legacy Memory Brain Map component kept distinct from ecosystem Brainmap.",
  Fishbowl: "Boardroom discussion surface for worker coordination.",
};

const PUBLIC_PAGE_MEANINGS = {
  Index: "Public home and first explanation of UnClick.",
  Memory: "Public memory product page.",
  Tools: "Public tools marketplace entry point.",
  Developers: "Developer-facing entry point.",
  DeveloperDocs: "Developer documentation.",
  DeveloperSubmit: "Tool submission flow.",
  Crews: "Public Crews explanation and entry point.",
  BuildDesk: "Build and project work surface.",
  DogfoodReport: "Public dogfood proof report.",
  Pricing: "Plans, billing, and packaging.",
  Privacy: "Privacy policy.",
  Terms: "Terms of service.",
  Login: "Sign-in page.",
  Signup: "Sign-up page.",
  Dispatch: "Dispatch and message handoff surface.",
  NewToAI: "Beginner-friendly AI orientation.",
};

function titleFromName(name) {
  return name
    .replace(/\.(tsx|ts|mjs|md|json)$/i, "")
    .replace(/^Admin/, "Admin ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sentence(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.endsWith(".") ? text : `${text}.`;
}

function meaningForPage(file) {
  const base = path.basename(file, path.extname(file));
  if (PAGE_MEANINGS[base]) return PAGE_MEANINGS[base];
  if (PUBLIC_PAGE_MEANINGS[base]) return PUBLIC_PAGE_MEANINGS[base];
  if (file.includes("/tools/")) return `Tool page for ${titleFromName(base)}.`;
  if (file.includes("/arena/")) return `Arena page for ${titleFromName(base)}.`;
  if (file.includes("/admin/crews/")) return `Crews admin page for ${titleFromName(base)}.`;
  if (file.includes("/admin/memory/")) return `Memory admin panel for ${titleFromName(base)}.`;
  if (file.includes("/admin/")) return `Admin surface for ${titleFromName(base)}.`;
  return `User-facing page for ${titleFromName(base)}.`;
}

function meaningForTool(file) {
  const base = path.basename(file, ".ts").replace(/-tool$/, "");
  const name = titleFromName(base);
  if (base === "nudgeonly") return "NudgeOnly low-token receipt bridge and advisory classifier.";
  if (base === "igniteonly") return "IgniteOnly verified worker wake packet bridge.";
  if (base === "heartbeat-protocol") return "Canonical heartbeat policy served to scheduled seats.";
  if (base.includes("testpass")) return "TestPass proof and test orchestration capability.";
  if (base.includes("uxpass")) return "UXPass experience verification capability.";
  return `${name} MCP capability, available through the UnClick tool gateway.`;
}

function displayToolName(file) {
  const base = path.basename(file, ".ts").replace(/-tool$/, "");
  if (base === "nudgeonly") return "NudgeOnly";
  if (base === "igniteonly") return "IgniteOnly";
  if (base === "heartbeat-protocol") return "Heartbeat Protocol";
  return titleFromName(base);
}

async function walk(root, start, predicate) {
  const dir = path.join(root, start);
  if (!existsSync(dir)) return [];
  const out = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!["node_modules", "dist", "build", ".git", ".claude"].includes(entry.name)) await visit(full);
      } else if (!predicate || predicate(full)) {
        out.push(path.relative(root, full).replaceAll("\\", "/"));
      }
    }
  }
  await visit(dir);
  return out.sort();
}

async function readText(root, rel) {
  try {
    return (await readFile(path.join(root, rel), "utf8")).replace(/\r\n/g, "\n");
  } catch {
    return "";
  }
}

function hash(text) {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 12);
}

async function manifestRows(root, files) {
  const rows = [];
  for (const rel of files) {
    const text = await readText(root, rel);
    rows.push([rel, text ? hash(text) : "missing", text ? `${text.length}` : "0"]);
  }
  return rows;
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell).replace(/\|/g, "\\|")).join(" | ")} |`),
  ].join("\n");
}

function routeForPage(file) {
  const base = path.basename(file, path.extname(file));
  if (file === "src/pages/admin/AdminBrainmap.tsx") return "/admin/brainmap";
  if (base === "AdminSeatHeartbeat") return "/admin/agents/heartbeat";
  if (base.startsWith("Admin")) return `/admin/${base.replace(/^Admin/, "").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}`;
  if (file.includes("/tools/")) return `/tools/${base.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}`;
  if (file.includes("/arena/")) return `/arena/${base.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}`;
  return base === "Index" ? "/" : `/${base.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}`;
}

function roomName(file) {
  return titleFromName(path.basename(file, ".mjs").replace(/^pinballwake-/, "").replace(/-room$/, ""));
}

export async function generateBrainmap({ root = process.cwd() } = {}) {
  const pages = await walk(root, "src/pages", (file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"));
  const adminPages = pages.filter((file) => file.startsWith("src/pages/admin/"));
  const publicPages = pages.filter((file) => !file.startsWith("src/pages/admin/"));
  const toolFiles = await walk(root, "packages/mcp-server/src", (file) => file.endsWith("-tool.ts") || file.endsWith("heartbeat-protocol.ts"));
  const roomScripts = await walk(root, "scripts", (file) => /pinballwake-.*-room\.mjs$/.test(file));
  const packageJson = JSON.parse(await readText(root, "package.json") || "{}");
  const packageScripts = Object.entries(packageJson.scripts || {}).sort();
  const sourceFiles = [...new Set([...CORE_SOURCES, ...roomScripts, ...toolFiles.slice(0, 40)])];
  const manifest = await manifestRows(root, sourceFiles);

  const pageRows = [...adminPages, ...publicPages].map((file) => [
    routeForPage(file),
    titleFromName(path.basename(file)),
    sentence(meaningForPage(file)),
    file,
  ]);

  const toolRows = toolFiles.map((file) => [
    displayToolName(file),
    sentence(meaningForTool(file)),
    file,
  ]);

  const roomRows = roomScripts.map((file) => [
    roomName(file),
    `PinballWake room logic generated from ${file}.`,
    file,
  ]);

  const ciRows = packageScripts
    .filter(([name, command]) => /test|build|lint|brainmap/i.test(`${name} ${command}`))
    .map(([name, command]) => [name, command]);

  return [
    "# UnClick Ecosystem Brainmap",
    "",
    "Internal admin only. Auto-generated from tracked source so new AI seats can understand UnClick without a separate handover.",
    "",
    "## Source Manifest",
    "",
    table(["Source", "Hash", "Bytes"], manifest),
    "",
    "## UnClick Structure",
    "",
    "- UnClick is the platform: tools, memory, agents, proof, and admin surfaces.",
    "- Launchpad is the control hub for Autopilot work.",
    "- Rooms are the operational stages that route work through research, planning, build, proof, review, safety, merge, publish, repair, and improvement.",
    "- Heartbeat Master at `/admin/agents/heartbeat` teaches scheduled AI seats how to pulse safely.",
    "- Ecosystem Brainmap at `/admin/brainmap` teaches seats what the system is and what each surface means.",
    "",
    "## Pages and Meaning",
    "",
    table(["Route", "Page", "Meaning", "Source"], pageRows),
    "",
    "## Tool Families and Meaning",
    "",
    table(["Tool family", "Meaning", "Source"], toolRows),
    "",
    "## Public/Internal Alias Table",
    "",
    table(["Internal name", "Public name", "Meaning"], ALIASES),
    "",
    "## Rooms List",
    "",
    table(["Room", "Meaning", "Source"], roomRows),
    "",
    "## Workers List",
    "",
    table(["Worker", "Meaning"], WORKERS),
    "",
    "## Safety Rules",
    "",
    "- Admin-only surfaces use `RequireAdmin` and must also be hidden from non-admin sidebar navigation.",
    "- NudgeOnly can request receipt or escalation only. Trusted lanes verify before action.",
    "- IgniteOnly can request worker wake packets only. Trusted lanes still build, review, merge, and record proof.",
    "- Heartbeats must never print keys or credentials.",
    "- Generated Brainmap changes must come from source updates plus a regenerated artifact, not hand editing the generated file.",
    "- Proof should include TestPass, Reviewer, Safety Checker, and Ledger-style evidence where applicable.",
    "",
    "## Launchpad Route",
    "",
    "- Launchpad routes work from Coordinator to Builder, Tester, Reviewer, Safety Checker, and Ledger PASS.",
    "- Launchpad readiness is represented in `scripts/pinballwake-launchpad-room.mjs` and related tests.",
    "- User-facing control lives in Autopilot admin surfaces, with worker discussion in Boardroom.",
    "",
    "## Ledger Rules",
    "",
    "- Ledger records proof, approvals, receipts, worker status, rollback notes, and audit trails.",
    "- PASS means proof exists and cleanup is done.",
    "- BLOCKER means a safe reason, checked progress, and next fix are recorded.",
    "- Receipts should use source links, run ids, commit ids, PRs, or generated artifact hashes.",
    "",
    "## CI and Stale Guard",
    "",
    table(["Script", "Command"], ciRows),
    "",
    "- `node scripts/UnClick-brainmap.mjs --check` fails if `docs/UnClick-brainmap.generated.md` is stale.",
    "- `node --test scripts/UnClick-brainmap.test.mjs` verifies required sections and meaning rows.",
    "",
  ].join("\n");
}

async function main() {
  const root = process.cwd();
  const target = path.join(root, GENERATED_PATH);
  const generated = await generateBrainmap({ root });
  const check = process.argv.includes("--check");
  const existing = await readText(root, GENERATED_PATH);
  if (check) {
    if (existing !== generated) {
      console.error(`${GENERATED_PATH} is stale. Run node scripts/UnClick-brainmap.mjs.`);
      process.exitCode = 1;
    }
    return;
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, generated, "utf8");
  console.log(`Wrote ${GENERATED_PATH}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
