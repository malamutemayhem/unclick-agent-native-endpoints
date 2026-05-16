// scripts/check-dirty-branch.test.mjs

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { parseChangedFiles, detectLeaks, render, LEAK_PRONE_FILES } from "./check-dirty-branch.mjs";

describe("parseChangedFiles", () => {
  test("splits multi-line output and trims", () => {
    const text = "api/memory-admin.ts\nserver.ts\n\nsrc/lib/foo.ts\n";
    const files = parseChangedFiles(text);
    assert.deepEqual(files, ["api/memory-admin.ts", "server.ts", "src/lib/foo.ts"]);
  });

  test("ignores warning lines", () => {
    const text = "warning: LF will be replaced\nsrc/lib/foo.ts\n";
    const files = parseChangedFiles(text);
    assert.deepEqual(files, ["src/lib/foo.ts"]);
  });

  test("normalises backslashes to forward slashes", () => {
    const text = "api\\memory-admin.ts\n";
    const files = parseChangedFiles(text);
    assert.deepEqual(files, ["api/memory-admin.ts"]);
  });
});

describe("detectLeaks", () => {
  test("no leak when no leak-prone files touched", () => {
    const leaks = detectLeaks({
      changedFiles: ["src/lib/foo.ts", "src/lib/bar.ts"],
      prBody: "Adds new helpers.",
    });
    assert.deepEqual(leaks, []);
  });

  test("flags api/memory-admin.ts touched without mention", () => {
    const leaks = detectLeaks({
      changedFiles: ["src/lib/foo.ts", "api/memory-admin.ts"],
      prBody: "Adds new helpers for foo.",
    });
    assert.equal(leaks.length, 1);
    assert.equal(leaks[0].file, "api/memory-admin.ts");
    assert.equal(leaks[0].reason, "leak_prone_file_touched_without_scope_mention");
  });

  test("flags server.ts touched without mention", () => {
    const leaks = detectLeaks({
      changedFiles: ["server.ts"],
      prBody: "Updates frontend.",
    });
    assert.equal(leaks.length, 1);
    assert.equal(leaks[0].file, "server.ts");
  });

  test("PASS when api/memory-admin.ts is mentioned in body", () => {
    const leaks = detectLeaks({
      changedFiles: ["api/memory-admin.ts"],
      prBody: "Fixes api/memory-admin.ts handler return shape.",
    });
    assert.deepEqual(leaks, []);
  });

  test("PASS when memory-admin mnemonic appears in body", () => {
    const leaks = detectLeaks({
      changedFiles: ["api/memory-admin.ts"],
      prBody: "Adjusts memory-admin error code.",
    });
    assert.deepEqual(leaks, []);
  });

  test("PASS when 'memory admin' (space form) appears", () => {
    const leaks = detectLeaks({
      changedFiles: ["api/memory-admin.ts"],
      prBody: "Updates memory admin endpoint to return JSON.",
    });
    assert.deepEqual(leaks, []);
  });

  test("PASS when server.ts mentioned via 'bootstrap' mnemonic", () => {
    const leaks = detectLeaks({
      changedFiles: ["server.ts"],
      prBody: "Adjusts bootstrap to register new middleware.",
    });
    assert.deepEqual(leaks, []);
  });

  test("multiple leaks reported when multiple files touched without mention", () => {
    const leaks = detectLeaks({
      changedFiles: ["api/memory-admin.ts", "server.ts", "src/lib/foo.ts"],
      prBody: "Adds foo helper.",
    });
    assert.equal(leaks.length, 2);
    const fileSet = new Set(leaks.map((l) => l.file));
    assert.ok(fileSet.has("api/memory-admin.ts"));
    assert.ok(fileSet.has("server.ts"));
  });

  test("mention only resolves the file it names — others still flagged", () => {
    const leaks = detectLeaks({
      changedFiles: ["api/memory-admin.ts", "server.ts"],
      prBody: "Adjusts memory-admin handler.",
    });
    assert.equal(leaks.length, 1);
    assert.equal(leaks[0].file, "server.ts");
  });

  test("empty PR body treats touches as unmentioned", () => {
    const leaks = detectLeaks({
      changedFiles: ["api/memory-admin.ts"],
      prBody: "",
    });
    assert.equal(leaks.length, 1);
  });

  test("custom leak-prone list overrides default", () => {
    const leaks = detectLeaks({
      changedFiles: ["custom-leak.ts"],
      prBody: "",
      leakProneFiles: ["custom-leak.ts"],
    });
    assert.equal(leaks.length, 1);
    assert.equal(leaks[0].file, "custom-leak.ts");
  });
});

describe("render", () => {
  test("renders clean message when no leaks", () => {
    const out = render({ changedFiles: ["src/lib/foo.ts"], leaks: [] });
    assert.match(out, /No dirty-branch leaks detected/);
  });

  test("renders warning with revert instructions when leaks present", () => {
    const out = render({
      changedFiles: ["api/memory-admin.ts", "src/lib/foo.ts"],
      leaks: [{ file: "api/memory-admin.ts", reason: "leak_prone_file_touched_without_scope_mention" }],
    });
    assert.match(out, /1 dirty-branch leak/);
    assert.match(out, /git checkout origin\/main -- api\/memory-admin\.ts/);
  });
});

describe("LEAK_PRONE_FILES exports", () => {
  test("contains the known two leak-prone files at minimum", () => {
    assert.ok(LEAK_PRONE_FILES.includes("api/memory-admin.ts"));
    assert.ok(LEAK_PRONE_FILES.includes("server.ts"));
  });
});
