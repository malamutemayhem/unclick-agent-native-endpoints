/**
 * Integration tests for the Anti-Stomp pack.
 *
 * Tests run check handlers directly against real temp git repos, so these
 * are true integration tests of the check logic (not the DB layer).
 *
 * Note: runGitChecks DB-layer tests (updateItem / createEvidence) are
 * blocked by the same ESM jest.mock hoisting issue affecting
 * deterministic.test.ts. Address both at the same time when fixing that
 * pre-existing issue.
 */

import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { GIT_HANDLERS, type GitContext } from "../runner/git.js";
import { loadPackFromFile, loadPackFromYaml } from "../pack-loader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ANTI_STOMP_PACK_PATH = path.resolve(__dirname, "../../packs/anti-stomp-v0.yaml");

// ─── Git repo fixture helpers ─────────────────────────────────────────────────

interface TempRepo {
  dir: string;
  cleanup: () => void;
}

function createTempRepo(): TempRepo {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "testpass-anti-stomp-"));
  function git(args: string) {
    execSync(`git ${args}`, { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
  }
  git("init");
  git("config user.email testpass@example.com");
  git("config user.name TestPass");
  try { git("config advice.detachedHead false"); } catch { /* optional */ }
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

function writeAndCommit(
  repoDir: string,
  files: Record<string, string>,
  message: string,
): void {
  for (const [relPath, content] of Object.entries(files)) {
    const abs = path.join(repoDir, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf-8");
  }
  execSync("git add -A", { cwd: repoDir, stdio: ["pipe", "pipe", "pipe"] });
  execSync(`git commit -m "${message}"`, { cwd: repoDir, stdio: ["pipe", "pipe", "pipe"] });
}

function removeAndCommit(repoDir: string, filePaths: string[], message: string): void {
  for (const relPath of filePaths) {
    fs.rmSync(path.join(repoDir, relPath), { force: true });
  }
  execSync("git add -A", { cwd: repoDir, stdio: ["pipe", "pipe", "pipe"] });
  execSync(`git commit -m "${message}"`, { cwd: repoDir, stdio: ["pipe", "pipe", "pipe"] });
}

// ─── Pack schema ──────────────────────────────────────────────────────────────

describe("anti-stomp-v0.yaml - schema validation", () => {
  it("loads and validates without errors", () => {
    const pack = loadPackFromFile(ANTI_STOMP_PACK_PATH);
    expect(pack.id).toBe("anti-stomp-v0");
    expect(pack.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pack.items.length).toBe(8);
  });

  it("contains all 8 check IDs", () => {
    const pack = loadPackFromFile(ANTI_STOMP_PACK_PATH);
    const ids = pack.items.map((i) => i.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "DELETE-001", "DELETE-002",
        "ORPHAN-001", "ORPHAN-002",
        "SURFACE-001", "SURFACE-002",
        "IMPORT-001", "AUDIT-001",
      ]),
    );
  });

  it("all items are check_type deterministic", () => {
    const pack = loadPackFromFile(ANTI_STOMP_PACK_PATH);
    for (const item of pack.items) {
      expect(item.check_type).toBe("deterministic");
    }
  });

  it("RED - rejects pack with invalid semver", () => {
    const bad = `
id: anti-stomp-v0
name: Anti-Stomp v0
version: not-semver
items:
  - id: DELETE-001
    title: Test
    category: deletion-audit
    severity: high
    check_type: deterministic
`;
    expect(() => loadPackFromYaml(bad)).toThrow("schema validation failed");
  });

  it("RED - rejects pack with empty items array", () => {
    const bad = `id: anti-stomp-v0\nname: Anti-Stomp\nversion: 0.1.0\nitems: []`;
    expect(() => loadPackFromYaml(bad)).toThrow("schema validation failed");
  });
});

// ─── DELETE-001: Files deleted without rationale ──────────────────────────────

describe("DELETE-001 - Files deleted without rationale", () => {
  let repo: TempRepo;

  beforeEach(() => {
    repo = createTempRepo();
    writeAndCommit(
      repo.dir,
      {
        "src/pages/Memory.tsx": "export default function Memory() { return null; }",
        "src/pages/Tools.tsx": "export default function Tools() { return null; }",
        "src/components/Widget.tsx": "export default function Widget() { return null; }",
      },
      "initial",
    );
  });

  afterEach(() => repo.cleanup());

  it("GREEN - passes when deleted file path is in PR body", async () => {
    removeAndCommit(repo.dir, ["src/pages/Memory.tsx"], "remove Memory page");
    const ctx: GitContext = {
      repoPath: repo.dir,
      base: "HEAD~1",
      head: "HEAD",
      prTitle: "Remove deprecated Memory page",
      prBody: "## Deletions\n- src/pages/Memory.tsx: deprecated in sprint 14",
    };
    const result = await GIT_HANDLERS["DELETE-001"]!(ctx);
    expect(result.verdict).toBe("check");
  });

  it("GREEN - passes when deleted file basename is in PR body", async () => {
    removeAndCommit(repo.dir, ["src/pages/Memory.tsx"], "remove Memory page");
    const ctx: GitContext = {
      repoPath: repo.dir,
      base: "HEAD~1",
      head: "HEAD",
      prTitle: "Remove deprecated Memory page",
      prBody: "Removed Memory.tsx because the feature was retired.",
    };
    const result = await GIT_HANDLERS["DELETE-001"]!(ctx);
    expect(result.verdict).toBe("check");
  });

  it("RED - fails when deleted file is not mentioned in PR body", async () => {
    removeAndCommit(repo.dir, ["src/pages/Memory.tsx"], "silent stomp");
    const ctx: GitContext = {
      repoPath: repo.dir,
      base: "HEAD~1",
      head: "HEAD",
      prTitle: "Refactor dashboard",
      prBody: "Various improvements to dashboard layout and performance.",
    };
    const result = await GIT_HANDLERS["DELETE-001"]!(ctx);
    expect(result.verdict).toBe("fail");
    expect(result.note).toContain("Memory.tsx");
  });

  it("RED - fails when multiple files deleted and none mentioned", async () => {
    removeAndCommit(
      repo.dir,
      ["src/pages/Memory.tsx", "src/components/Widget.tsx"],
      "stomp two files",
    );
    const ctx: GitContext = {
      repoPath: repo.dir,
      base: "HEAD~1",
      head: "HEAD",
      prTitle: "Cleanup",
      prBody: "Minor cleanup.",
    };
    const result = await GIT_HANDLERS["DELETE-001"]!(ctx);
    expect(result.verdict).toBe("fail");
  });

  it("NA - when no relevant files are deleted", async () => {
    writeAndCommit(repo.dir, { "docs/README.md": "# Docs" }, "add readme");
    removeAndCommit(repo.dir, ["docs/README.md"], "remove readme");
    const ctx: GitContext = {
      repoPath: repo.dir,
      base: "HEAD~1",
      head: "HEAD",
      prTitle: "Remove readme",
      prBody: "Remove readme.",
    };
    const result = await GIT_HANDLERS["DELETE-001"]!(ctx);
    expect(result.verdict).toBe("na");
  });

  it("includes a shell trace in evidence", async () => {
    removeAndCommit(repo.dir, ["src/pages/Memory.tsx"], "stomp");
    const ctx: GitContext = {
      repoPath: repo.dir,
      base: "HEAD~1",
      head: "HEAD",
      prTitle: "Refactor",
      prBody: "Some changes.",
    };
    const result = await GIT_HANDLERS["DELETE-001"]!(ctx);
    expect(result.traces.length).toBeGreaterThan(0);
    expect(result.traces[0].command).toContain("diff");
    expect(result.traces[0].output).toContain("Memory.tsx");
  });

  it("monitors packages/*/src/ paths", async () => {
    writeAndCommit(
      repo.dir,
      { "packages/mcp-server/src/tool-wiring.ts": "export const x = 1;" },
      "add package file",
    );
    removeAndCommit(repo.dir, ["packages/mcp-server/src/tool-wiring.ts"], "stomp package file");
    const ctx: GitContext = {
      repoPath: repo.dir,
      base: "HEAD~1",
      head: "HEAD",
      prTitle: "Refactor",
      prBody: "Nothing relevant.",
    };
    const result = await GIT_HANDLERS["DELETE-001"]!(ctx);
    expect(result.verdict).toBe("fail");
    expect(result.note).toContain("tool-wiring.ts");
  });
});

// ─── AUDIT-001: Restore/reorg PRs must include archaeology ───────────────────

describe("AUDIT-001 - Restore/reorg PRs must include archaeology", () => {
  // AUDIT-001 only inspects prTitle + prBody - no git repo needed.
  const fakeCtx = (prTitle: string, prBody: string): GitContext => ({
    repoPath: os.tmpdir(),
    base: "main",
    head: "HEAD",
    prTitle,
    prBody,
  });

  it("GREEN - passes when title has 'restore' and body has Archaeology section", async () => {
    const ctx = fakeCtx(
      "restore Memory sub-nav",
      [
        "## Summary",
        "Restores the 5-tab Memory sub-nav.",
        "",
        "## Archaeology",
        "```",
        "git log --all --diff-filter=D --name-only --pretty=format: -- 'src/pages/admin/memory/*' | sort -u",
        "src/pages/admin/memory/MemoryTimeline.tsx  -> restore",
        "src/pages/admin/memory/MemoryMap.tsx       -> archive",
        "```",
      ].join("\n"),
    );
    const result = await GIT_HANDLERS["AUDIT-001"]!(ctx);
    expect(result.verdict).toBe("check");
  });

  it("GREEN - passes with 'Pre-restore audit' section in body", async () => {
    const ctx = fakeCtx(
      "fix nav sidebar links",
      "## Pre-restore audit\nChecked history - sidebar had 9 items before the reorg.",
    );
    const result = await GIT_HANDLERS["AUDIT-001"]!(ctx);
    expect(result.verdict).toBe("check");
  });

  it("GREEN - passes (NA) when no trigger keywords in title", async () => {
    const ctx = fakeCtx("add dark mode toggle", "No archaeology needed for new features.");
    const result = await GIT_HANDLERS["AUDIT-001"]!(ctx);
    expect(result.verdict).toBe("na");
  });

  it("RED - fails when title has 'restore' but no archaeology section", async () => {
    const ctx = fakeCtx(
      "restore Memory sub-nav",
      "## Summary\nRestores the nav.\n\n## Test plan\n- [ ] Memory loads",
    );
    const result = await GIT_HANDLERS["AUDIT-001"]!(ctx);
    expect(result.verdict).toBe("fail");
    expect(result.note).toContain("restore");
  });

  it("RED - fails when title has 'reorg' and body is empty", async () => {
    const ctx = fakeCtx("admin reorg pass 2", "");
    const result = await GIT_HANDLERS["AUDIT-001"]!(ctx);
    expect(result.verdict).toBe("fail");
  });

  it("RED - fails when title has 'sidebar' and body has no archaeology", async () => {
    const ctx = fakeCtx(
      "fix sidebar overlap on mobile",
      "## Summary\nFixed CSS overflow on sidebar.",
    );
    const result = await GIT_HANDLERS["AUDIT-001"]!(ctx);
    expect(result.verdict).toBe("fail");
  });

  it("RED - all five trigger keywords independently fire the check", async () => {
    const TRIGGERS = ["restore", "reorg", "refactor", "fix nav", "sidebar"];
    for (const kw of TRIGGERS) {
      const ctx = fakeCtx(`${kw} something`, "No archaeology section here.");
      const result = await GIT_HANDLERS["AUDIT-001"]!(ctx);
      expect(result.verdict).toBe("fail");
    }
  });

  it("RED - case-insensitive trigger match", async () => {
    const ctx = fakeCtx("RESTORE Memory Tabs", "Summary only, no archaeology.");
    const result = await GIT_HANDLERS["AUDIT-001"]!(ctx);
    expect(result.verdict).toBe("fail");
  });
});

// ─── Profile filtering ────────────────────────────────────────────────────────

describe("profile filtering in pack definition", () => {
  let pack: ReturnType<typeof loadPackFromFile>;

  beforeAll(() => { pack = loadPackFromFile(ANTI_STOMP_PACK_PATH); });

  it("DELETE-001 is in smoke profile", () => {
    const item = pack.items.find((i) => i.id === "DELETE-001")!;
    expect(item.profiles).toContain("smoke");
  });

  it("AUDIT-001 is in smoke profile", () => {
    const item = pack.items.find((i) => i.id === "AUDIT-001")!;
    expect(item.profiles).toContain("smoke");
  });

  it("ORPHAN-002 is deep-only", () => {
    const item = pack.items.find((i) => i.id === "ORPHAN-002")!;
    expect(item.profiles).toContain("deep");
    expect(item.profiles).not.toContain("smoke");
  });

  it("SURFACE-001 is deep-only", () => {
    const item = pack.items.find((i) => i.id === "SURFACE-001")!;
    expect(item.profiles).toEqual(["deep"]);
  });

  it("DELETE-002 and IMPORT-001 are standard+deep only", () => {
    for (const id of ["DELETE-002", "IMPORT-001"]) {
      const item = pack.items.find((i) => i.id === id)!;
      expect(item.profiles).not.toContain("smoke");
      expect(item.profiles).toContain("standard");
    }
  });
});

// ─── GIT_HANDLERS export ──────────────────────────────────────────────────────

describe("GIT_HANDLERS export", () => {
  it("exports a handler for every check ID in the pack", () => {
    const pack = loadPackFromFile(ANTI_STOMP_PACK_PATH);
    for (const item of pack.items) {
      expect(GIT_HANDLERS[item.id]).toBeDefined();
    }
  });
});
