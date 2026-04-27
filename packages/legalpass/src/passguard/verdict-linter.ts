// PassGuard verdict-linter
// ------------------------
// Enforces the verb library at render time. Any text emitted as a verdict by
// LegalPass (or any other Pass that wires this in) must use language that
// stays inside the issue-spotter / information-only frame.
//
// This protects the immutable design rule: never produce a transactional
// legal instrument, never recommend a specific action, never hold out as a
// practitioner. Forbidden phrases imply directive or definitive language.
//
// Designed to be portable across the Pass family (LegalPass, SecurityPass,
// UXPass, FlowPass, BackstagePass) once PassGuard is split into its own
// package.

export interface LintIssue {
  phrase: string;
  index: number;
  reason: string;
}

export interface LintResult {
  ok: boolean;
  issues: LintIssue[];
}

// Forbidden directive verbs. Match whole-word, case-insensitive.
// Order matters only for reporting - first match wins per character index.
export const FORBIDDEN_PHRASES: ReadonlyArray<{ phrase: string; reason: string }> = [
  { phrase: "should", reason: "directive verb - implies a recommendation" },
  { phrase: "must", reason: "directive verb - implies an obligation" },
  { phrase: "you need to", reason: "directive phrasing - implies an instruction" },
  { phrase: "you have to", reason: "directive phrasing - implies an instruction" },
  { phrase: "we recommend", reason: "first-person recommendation - prohibited" },
  { phrase: "this is illegal", reason: "definitive legal conclusion - prohibited" },
  { phrase: "you will win", reason: "outcome prediction - prohibited" },
  { phrase: "you will lose", reason: "outcome prediction - prohibited" },
];

// Allowed framing language. Surfaced for tooling and documentation only;
// not a whitelist (the linter is a denylist).
export const ALLOWED_PHRASES: ReadonlyArray<string> = [
  "appears",
  "may",
  "consider",
  "in similar contracts",
  "warrants review",
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function lintVerdictText(text: string): LintResult {
  const issues: LintIssue[] = [];
  for (const { phrase, reason } of FORBIDDEN_PHRASES) {
    const pattern = new RegExp(`\\b${escapeRegex(phrase)}\\b`, "gi");
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      issues.push({ phrase, index: match.index, reason });
    }
  }
  issues.sort((a, b) => a.index - b.index);
  return { ok: issues.length === 0, issues };
}

// Throws if the text contains forbidden phrases. Use at render boundaries
// where dropping the verdict is safer than emitting it (e.g. final API
// response, UI render).
export function assertVerdictText(text: string, context = "verdict"): void {
  const result = lintVerdictText(text);
  if (result.ok) return;
  const detail = result.issues
    .map((i) => `"${i.phrase}" at ${i.index} (${i.reason})`)
    .join("; ");
  throw new Error(
    `[passguard:verdict-linter] ${context} contains forbidden phrasing: ${detail}`
  );
}
