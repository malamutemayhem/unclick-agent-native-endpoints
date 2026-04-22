/**
 * Git-based check runner for the Anti-Stomp pack.
 *
 * Executes registered check handlers against a local git repo in a PR context
 * (base ref, head ref, PR title, PR body). Writes verdicts and evidence to
 * Supabase via run-manager, mirroring the pattern in deterministic.ts.
 *
 * Items without a registered handler are skipped (left as pending).
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Pack, RunProfile } from "../types.js";
import type { RunManagerConfig } from "../run-manager.js";
import { updateItem, createEvidence } from "../run-manager.js";

// ─── Public context type ─────────────────────────────────────────────────────

export interface GitContext {
  repoPath: string; // absolute path to the local git repo
  base: string;     // base ref (e.g. "main", "HEAD~1", commit SHA)
  head: string;     // head ref (e.g. "HEAD", branch name, commit SHA)
  prTitle: string;
  prBody: string;
}

// ─── Internal types ──────────────────────────────────────────────────────────

interface ShellTrace {
  command: string;
  output: string;
}

type CheckVerdict = "check" | "fail" | "na" | "other";

interface CheckOutcome {
  verdict: CheckVerdict;
  note?: string;
  traces: ShellTrace[];
}

type GitCheckHandler = (ctx: GitContext) => Promise<CheckOutcome>;

// ─── git helper ──────────────────────────────────────────────────────────────

function gitExec(repoPath: string, args: string): string {
  try {
    return execSync(`git ${args}`, {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

/**
 * Count files that mention `name` in the tree at `ref`.
 * git grep output with a ref has lines like `ref:filepath`, so we split on ":"
 * and exclude the file itself.
 */
