// scripts/audit-api-keys-legacy-refs.test.mjs

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { TARGET, isExpectedReference, shouldScanFile, renderText } from "./audit-api-keys-legacy-refs.mjs";

let tmp;

before(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "audit-akl-"));
  // Files with live references — should be blocking.
  await fs.mkdir(path.join(tmp, "src", "lib"), { recursive: true });
  await fs.writeFile(
    path.join(tmp, "src", "lib", "users.ts"),
    `// uses the legacy table\nexport async function getKey() { return await db.api_keys_legacy.findOne(); }\n`,
  );
  await fs.writeFile(
    path.join(tmp, "src", "lib", "audit.ts"),
    `// SQL: SELECT api_keys_legacy FROM credentials;\n`,
  );

  // Doc reference — should NOT block.
  await fs.mkdir(path.join(tmp, "docs", "security"), { recursive: true });
  await fs.writeFile(
    path.join(tmp, "docs", "security", "api_keys_legacy-deactivation.md"),
    `Runbook for deactivating api_keys_legacy rows.\n`,
  );

  // Clean repo (no refs).
  await fs.mkdir(path.join(tmp, "clean"), { recursive: true });
  await fs.writeFile(
    path.join(tmp, "clean", "ok.ts"),
    `// nothing about legacy keys here\n`,
  );

  // Ignored dirs.
  await fs.mkdir(path.join(tmp, "node_modules", "x"), { recursive: true });
  await fs.writeFile(
    path.join(tmp, "node_modules", "x", "leaky.ts"),
    `api_keys_legacy should not be picked up here\n`,
  );
});

after(async () => {
  if (tmp) await fs.rm(tmp, { recursive: true, force: true });
});

describe("TARGET regex", () => {
  test("matches the canonical spelling", () => {
    assert.equal(TARGET.test("api_keys_legacy"), true);
  });
  test("matches case-insensitive variants and hyphen/underscore swaps", () => {
    assert.equal(TARGET.test("API_KEYS_LEGACY"), true);
    assert.equal(TARGET.test("Api-Keys-Legacy"), true);
    assert.equal(TARGET.test("apikeyslegacy"), true);
  });
  test("does NOT match unrelated names", () => {
    assert.equal(TARGET.test("api_keys"), false);
    assert.equal(TARGET.test("apikeyhash"), false);
  });
});

describe("isExpectedReference", () => {
  test("recognises docs/security path", () => {
    assert.equal(isExpectedReference("docs/security/api_keys_legacy-deactivation.md"), true);
  });
  test("recognises the audit script itself", () => {
    assert.equal(isExpectedReference("scripts/audit-api-keys-legacy-refs.mjs"), true);
    assert.equal(isExpectedReference("scripts/audit-api-keys-legacy-refs.test.mjs"), true);
  });
  test("recognises CHANGELOG", () => {
    assert.equal(isExpectedReference("CHANGELOG.md"), true);
  });
  test("does NOT recognise regular code files", () => {
    assert.equal(isExpectedReference("src/lib/users.ts"), false);
    assert.equal(isExpectedReference("api/keys.ts"), false);
  });
});

describe("shouldScanFile", () => {
  test("scans common text/code extensions", () => {
    for (const f of ["a.ts", "b.tsx", "c.js", "d.mjs", "e.sql", "f.md", "g.json", "h.yml", "i.yaml"]) {
      assert.equal(shouldScanFile(f), true);
    }
  });
  test("skips binaries", () => {
    for (const f of ["a.png", "b.jpg", "c.pdf", "d.exe", "e.zip", "f.indd"]) {
      assert.equal(shouldScanFile(f), false);
    }
  });
});

describe("auditRoot end-to-end (real fs)", () => {
  test("blocking findings when live refs exist", async () => {
    const { auditRoot } = await import("./audit-api-keys-legacy-refs.mjs");
    const r = await auditRoot(tmp);
    assert.equal(r.safeToProceed, false);
    assert.ok(r.findings.length >= 2);
    const files = r.findings.map((f) => f.file).sort();
    assert.ok(files.includes("src/lib/users.ts"));
    assert.ok(files.includes("src/lib/audit.ts"));
  });

  test("doc reference goes into expectedFindings, not findings", async () => {
    const { auditRoot } = await import("./audit-api-keys-legacy-refs.mjs");
    const r = await auditRoot(tmp);
    const expectedFiles = r.expectedFindings.map((f) => f.file);
    assert.ok(expectedFiles.some((f) => f.includes("docs/security/api_keys_legacy-deactivation.md")));
  });

  test("clean-only directory is safe", async () => {
    const cleanTmp = await fs.mkdtemp(path.join(os.tmpdir(), "audit-akl-clean-"));
    await fs.writeFile(path.join(cleanTmp, "ok.ts"), `// nothing\n`);
    try {
      const { auditRoot } = await import("./audit-api-keys-legacy-refs.mjs");
      const r = await auditRoot(cleanTmp);
      assert.equal(r.safeToProceed, true);
      assert.equal(r.findings.length, 0);
    } finally {
      await fs.rm(cleanTmp, { recursive: true, force: true });
    }
  });

  test("node_modules contents are ignored", async () => {
    const { auditRoot } = await import("./audit-api-keys-legacy-refs.mjs");
    const r = await auditRoot(tmp);
    const inNodeModules = r.findings.some((f) => f.file.includes("node_modules"));
    assert.equal(inNodeModules, false);
  });
});

describe("renderText", () => {
  test("renders clean-safe message when no blocking findings", () => {
    const out = renderText({
      root: "/x",
      target: "x",
      filesScanned: 10,
      findings: [],
      expectedFindings: [{ file: "docs/security/runbook.md", line: 1 }],
      safeToProceed: true,
    });
    assert.match(out, /No live references/);
    assert.match(out, /deactivation\.md/);
  });

  test("renders blocking message and lists offenders when findings present", () => {
    const out = renderText({
      root: "/x",
      target: "x",
      filesScanned: 10,
      findings: [{ file: "src/lib/users.ts", line: 5, excerpt: "uses api_keys_legacy" }],
      expectedFindings: [],
      safeToProceed: false,
    });
    assert.match(out, /not safe yet/i);
    assert.match(out, /src\/lib\/users\.ts:5/);
  });
});
