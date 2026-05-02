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
  "docs/connectors/credential-action-routing.md",
  "docs/connectors/setup-metadata-vocabulary.md",
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
    name: "cookie-header",
    pattern: /\bCookie:\s*[A-Za-z0-9._~+/%-]{2,}\s*=\s*[A-Za-z0-9._~+/%=-]{8,}/gi,
  },
  {
    name: "set-cookie-header",
    pattern: /\bSet-Cookie:\s*[A-Za-z0-9._~+/%-]{2,}\s*=\s*[A-Za-z0-9._~+/%=-]{8,}/gi,
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

test("redaction guard patterns catch representative secret-shaped examples", () => {
  const examples = new Map([
    ["openai-or-anthropic-key", "sk-exampleSecretValue123456"],
    ["github-token", "ghp_exampleSecretValue1234567890"],
    ["slack-token", "xoxb-123456789012-secret"],
    ["stripe-secret", "sk_live_exampleSecretValue"],
    ["jwt-shaped-token", "eyJaaaaaaaaaaaaaaaaaaaa.eyJbbbbbbbbbbbbbbbbbbbb.cccccccccccccccccccccc"],
    ["unclick-api-key", "uc_exampleSecretValue123"],
    ["authorization-header", "Authorization: Bearer exampleSecretValue123"],
    ["cookie-header", "Cookie: sid=exampleSecretValue123"],
    ["set-cookie-header", "Set-Cookie: sid=exampleSecretValue123"],
    ["provider-response-access-token", "\"access_token\":\"exampleSecretValue\""],
    ["provider-response-refresh-token", "\"refresh_token\":\"exampleSecretValue\""],
    ["provider-response-id-token", "\"id_token\":\"exampleSecretValue\""],
    ["private-key-block", "-----BEGIN PRIVATE KEY-----"],
  ]);

  for (const { name, pattern } of blockedPatterns) {
    const example = examples.get(name);
    assert.ok(example, `Missing positive fixture for ${name}`);
    pattern.lastIndex = 0;
    assert.match(example, pattern, `${name} did not match its positive fixture`);
  }
});

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
