import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";

import {
  readReviewBodyFromArgs,
  validateReviewBody,
} from "./review-dry-run.mjs";

const COMPLETE_BODY = `
## Summary
- Adds a review dry-run.

## Changes
- scripts/review-dry-run.mjs

## Owner and lift status
- Owner: chatgpt-codex-fleet-seat
- Non-overlap: no runtime merge gates touched
- Status: ready for review

## Review handoff
- Reviewer or lane: reviewer
- Human decision pending: None
- Merge policy: review-only

## Testing
- PASS: node --test scripts/review-dry-run.test.mjs
`;

describe("review dry-run", () => {
  it("passes when required review and proof sections are filled", () => {
    const result = validateReviewBody(COMPLETE_BODY);
    assert.equal(result.ok, true);
    assert.deepEqual(result.missing_sections, []);
    assert.deepEqual(result.empty_sections, []);
  });

  it("fails when the review handoff section is missing", () => {
    const result = validateReviewBody(COMPLETE_BODY.replace(/\n## Review handoff[\s\S]*?\n## Testing/, "\n## Testing"));
    assert.equal(result.ok, false);
    assert.deepEqual(result.missing_sections, ["review handoff"]);
  });

  it("fails when template placeholders are not filled", () => {
    const result = validateReviewBody(`
## Summary
<!-- 1-3 bullets -->
-

## Changes
-

## Owner and lift status
- Owner:
- Non-overlap:
- Status:

## Review handoff
- Reviewer or lane:
- Human decision pending:
- Merge policy:

## Testing
-
`);
    assert.equal(result.ok, false);
    assert.deepEqual(result.empty_sections, [
      "summary",
      "changes",
      "owner and lift status",
      "review handoff",
      "testing",
    ]);
  });

  it("reads a pull request body from a GitHub event file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "review-dry-run-"));
    const eventFile = join(dir, "event.json");
    await writeFile(eventFile, JSON.stringify({ pull_request: { body: COMPLETE_BODY } }));

    const body = await readReviewBodyFromArgs(["--github-event", eventFile]);
    assert.equal(body, COMPLETE_BODY);
    assert.equal(validateReviewBody(body).ok, true);
  });
});
