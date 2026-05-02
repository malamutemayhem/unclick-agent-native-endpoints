import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const scanPaths = [
  "docs/rotatepass-chunk-2-prd.md",
  "docs/rotatepass-connector-metadata.md",
  "docs/rotatepass-local-phase0.md",
  "docs/connectors/phase-1-plan.md",
  "docs/connectors/spec.md",
  "docs/connectors/system-credentials-health-panel.md",
  "docs/prd/backstagepass.md",
  "api/credentials.ts",
  "tests/rotatepass/fixtures/system-credentials.metadata.json",
];

const blockedPatterns = [
  {
    name: "openai-or-anthropic-key",
    pattern: /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  },
  {
    name: "github-token",
    pattern: /\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}\b/g,
  },
  {
    name: "slack-token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{12,}\b/g,
  },
  {
    name: "stripe-secret",
    pattern: /\b(?:sk_(?:live|test)_|whsec_)[A-Za-z0-9]{12,}\b/g,
  },
  {
    name: "jwt-shaped-token",
    pattern: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    name: "unclick-api-key",
    pattern: /\b(?:uc_|agt_)[A-Za-z0-9_-]{16,}\b/g,
  },
  {
    name: "authorization-header",
    pattern: /\bAuthorization:\s*(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/gi,
  },
  {
    name: "provider-response-access-token",
    pattern: /["']access_token["']\s*:\s*["'][A-Za-z0-9._-]{12,}["']/gi,
  },
  {
    name: "provider-response-refresh-token",
    pattern: /["']refresh_token["']\s*:\s*["'][A-Za-z0-9._-]{12,}["']/gi,
  },
  {
    name: "provider-response-id-token",
    pattern: /["']id_token["']\s*:\s*["'][A-Za-z0-9._-]{12,}["']/gi,
  },
  {
    name: "private-key-block",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  },
];

function lineForOffset(content, offset) {
  return content.slice(0, offset).split(/\r?\n/).length;
}

test("RotatePass and System Credentials public surfaces do not include secret-shaped values", () => {
  const offenders = [];

  for (const relativePath of scanPaths) {
    const absolutePath = path.join(repoRoot, relativePath);
    const content = fs.readFileSync(absolutePath, "utf8");

    for (const { name, pattern } of blockedPatterns) {
      pattern.lastIndex = 0;
      for (const match of content.matchAll(pattern)) {
        offenders.push(`${relativePath}:${lineForOffset(content, match.index ?? 0)} ${name}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Secret-shaped values found in public RotatePass/System Credentials surfaces:\n${offenders.join("\n")}`
  );
});
