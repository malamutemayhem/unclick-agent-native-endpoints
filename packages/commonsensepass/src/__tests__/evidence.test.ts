import { describe, expect, it } from "vitest";
import {
  checkEvidenceEnvelope,
  createEvidenceFingerprint,
  EvidenceReceipt,
  finalizeEvidenceReceipt,
} from "../evidence.js";

const NOW_MS = Date.parse("2026-05-16T21:45:00.000Z");
const HEAD_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const STALE_SHA = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function freshReceipt(overrides: Partial<EvidenceReceipt> = {}): EvidenceReceipt {
  return finalizeEvidenceReceipt({
    source_kind: "pr",
    source_id: "893",
    fetched_at: "2026-05-16T21:40:00.000Z",
    head_sha: HEAD_SHA,
    run_id: "run-893",
    proof_refs: ["checks:success", "pr:893"],
    freshness_window_ms: 10 * 60 * 1000,
    ...overrides,
  });
}

describe("CommonSensePass evidence receipts", () => {
  it("creates stable fingerprints for equivalent proof refs", () => {
    const first = createEvidenceFingerprint({
      source_kind: "pr",
      source_id: "893",
      fetched_at: "2026-05-16T21:40:00.000Z",
      head_sha: HEAD_SHA,
      run_id: "run-893",
      proof_refs: ["checks:success", "pr:893"],
      freshness_window_ms: 10 * 60 * 1000,
    });
    const second = createEvidenceFingerprint({
      source_kind: "pr",
      source_id: "893",
      fetched_at: "2026-05-16T21:40:00.000Z",
      head_sha: HEAD_SHA,
      run_id: "run-893",
      proof_refs: ["pr:893", "checks:success"],
      freshness_window_ms: 10 * 60 * 1000,
    });

    expect(second).toBe(first);
  });

  it("PASSes a complete fresh evidence envelope", () => {
    const result = checkEvidenceEnvelope(
      {
        created_at: "2026-05-16T21:41:00.000Z",
        receipts: [freshReceipt()],
      },
      { now_ms: NOW_MS, current_head_sha: HEAD_SHA },
    );

    expect(result.verdict).toBe("PASS");
    expect(result.evidence[0].source_kind).toBe("pr");
    expect(result.evidence[0].evidence_fingerprint).toHaveLength(64);
  });

  it("HOLDs when required evidence fields are missing", () => {
    const receipt = {
      ...freshReceipt(),
      source_id: "",
      head_sha: undefined,
    };
    const result = checkEvidenceEnvelope(
      {
        created_at: "2026-05-16T21:41:00.000Z",
        receipts: [receipt],
      },
      { now_ms: NOW_MS, current_head_sha: HEAD_SHA },
    );

    expect(result.verdict).toBe("HOLD");
    expect(result.reason).toContain("source_id");
    expect(result.reason).toContain("head_sha");
  });

  it("BLOCKERs stale receipts outside the freshness window", () => {
    const result = checkEvidenceEnvelope(
      {
        created_at: "2026-05-16T21:41:00.000Z",
        receipts: [
          freshReceipt({
            fetched_at: "2026-05-16T21:00:00.000Z",
            freshness_window_ms: 10 * 60 * 1000,
          }),
        ],
      },
      { now_ms: NOW_MS, current_head_sha: HEAD_SHA },
    );

    expect(result.verdict).toBe("BLOCKER");
    expect(result.next_action).toBe("refresh_evidence_receipt");
  });

  it("BLOCKERs receipts fetched against a stale head SHA", () => {
    const result = checkEvidenceEnvelope(
      {
        created_at: "2026-05-16T21:41:00.000Z",
        receipts: [freshReceipt({ head_sha: STALE_SHA })],
      },
      { now_ms: NOW_MS, current_head_sha: HEAD_SHA },
    );

    expect(result.verdict).toBe("BLOCKER");
    expect(result.next_action).toBe("refresh_evidence_on_current_head");
  });
});
