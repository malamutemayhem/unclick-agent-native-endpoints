// scripts/review-dry-run.test.mjs

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { CHECKS, checkBody, render } from "./review-dry-run.mjs";

const FULL_BODY = `
## Summary
This PR adds the BuildBait room contract.

## Closes / refs
Closes: 11957893-9d40-463a-8755-4aa93150850f

## Test plan
node --test scripts/pinballwake-buildbait-room.test.mjs

Reviewer PASS abc12345
Safety PASS abc12345
`;

const EMPTY_BODY = "";

const PARTIAL_BODY = `
## Summary
Adds a new helper.

Closes: 4bcb3169-2c08-4f97-a6f5-3afde1b4a40c
`;

describe("CHECKS definitions", () => {
  test("each check has id, re, and message", () => {
    for (const c of CHECKS) {
      assert.equal(typeof c.id, "string");
      assert.ok(c.re instanceof RegExp);
      assert.equal(typeof c.message, "string");
    }
  });
});

describe("checkBody", () => {
  test("all markers present → empty missing list", () => {
    const r = checkBody(FULL_BODY);
    assert.deepEqual(r.missing, []);
    assert.deepEqual(
      r.present.sort(),
      ["closes_or_refs", "reviewer_pass", "safety_pass", "test_command"].sort(),
    );
  });

  test("empty body → all checks fail", () => {
    const r = checkBody(EMPTY_BODY);
    assert.equal(r.missing.length, CHECKS.length);
    assert.equal(r.present.length, 0);
  });

  test("partial body — only closes_or_refs present", () => {
    const r = checkBody(PARTIAL_BODY);
    assert.deepEqual(r.present, ["closes_or_refs"]);
    const missingIds = r.missing.map((m) => m.id).sort();
    assert.deepEqual(missingIds, ["reviewer_pass", "safety_pass", "test_command"].sort());
  });

  test("'Reviewer/Safety PASS' single marker satisfies both reviewer_pass and safety_pass", () => {
    const body = "Reviewer/Safety PASS abc12345\nCloses: x\nnode --test scripts/x.test.mjs";
    const r = checkBody(body);
    assert.ok(r.present.includes("reviewer_pass"));
    assert.ok(r.present.includes("safety_pass"));
  });

  test("multiple test command variants are recognised", () => {
    for (const cmd of ["npm test", "pnpm test", "vitest run", "node --test x.test.mjs", "playwright test"]) {
      const body = `Closes: x\nReviewer PASS y\nSafety PASS y\n${cmd}`;
      const r = checkBody(body);
      assert.ok(r.present.includes("test_command"), `expected ${cmd} to match`);
    }
  });
});

describe("render", () => {
  test("renders OK message when nothing missing", () => {
    const out = render(checkBody(FULL_BODY));
    assert.match(out, /all markers present/);
  });

  test("renders warning with missing list when something is missing", () => {
    const out = render(checkBody(PARTIAL_BODY));
    assert.match(out, /Review enforcement: 3 marker\(s\) missing/);
    assert.match(out, /Reviewer PASS/);
    assert.match(out, /Safety PASS/);
    assert.match(out, /test command/);
  });

  test("warning explicitly states non-blocking nature", () => {
    const out = render(checkBody(EMPTY_BODY));
    assert.match(out, /non-blocking/);
  });
});
