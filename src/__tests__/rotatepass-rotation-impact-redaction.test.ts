import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROTATION_DOCS = [
  "docs/connectors/credential-action-routing.md",
  "docs/connectors/system-credentials-health-panel.md",
] as const;

const FORBIDDEN_SECRET_PATTERNS: readonly RegExp[] = [
  /\b(?:Authorization|Proxy-Authorization)\s*:/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/i,
  /\b(?:Set-Cookie|Cookie)\s*:/i,
  /\b(?:gh[pous]|ghs|pat)_[A-Za-z0-9_]{8,}\b/i,
  /\bsk[-_][A-Za-z0-9_-]{8,}\b/i,
  /\bxox[baprs]-[A-Za-z0-9-]{8,}\b/i,
  /\bwhsec_[A-Za-z0-9_]{8,}\b/i,
  /"(?:access_token|refresh_token|api_key|token|secret|password)"\s*:\s*"(?!<redacted>|REDACTED|\*{3,})[^"]{8,}"/i,
];

function rotationGuidanceLines(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => /rotat|rotation/i.test(line));
}

describe("RotatePass rotation guidance redaction", () => {
  it("keeps rotation guidance metadata-only", () => {
    const findings: string[] = [];

    for (const file of ROTATION_DOCS) {
      const lines = rotationGuidanceLines(readFileSync(file, "utf8"));
      lines.forEach((line, index) => {
        FORBIDDEN_SECRET_PATTERNS.forEach((pattern) => {
          if (pattern.test(line)) {
            findings.push(`${file}:${index + 1}: ${line}`);
          }
        });
      });
    }

    expect(findings).toEqual([]);
  });
});
