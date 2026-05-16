import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPackFromFile } from "../pack-loader.js";
import {
  checkDeletedFilesMentioned,
  checkAuditRequiresArchaeology,
  checkFactHasGitLink,
  checkGitStatusClean,
  parseGitStatusPorcelain,
} from "../checks/anti-stomp.js";
import { isDeterministicCheckRegistered } from "../runner/deterministic.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACK_PATH = path.resolve(__dirname, "../../packs/anti-stomp-v0.yaml");

// ── Pack schema validation ──────────────────────────────────────────────────

describe("anti-stomp-v0.yaml", () => {
  it("loads and validates without errors", () => {
    const pack = loadPackFromFile(PACK_PATH);
    expect(pack.id).toBe("anti-stomp-v0");
    expect(pack.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pack.items.length).toBeGreaterThanOrEqual(11);
  });

  it("contains all required check IDs", () => {
    const pack = loadPackFromFile(PACK_PATH);
    const ids = pack.items.map((i) => i.id);
    const required = [
      "DELETE-001", "DELETE-002",
      "ORPHAN-001", "ORPHAN-002",
      "SURFACE-001", "SURFACE-002",
      "IMPORT-001",
      "AUDIT-001",
      "GIT-LINK-001",
      "GIT-HYGIENE-001",
      "PR-TEMPLATE-001",
    ];
    for (const id of required) {
      expect(ids).toContain(id);
    }
  });

  it("every item has a non-empty on_fail string", () => {
    const pack = loadPackFromFile(PACK_PATH);
    for (const item of pack.items) {
      expect(item.on_fail?.trim().length).toBeGreaterThan(0);
    }
  });
});

// ── DELETE-001: checkDeletedFilesMentioned ─────────────────────────────────

describe("DELETE-001: checkDeletedFilesMentioned", () => {
  it("passes when all deleted files are mentioned in PR body", () => {
    const result = checkDeletedFilesMentioned(
      ["src/pages/OldPage.tsx", "src/components/OldWidget.tsx"],
      "## Deletions\n- src/pages/OldPage.tsx: replaced by NewPage\n- src/components/OldWidget.tsx: no longer used",
    );
    expect(result.pass).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("fails when a deleted file is NOT mentioned in PR body", () => {
    const result = checkDeletedFilesMentioned(
      ["src/pages/OldPage.tsx", "src/components/OldWidget.tsx"],
      "## Summary\nCleaned up some old code",
    );
    expect(result.pass).toBe(false);
    expect(result.missing).toContain("src/pages/OldPage.tsx");
    expect(result.missing).toContain("src/components/OldWidget.tsx");
  });

  it("fails for only the unlisted file when one of two is mentioned", () => {
    const result = checkDeletedFilesMentioned(
      ["src/pages/Foo.tsx", "src/pages/Bar.tsx"],
      "Removed src/pages/Foo.tsx because it was unused.",
    );
    expect(result.pass).toBe(false);
    expect(result.missing).toEqual(["src/pages/Bar.tsx"]);
  });

  it("passes with an empty deletion list", () => {
    const result = checkDeletedFilesMentioned([], "any PR body");
    expect(result.pass).toBe(true);
  });
});

// ── AUDIT-001: checkAuditRequiresArchaeology ───────────────────────────────

describe("AUDIT-001: checkAuditRequiresArchaeology", () => {
  it("passes when title triggers and Archaeology section is present", () => {
    const result = checkAuditRequiresArchaeology(
      "feat: restore admin nav sidebar",
      "## Summary\nFixed nav\n\n## Archaeology\ngit log output here",
    );
    expect(result.pass).toBe(true);
  });

  it("passes when title triggers and Pre-restore audit section is present", () => {
    const result = checkAuditRequiresArchaeology(
      "fix: reorg memory admin tabs",
      "## Pre-restore audit\nFound 3 deleted files",
    );
    expect(result.pass).toBe(true);
  });

  it("fails when title triggers but no Archaeology section exists", () => {
    const result = checkAuditRequiresArchaeology(
      "feat: restore memory tabs to 7-tab design",
      "## Summary\nRestored tabs\n\n## Testing\nnpm test",
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/Archaeology/i);
  });

  it("passes (no-op) when PR title does not trigger the check", () => {
    const result = checkAuditRequiresArchaeology(
      "feat(seo): add dynamic sitemap endpoint",
      "## Summary\nAdded sitemap",
    );
    expect(result.pass).toBe(true);
    expect(result.reason).toMatch(/does not trigger/i);
  });

  it("is case-insensitive for title matching", () => {
    const result = checkAuditRequiresArchaeology(
      "FEAT: REFACTOR auth middleware",
      "## Summary\nNo archaeology here",
    );
    expect(result.pass).toBe(false);
  });
});

// ── GIT-LINK-001: checkFactHasGitLink ─────────────────────────────────────

describe("GIT-LINK-001: checkFactHasGitLink", () => {
  it("passes when fact has commit_sha", () => {
    const result = checkFactHasGitLink({
      category: "shipped",
      commit_sha: "abc1234def5678",
    });
    expect(result.pass).toBe(true);
  });

  it("passes when fact has pr_number", () => {
    const result = checkFactHasGitLink({
      category: "built",
      pr_number: 106,
    });
    expect(result.pass).toBe(true);
  });

  it("fails when fact in trigger category has neither commit_sha nor pr_number", () => {
    const result = checkFactHasGitLink({ category: "shipped" });
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/commit_sha/);
  });

  it("fails when commit_sha is null and pr_number is null", () => {
    const result = checkFactHasGitLink({
      category: "change",
      commit_sha: null,
      pr_number: null,
    });
    expect(result.pass).toBe(false);
  });

  it("passes (no-op) for facts in non-trigger categories", () => {
    const result = checkFactHasGitLink({ category: "general" });
    expect(result.pass).toBe(true);
    expect(result.reason).toMatch(/does not require/i);
  });

  it("passes (no-op) for facts with category preference", () => {
    const result = checkFactHasGitLink({ category: "preference" });
    expect(result.pass).toBe(true);
  });

  it("passes (no-op) when category is undefined", () => {
    const result = checkFactHasGitLink({});
    expect(result.pass).toBe(true);
  });
});

// GIT-HYGIENE-001: checkGitStatusClean

describe("GIT-HYGIENE-001: checkGitStatusClean", () => {
  it("is registered with the deterministic runner", () => {
    expect(isDeterministicCheckRegistered("GIT-HYGIENE-001")).toBe(true);
  });

  it("passes when git status porcelain output is empty", () => {
    const result = checkGitStatusClean("");
    expect(result.pass).toBe(true);
  });

  it("fails and names dirty files when git status porcelain has entries", () => {
    const result = checkGitStatusClean(" M api/memory-admin.ts\n?? scripts/new-check.mjs\n");
    expect(result.pass).toBe(false);
    expect(result.missing).toEqual(["api/memory-admin.ts", "scripts/new-check.mjs"]);
    expect(result.reason).toMatch(/2 uncommitted path/);
  });

  it("parses renamed paths without losing the porcelain status", () => {
    expect(parseGitStatusPorcelain("R  old/path.ts -> new/path.ts\n")).toEqual([
      { status: "R", path: "old/path.ts -> new/path.ts" },
    ]);
  });
});
