import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { extractMemoryTypedLinkCandidates } from "../typed-links.js";

describe("memory typed-link extraction", () => {
  test("extracts deterministic references from fact text", () => {
    const links = extractMemoryTypedLinkCandidates({
      source_kind: "fact",
      source_id: "fact-1",
      text:
        "Chris decided job 6e125b76-3238-4425-940f-28a287d85f51 should use PR #887, commit 64c8668, and packages/mcp-server/src/memory/handlers.ts.",
    });

    assert.deepEqual(
      links.map((link) => [link.relation, link.target_kind, link.target_text]),
      [
        ["decided", "person", "Chris"],
        ["references", "todo", "6e125b76-3238-4425-940f-28a287d85f51"],
        ["references", "pr", "PR #887"],
        ["references", "commit", "64c8668"],
        ["references", "file", "packages/mcp-server/src/memory/handlers.ts"],
      ]
    );
  });

  test("uses sentence context for ship and block relations", () => {
    const links = extractMemoryTypedLinkCandidates({
      source_kind: "fact",
      source_id: "fact-2",
      text:
        "PR #887 merged after checks. Work is blocked by owner approval. Memory uses CommonSensePass proof before PASS.",
    });

    assert.equal(findTarget(links, "PR #887")?.relation, "ships");
    assert.equal(findTarget(links, "owner approval")?.relation, "blocks");
    assert.equal(findTarget(links, "Memory")?.relation, "relates_to");
    assert.equal(findTarget(links, "CommonSensePass")?.relation, "relates_to");
  });

  test("extracts conversation receipts and ownership hints", () => {
    const links = extractMemoryTypedLinkCandidates({
      source_kind: "conversation_turn",
      source_id: "turn-1",
      text:
        "Receipt 588aef27-646d-4359-9973-66394f2c0171 is assigned to unclick-heartbeat-seat for https://github.com/malamutemayhem/unclick/pull/887.",
    });

    assert.deepEqual(
      links.map((link) => [link.relation, link.target_kind, link.target_text]),
      [
        ["references", "receipt", "588aef27-646d-4359-9973-66394f2c0171"],
        ["owns", "person", "unclick-heartbeat-seat"],
        ["references", "pr", "PR #887"],
        ["references", "url", "https://github.com/malamutemayhem/unclick/pull/887"],
      ]
    );
  });

  test("marks secret-shaped evidence without exposing values", () => {
    const links = extractMemoryTypedLinkCandidates({
      source_kind: "fact",
      source_id: "fact-3",
      text: "PR #888 was checked while api key=sk-test1234567890abcdef stayed hidden.",
    });

    const prLink = findTarget(links, "PR #888");
    assert.equal(prLink?.redaction_state, "blocked_secret_risk");
    assert.equal(prLink?.evidence_span.text.includes("sk-test1234567890abcdef"), false);
    assert.equal(prLink?.evidence_span.text.includes("[redacted]"), true);
  });

  test("returns stable output for repeated runs", () => {
    const input = {
      source_kind: "fact" as const,
      source_id: "fact-4",
      text: "Chris authored TestPass notes. PR #900 shipped with docs/testpass-phase-9a-visual-brief.md.",
    };

    assert.deepEqual(extractMemoryTypedLinkCandidates(input), extractMemoryTypedLinkCandidates(input));
  });
});

function findTarget(
  links: ReturnType<typeof extractMemoryTypedLinkCandidates>,
  targetText: string
): ReturnType<typeof extractMemoryTypedLinkCandidates>[number] | undefined {
  return links.find((link) => link.target_text === targetText);
}
