import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SCANNED_FILES = [
  "docs/rotatepass-connector-metadata.md",
  "docs/connectors/system-credentials-health-panel.md",
  "docs/connectors/credential-action-routing.md",
  "docs/connectors/setup-metadata-vocabulary.md",
  "docs/rotatepass-local-phase0.md",
] as const;

const SECRET_PATTERNS = [
  { name: "UnClick API key", pattern: /\buc_[A-Za-z0-9]{16,}\b/g },
  { name: "OpenAI-style API key", pattern: /\bsk[-_][A-Za-z0-9_-]{16,}\b/g },
  { name: "Anthropic-style API key", pattern: /\bsk-ant-[A-Za-z0-9_-]{16,}\b/g },
  { name: "Slack bot token", pattern: /\bxoxb-[A-Za-z0-9-]{16,}\b/g },
  { name: "GitHub token", pattern: /\b(?:gh[pous]|ghs|pat)_[A-Za-z0-9_]{16,}\b/g },
  { name: "Stripe webhook secret", pattern: /\bwhsec_[A-Za-z0-9_]{16,}\b/g },
  { name: "Authorization bearer example", pattern: /\bAuthorization:\s*Bearer\s+[A-Za-z0-9._~+/=-]{16,}\b/g },
  { name: "X-API-Key header", pattern: /\bX-API-Key:\s*[A-Za-z0-9._~+/=-]{10,}\b/gi },
  { name: "X-Auth-Token header", pattern: /\bX-Auth-Token:\s*[A-Za-z0-9._~+/=-]{10,}\b/gi },
  { name: "Cookie header", pattern: /\bCookie:\s*[^\r\n;]{8,}/gi },
  { name: "Set-Cookie header", pattern: /\bSet-Cookie:\s*[^\r\n;]{8,}/gi },
  { name: "Provider response body wording", pattern: /\b(?:provider|api)\s+response\s+body\b/gi },
  {
    name: "JSON secret-like field value",
    pattern:
      /"(?:access_token|refresh_token|api_key|token|secret|password)"\s*:\s*"(?!<redacted>|REDACTED|\*{3,})[A-Za-z0-9._~+/=-]{10,}"/gi,
  },
];

function withoutAllowedPrefixReferenceLines(content: string): string {
  return content
    .split(/\r?\n/)
    .filter((line) => !line.includes("common secret prefixes"))
    .filter((line) => !line.includes("approved redacted example"))
    .filter((line) => !line.includes("such as `sk-`"))
    .filter((line) => !line.includes('"<redacted>"'))
    .filter((line) => !line.includes('"REDACTED"'))
    .join("\n");
}

describe("RotatePass public docs redaction", () => {
  it("does not include unredacted secret-shaped examples", () => {
    const findings: string[] = [];

    for (const file of SCANNED_FILES) {
      const content = withoutAllowedPrefixReferenceLines(readFileSync(file, "utf8"));
      for (const { name, pattern } of SECRET_PATTERNS) {
        for (const match of content.matchAll(pattern)) {
          const line = content.slice(0, match.index ?? 0).split(/\r?\n/).length;
          findings.push(`${file}:${line}: ${name}`);
        }
      }
    }

    expect(findings).toEqual([]);
  });
});
