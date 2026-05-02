import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type FixtureRow = {
  provider?: string;
  credentialLabel?: string;
  credentialType?: string;
  ownerHint?: string;
  usedBy?: string[];
  healthStatus?: string;
  rotationStatus?: string;
  lastCheckedAt?: string | null;
  lastRotatedAt?: string | null;
  safeProbeKind?: string;
  evidenceSource?: string;
  redactedReason?: string | null;
  verificationTarget?: string;
  rotationNote?: string;
};

const FIXTURE_PATH = "tests/rotatepass/fixtures/system-credentials.metadata.json";

const BANNED_PATTERNS = [
  { name: "OpenAI secret literal", pattern: /\bsk[-_][A-Za-z0-9_-]{10,}\b/g },
  { name: "GitHub token literal", pattern: /\b(?:gh[pous]|ghs|pat)_[A-Za-z0-9_]{10,}\b/g },
  { name: "Slack token literal", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { name: "Authorization bearer header", pattern: /\bAuthorization:\s*Bearer\s+\S+/gi },
  { name: "Cookie-like assignment", pattern: /\bset-cookie\s*:/gi },
  { name: "Provider response body wording", pattern: /\b(?:provider|api)\s+response\s+body\b/gi },
];

function scannedFields(row: FixtureRow): Array<{ field: string; value: string }> {
  const fields: Array<{ field: string; value: string | undefined | null }> = [
    { field: "ownerHint", value: row.ownerHint },
    { field: "verificationTarget", value: row.verificationTarget },
    { field: "rotationNote", value: row.rotationNote },
  ];
  return fields
    .filter((entry): entry is { field: string; value: string } => typeof entry.value === "string")
    .map(({ field, value }) => ({ field, value }));
}

describe("RotatePass metadata fixture redaction", () => {
  it("keeps human-readable metadata fields free of secret-like content", () => {
    const fixtureRows = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as FixtureRow[];
    const findings: string[] = [];

    for (let index = 0; index < fixtureRows.length; index += 1) {
      const row = fixtureRows[index];
      for (const { field, value } of scannedFields(row)) {
        for (const { name, pattern } of BANNED_PATTERNS) {
          if (pattern.test(value)) {
            findings.push(`row ${index + 1} ${field}: ${name}`);
          }
          pattern.lastIndex = 0;
        }
      }
    }

    expect(findings).toEqual([]);
  });
});
