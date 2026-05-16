/**
 * Pure check logic for the Anti-Stomp pack (anti-stomp-v0.yaml).
 *
 * All functions are side-effect free and take plain values so they can be
 * unit-tested without a git repo or database. The runner layer is responsible
 * for collecting the inputs (git diff output, PR body, etc.) and calling these.
 */

export interface CheckResult {
  pass: boolean;
  missing?: string[];
  reason?: string;
}

export interface GitStatusEntry {
  status: string;
  path: string;
}

// ── DELETE-001 ──────────────────────────────────────────────────────────────

/**
 * Every path in deletedFiles must appear verbatim somewhere in prBody.
 * Returns pass=true and an empty missing array when all files are mentioned.
 */
export function checkDeletedFilesMentioned(
  deletedFiles: string[],
  prBody: string,
): CheckResult {
  const missing = deletedFiles.filter((f) => !prBody.includes(f));
  return { pass: missing.length === 0, missing };
}

// ── AUDIT-001 ───────────────────────────────────────────────────────────────

const AUDIT_TITLE_TRIGGERS = [
  "restore",
  "reorg",
  "refactor",
  "fix nav",
  "fix sidebar",
];

const ARCHAEOLOGY_SECTIONS = ["## archaeology", "## pre-restore audit"];

/**
 * If prTitle contains a trigger keyword, prBody must contain an Archaeology
 * section heading. Returns pass=true when not triggered or when the section
 * is present.
 */
export function checkAuditRequiresArchaeology(
  prTitle: string,
  prBody: string,
): CheckResult {
  const titleLower = prTitle.toLowerCase();
  const triggered = AUDIT_TITLE_TRIGGERS.some((t) => titleLower.includes(t));

  if (!triggered) {
    return { pass: true, reason: "PR title does not trigger archaeology requirement" };
  }

  const bodyLower = prBody.toLowerCase();
  const hasSection = ARCHAEOLOGY_SECTIONS.some((s) => bodyLower.includes(s));

  return {
    pass: hasSection,
    reason: hasSection
      ? "Archaeology section present"
      : `PR title matches trigger but body has no "## Archaeology" or "## Pre-restore audit" section`,
  };
}

// ── GIT-LINK-001 ────────────────────────────────────────────────────────────

const GIT_LINK_TRIGGER_CATEGORIES = new Set(["built", "shipped", "change"]);

export interface FactLinkInput {
  category?: string;
  commit_sha?: string | null;
  pr_number?: number | null;
}

/**
 * For facts in trigger categories, at least one of commit_sha or pr_number
 * must be non-null. Facts in other categories always pass.
 */
export function checkFactHasGitLink(fact: FactLinkInput): CheckResult {
  if (!fact.category || !GIT_LINK_TRIGGER_CATEGORIES.has(fact.category)) {
    return { pass: true, reason: `Category "${fact.category ?? "unknown"}" does not require git linkage` };
  }

  const linked = Boolean(fact.commit_sha) || typeof fact.pr_number === "number";
  return {
    pass: linked,
    reason: linked
      ? "Fact has git linkage"
      : `Fact in category "${fact.category}" has neither commit_sha nor pr_number`,
  };
}

// GIT-HYGIENE-001

export function parseGitStatusPorcelain(statusText: string): GitStatusEntry[] {
  return String(statusText ?? "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => ({
      status: line.slice(0, 2).trim(),
      path: line.slice(3).trim() || line.trim(),
    }));
}

export function checkGitStatusClean(statusText: string): CheckResult {
  const dirty = parseGitStatusPorcelain(statusText);
  if (dirty.length === 0) {
    return { pass: true, reason: "git status --porcelain returned no changes" };
  }

  return {
    pass: false,
    missing: dirty.map((entry) => entry.path),
    reason: `git status --porcelain reported ${dirty.length} uncommitted path(s)`,
  };
}