function grepRefCount(repoPath: string, ref: string, name: string, excludeFile = ""): number {
  try {
    const out = execSync(`git grep -l "${name}" ${ref}`, {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (!out) return 0;
    return out
      .split("\n")
      .filter(Boolean)
      .map((l) => (l.includes(":") ? l.split(":").slice(1).join(":") : l))
      .filter((f) => f !== excludeFile).length;
  } catch {
    return 0; // grep exits 1 on no matches
  }
}

// ─── Check handlers ──────────────────────────────────────────────────────────

const MONITORED_RE = /^(src\/pages\/|src\/components\/|src\/admin\/|api\/|packages\/[^/]+\/src\/)/;

const HANDLERS: Record<string, GitCheckHandler> = {

  // DELETE-001: Files deleted without rationale
  "DELETE-001": async (ctx) => {
    const args = `diff --name-only --diff-filter=D ${ctx.base}..${ctx.head}`;
    const output = gitExec(ctx.repoPath, args);
    const deleted = output ? output.split("\n").filter(Boolean) : [];
    const trace: ShellTrace = { command: `git ${args}`, output: output || "(none)" };

    const relevant = deleted.filter((f) => MONITORED_RE.test(f));
    if (relevant.length === 0) {
      return { verdict: "na", note: "No relevant files deleted", traces: [trace] };
    }

    const unmentioned = relevant.filter((f) => {
      const basename = path.basename(f);
      return !ctx.prBody.includes(f) && !ctx.prBody.includes(basename);
    });

    if (unmentioned.length === 0) {
      return {
        verdict: "check",
        note: `${relevant.length} deletion(s) all documented in PR body`,
        traces: [trace],
      };
    }

    return {
      verdict: "fail",
      note: `Undocumented deletion(s): ${unmentioned.join(", ")}`,
      traces: [trace],
    };
  },

  // DELETE-002: Routes removed from router without rationale
  "DELETE-002": async (ctx) => {
    const routerCandidates = ["src/App.tsx", "src/routes.tsx", "src/router.tsx"];
    let routerFile = "";
    for (const f of routerCandidates) {
      if (gitExec(ctx.repoPath, `ls-files ${f}`)) { routerFile = f; break; }
    }
    if (!routerFile) return { verdict: "na", note: "No router file found", traces: [] };

    const args = `diff ${ctx.base}..${ctx.head} -- ${routerFile}`;
    const output = gitExec(ctx.repoPath, args);
    const trace: ShellTrace = { command: `git ${args}`, output: output || "(no changes)" };

    if (!output) return { verdict: "na", note: `No changes to ${routerFile}`, traces: [trace] };

    const removedRoutes = output
      .split("\n")
      .filter((l) => l.startsWith("-") && !l.startsWith("---"))
      .filter((l) => /<Route|path=["']/.test(l));

    if (removedRoutes.length === 0) {
      return { verdict: "check", note: "No <Route> elements removed", traces: [trace] };
    }

    const extractedPaths = removedRoutes
      .map((l) => l.match(/path=["']([^"']+)["']/)?.[1])
      .filter(Boolean) as string[];

    const unmentioned = extractedPaths.filter((p) => !ctx.prBody.includes(p));
    if (unmentioned.length === 0) {
      return {
        verdict: "check",
        note: `${removedRoutes.length} removed route(s) all documented`,
        traces: [trace],
      };
    }

    return {
      verdict: "fail",
      note: `Undocumented route removal(s): ${unmentioned.join(", ")}`,
      traces: [trace],
    };
  },

  // ORPHAN-001: Stranded components with no imports
  "ORPHAN-001": async (ctx) => {
    const listArgs = `ls-tree -r --name-only ${ctx.head} -- src/components/ src/pages/`;
    const listOutput = gitExec(ctx.repoPath, listArgs);
    const files = listOutput
      ? listOutput.split("\n").filter((f) => /\.(tsx|ts)$/.test(f))
      : [];
    const traces: ShellTrace[] = [
      { command: `git ${listArgs}`, output: listOutput || "(none)" },
    ];

    const orphaned: string[] = [];

    for (const file of files) {
      if (/(__tests__|\.test\.|\.spec\.)/.test(file)) continue;

      const content = gitExec(ctx.repoPath, `show ${ctx.head}:${file}`);
      if (content.includes("// @entrypoint")) continue;

      const name = path.basename(file).replace(/\.(tsx|ts)$/, "");
      const importers = grepRefCount(ctx.repoPath, ctx.head, name, file);
      if (importers === 0) orphaned.push(file);
    }

    if (orphaned.length === 0) {
      return {
        verdict: "check",
        note: `All ${files.length} component(s) have at least one import reference`,
        traces,
      };
    }

    return {
      verdict: "fail",
      note: `${orphaned.length} orphaned component(s): ${orphaned.join(", ")}`,
      traces,
    };
  },

  // ORPHAN-002: Abandoned restructure branches
  "ORPHAN-002": async (ctx) => {
    const args = "branch -a --sort=-committerdate";
    const output = gitExec(ctx.repoPath, args);
    const trace: ShellTrace = { command: `git ${args}`, output: output || "(none)" };

    if (!output) return { verdict: "na", note: "No branches found", traces: [trace] };

    const KEYWORDS = /restructure|refactor|redesign|restore/i;
    const branches = output
      .split("\n")
      .slice(0, 30)
      .map((b) => b.trim().replace(/^\* /, "").replace(/^remotes\/[^/]+\//, ""))
      .filter((b) => KEYWORDS.test(b) && b !== ctx.base && b !== ctx.head);

    if (branches.length === 0) {
      return { verdict: "na", note: "No restructure/refactor/redesign/restore branches found", traces: [trace] };
    }

    const mergedOutput = gitExec(ctx.repoPath, "branch --merged main");
    const mergedBranches = mergedOutput.split("\n").map((b) => b.trim().replace(/^\* /, ""));

    const unmerged = branches.filter((b) => !mergedBranches.includes(b));
    if (unmerged.length === 0) {
      return { verdict: "check", note: "All restructure branches are merged into main", traces: [trace] };
    }

    const details = unmerged.map((b) => {
      const date = gitExec(ctx.repoPath, `log -1 --format="%ar" ${b}`);
      return `${b} (${date || "unknown date"})`;
    });

    return {
      verdict: "fail",
      note: `Unmerged restructure branch(es): ${details.join("; ")}`,
      traces: [trace],
    };
  },

  // SURFACE-001: Per-surface design memory cross-check
  "SURFACE-001": async (ctx) => {
    const memArgs = `ls-tree -r --name-only ${ctx.head} -- .auto-memory/`;
    const memOutput = gitExec(ctx.repoPath, memArgs);
    const trace: ShellTrace = { command: `git ${memArgs}`, output: memOutput || "(none)" };

    if (!memOutput) {
      return { verdict: "na", note: "No .auto-memory/ files found (check skipped)", traces: [trace] };
    }

    const memFiles = memOutput.split("\n").filter((f) => /project-.*-ui\.md$/.test(f));
    if (memFiles.length === 0) {
      return { verdict: "na", note: "No project-*-ui.md memory files found", traces: [trace] };
    }

    const missing: string[] = [];
    const traces: ShellTrace[] = [trace];

    for (const memFile of memFiles) {
      const content = gitExec(ctx.repoPath, `show ${ctx.head}:${memFile}`);
      if (!content) continue;

      const structureMatch = content.match(/## Current structure\n([\s\S]+?)(?=\n##|$)/);
      if (!structureMatch) continue;

      const items =
        structureMatch[1]
          .match(/^[-*]\s+(.+)$/gm)
          ?.map((l) => l.replace(/^[-*]\s+/, "").trim()) ?? [];

      for (const item of items) {
        const found = grepRefCount(ctx.repoPath, ctx.head, item);
        if (found === 0) missing.push(`${item} (from ${memFile})`);
      }
    }

    if (missing.length === 0) {
      return { verdict: "check", note: "All memory-listed items found in code", traces };
    }

    return {
      verdict: "fail",
      note: `Memory items missing from code: ${missing.join("; ")}`,
      traces,
    };
  },

  // SURFACE-002: Navigation tree diff
  "SURFACE-002": async (ctx) => {
    const navCandidates = [
      "src/pages/admin/AdminShell.tsx",
      "src/components/Sidebar.tsx",
      "src/components/Nav.tsx",
    ];
    let navFile = "";
    for (const f of navCandidates) {
      if (gitExec(ctx.repoPath, `ls-files ${f}`)) { navFile = f; break; }
    }

    if (!navFile) {
      const grepOut = gitExec(
        ctx.repoPath,
        `grep -rl "NavLink\\|SidebarNav\\|sidebar-item" -- *.tsx`,
      );
      if (grepOut) navFile = grepOut.split("\n")[0];
    }

    if (!navFile) return { verdict: "na", note: "No nav config file found", traces: [] };

    const args = `diff ${ctx.base}..${ctx.head} -- ${navFile}`;
    const output = gitExec(ctx.repoPath, args);
    const trace: ShellTrace = { command: `git ${args}`, output: output || "(no changes)" };

    if (!output) return { verdict: "na", note: `No changes to ${navFile}`, traces: [trace] };

    const removedLines = output
      .split("\n")
      .filter((l) => l.startsWith("-") && !l.startsWith("---"))
      .filter((l) => /NavLink|href=|to=|sidebar-item/.test(l));

    if (removedLines.length === 0) {
      return { verdict: "check", note: "No nav items removed", traces: [trace] };
    }

    const unmentioned = removedLines.filter((l) => {
      const labelMatch = l.match(/["']([^"']{3,})["']/);
      if (labelMatch) return !ctx.prBody.includes(labelMatch[1]);
      return !ctx.prBody.toLowerCase().includes("nav");
    });

    if (unmentioned.length === 0) {
      return {
        verdict: "check",
        note: `${removedLines.length} nav item removal(s) documented`,
        traces: [trace],
      };
    }

    return {
      verdict: "fail",
      note: `${unmentioned.length} undocumented nav removal(s): ${unmentioned
        .slice(0, 3)
        .map((l) => l.trim())
        .join("; ")}`,
      traces: [trace],
    };
  },

  // IMPORT-001: Component usage collapse
  "IMPORT-001": async (ctx) => {
    const diffArgs = `diff --name-only ${ctx.base}..${ctx.head}`;
    const changedOutput = gitExec(ctx.repoPath, diffArgs);
    const changedFiles = changedOutput
      ? changedOutput
          .split("\n")
          .filter((f) => /^src\/(components|pages)\/.*\.(tsx|ts)$/.test(f))
      : [];
    const trace: ShellTrace = { command: `git ${diffArgs}`, output: changedOutput || "(none)" };

    if (changedFiles.length === 0) {
      return { verdict: "na", note: "No component files changed", traces: [trace] };
    }

    const retired: Array<{ file: string; baseCount: number }> = [];

    for (const file of changedFiles) {
      const name = path.basename(file).replace(/\.(tsx|ts)$/, "");
      const baseCount = grepRefCount(ctx.repoPath, ctx.base, name, file);
      const headCount = grepRefCount(ctx.repoPath, ctx.head, name, file);
      if (baseCount > 0 && headCount === 0) {
        retired.push({ file, baseCount });
      }
    }

    if (retired.length === 0) {
      return { verdict: "check", note: "No component usage collapse detected", traces: [trace] };
    }

    const unmentioned = retired.filter(({ file }) => {
      const basename = path.basename(file);
      return !ctx.prBody.includes(file) && !ctx.prBody.includes(basename);
    });

    if (unmentioned.length === 0) {
      return {
        verdict: "check",
        note: `${retired.length} component retirement(s) all documented`,
        traces: [trace],
      };
    }

    return {
      verdict: "fail",
      note: `Undocumented component retirement(s): ${unmentioned
        .map((r) => `${r.file} (${r.baseCount} -> 0 imports)`)
        .join(", ")}`,
      traces: [trace],
    };
  },

  // AUDIT-001: Restore/reorg PRs must include archaeology
  "AUDIT-001": async (ctx) => {
    const TRIGGERS = ["restore", "reorg", "refactor", "fix nav", "sidebar"];
    const lowerTitle = ctx.prTitle.toLowerCase();
    const matched = TRIGGERS.find((kw) => lowerTitle.includes(kw));

    if (!matched) {
      return { verdict: "na", note: "PR title does not trigger AUDIT-001", traces: [] };
    }

    const REQUIRED_SECTIONS = ["Archaeology", "Pre-restore audit"];
    const hasSection = REQUIRED_SECTIONS.some((s) => ctx.prBody.includes(s));

    if (hasSection) {
      return { verdict: "check", note: "Archaeology section present in PR body", traces: [] };
    }

    return {
      verdict: "fail",
      note: `PR title matched "${matched}" but no 'Archaeology' or 'Pre-restore audit' section found in PR body`,
      traces: [],
    };
  },
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Run all registered git check handlers against the given repo + PR context.
 * Items with no registered handler are skipped (left as pending).
 * Checks run in parallel; each writes its own evidence + verdict row.
 */
export async function runGitChecks(
  config: RunManagerConfig,
  runId: string,
  ctx: GitContext,
  pack: Pack,
  profile: RunProfile,
): Promise<void> {
  const items = pack.items.filter(
    (i) => !i.profiles || i.profiles.includes(profile),
  );

  await Promise.all(
    items.map(async (item) => {
      const handler = HANDLERS[item.id];
      if (!handler) return;

      const checkStart = Date.now();
      let outcome: CheckOutcome;
      try {
        outcome = await handler(ctx);
      } catch (err) {
        outcome = {
          verdict: "other",
          note: `Runner exception: ${(err as Error).message}`,
          traces: [],
        };
      }
      const time_ms = Date.now() - checkStart;

      let evidenceRef: string | undefined;
      if (outcome.traces.length > 0) {
        try {
          evidenceRef = await createEvidence(config, {
            kind: "log",
            payload: outcome.traces,
          });
        } catch {
          // evidence write failure is non-fatal
        }
      }

      await updateItem(config, runId, item.id, {
        verdict: outcome.verdict,
        on_fail_comment: outcome.note,
        time_ms,
        cost_usd: 0,
        evidence_ref: evidenceRef,
      });
    }),
  );
}

/**
 * Export the handler map for direct use in tests.
 */
export { HANDLERS as GIT_HANDLERS };
