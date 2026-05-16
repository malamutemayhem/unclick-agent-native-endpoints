import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { persistTypedLinksForMemoryWrite } from "../handlers.js";
import {
  extractMemoryTypedLinkCandidates,
  filterAndRankMemoryTypedLinks,
  memoryTypedLinkStoredRowToCandidate,
} from "../typed-links.js";
import type { SaveTypedLinkCandidatesResult } from "../types.js";
import type { MemoryTypedLinkCandidate, MemoryTypedLinkStoredRow } from "../typed-links.js";

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

  test("persists extracted links after a memory write", async () => {
    const saved: MemoryTypedLinkCandidate[][] = [];
    const result = await persistTypedLinksForMemoryWrite(
      {
        async saveTypedLinkCandidates(candidates): Promise<SaveTypedLinkCandidatesResult> {
          saved.push(candidates);
          return { saved: candidates.length };
        },
      },
      {
        source_kind: "fact",
        source_id: "fact-5",
        text: "PR #901 shipped with receipt 588aef27-646d-4359-9973-66394f2c0171.",
      }
    );

    assert.equal(result.saved, 2);
    assert.deepEqual(
      saved[0].map((link) => [link.relation, link.target_kind, link.target_text]),
      [
        ["ships", "pr", "PR #901"],
        ["references", "receipt", "588aef27-646d-4359-9973-66394f2c0171"],
      ]
    );
  });

  test("persistence helper keeps primary write safe on storage failure", async () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      const result = await persistTypedLinksForMemoryWrite(
        {
          async saveTypedLinkCandidates(): Promise<SaveTypedLinkCandidatesResult> {
            throw new Error("storage offline");
          },
        },
        {
          source_kind: "conversation_turn",
          source_id: "turn-2",
          text: "CommonSensePass referenced PR #902.",
        }
      );

      assert.deepEqual(result, { saved: 0, skipped: "persistence_failed" });
    } finally {
      console.error = originalError;
    }
  });

  test("search helper ranks exact targets before evidence-only matches", () => {
    const rows: MemoryTypedLinkStoredRow[] = [
      storedLink({
        id: "older-evidence",
        target_text: "Memory",
        evidence_text: "PR #889 persisted typed links for Memory.",
        created_at: "2026-05-16T20:00:00.000Z",
      }),
      storedLink({
        id: "exact-pr",
        target_kind: "pr",
        target_text: "PR #889",
        evidence_text: "PR #889 persisted typed links.",
        created_at: "2026-05-16T19:00:00.000Z",
      }),
      storedLink({
        id: "unrelated",
        target_text: "Passport",
        evidence_text: "Passport owns Git connections.",
        created_at: "2026-05-16T21:00:00.000Z",
      }),
    ];

    const results = filterAndRankMemoryTypedLinks(rows, "PR #889", 10);

    assert.deepEqual(results.map((result) => result.id), ["exact-pr", "older-evidence"]);
    assert.equal(results[0].target_text, "PR #889");
    assert.equal(results[0].match_score > results[1].match_score, true);
  });

  test("search helper converts stored rows back to candidate evidence", () => {
    const row = storedLink({
      id: "stored-1",
      source_kind: "conversation_turn",
      source_id: "turn-9",
      target_kind: "receipt",
      target_text: "588aef27-646d-4359-9973-66394f2c0171",
      evidence_start: 4,
      evidence_end: 58,
      evidence_text: "Receipt 588aef27-646d-4359-9973-66394f2c0171 shipped proof.",
    });

    assert.deepEqual(memoryTypedLinkStoredRowToCandidate(row), {
      source_kind: "conversation_turn",
      source_id: "turn-9",
      relation: "references",
      target_kind: "receipt",
      target_text: "588aef27-646d-4359-9973-66394f2c0171",
      confidence: 0.9,
      evidence_span: {
        start: 4,
        end: 58,
        text: "Receipt 588aef27-646d-4359-9973-66394f2c0171 shipped proof.",
      },
      redaction_state: "clean",
    });
  });
});

function findTarget(
  links: ReturnType<typeof extractMemoryTypedLinkCandidates>,
  targetText: string
): ReturnType<typeof extractMemoryTypedLinkCandidates>[number] | undefined {
  return links.find((link) => link.target_text === targetText);
}

function storedLink(overrides: Partial<MemoryTypedLinkStoredRow>): MemoryTypedLinkStoredRow {
  return {
    id: "link-1",
    source_kind: "fact",
    source_id: "fact-1",
    relation: "references",
    target_kind: "tool",
    target_text: "Memory",
    confidence: 0.9,
    evidence_start: 0,
    evidence_end: 20,
    evidence_text: "Memory references PR #889.",
    redaction_state: "clean",
    created_at: "2026-05-16T20:00:00.000Z",
    ...overrides,
  };
}
