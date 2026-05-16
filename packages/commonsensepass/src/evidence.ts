import { createHash } from "node:crypto";
import type { CommonSensePassResult, Evidence } from "./schema.js";

export const DEFAULT_EVIDENCE_FRESHNESS_WINDOW_MS = 30 * 60 * 1000;

export interface EvidenceReceiptDraft {
  source_kind: string;
  source_id: string;
  fetched_at: string;
  head_sha?: string;
  run_id?: string;
  proof_refs?: string[];
  freshness_window_ms?: number;
}

export interface EvidenceReceipt extends EvidenceReceiptDraft {
  evidence_fingerprint: string;
}

export interface EvidenceEnvelope {
  created_at: string;
  receipts: EvidenceReceipt[];
}

export interface EvidenceCheckContext {
  now_ms: number;
  current_head_sha?: string;
  default_freshness_window_ms?: number;
}

function stableReceiptPayload(receipt: EvidenceReceiptDraft): string {
  return JSON.stringify({
    source_kind: receipt.source_kind,
    source_id: receipt.source_id,
    fetched_at: receipt.fetched_at,
    head_sha: receipt.head_sha ?? null,
    run_id: receipt.run_id ?? null,
    proof_refs: [...(receipt.proof_refs ?? [])].sort(),
    freshness_window_ms: receipt.freshness_window_ms ?? null,
  });
}

export function createEvidenceFingerprint(receipt: EvidenceReceiptDraft): string {
  return createHash("sha256")
    .update(stableReceiptPayload(receipt))
    .digest("hex");
}

export function finalizeEvidenceReceipt(
  receipt: EvidenceReceiptDraft,
): EvidenceReceipt {
  return {
    ...receipt,
    proof_refs: receipt.proof_refs ? [...receipt.proof_refs].sort() : undefined,
    evidence_fingerprint: createEvidenceFingerprint(receipt),
  };
}

function toEvidence(receipt: EvidenceReceipt, note?: string): Evidence {
  return {
    kind: receipt.source_kind,
    ref: receipt.source_id,
    note,
    source_kind: receipt.source_kind,
    source_id: receipt.source_id,
    fetched_at: receipt.fetched_at,
    head_sha: receipt.head_sha,
    run_id: receipt.run_id,
    proof_refs: receipt.proof_refs,
    evidence_fingerprint: receipt.evidence_fingerprint,
    freshness_window_ms: receipt.freshness_window_ms,
  };
}

export function checkEvidenceEnvelope(
  envelope: EvidenceEnvelope,
  context: EvidenceCheckContext,
): CommonSensePassResult {
  if (!envelope.receipts.length) {
    return {
      verdict: "HOLD",
      rule_id: null,
      reason: "Evidence envelope has no receipts.",
      evidence: [{ kind: "evidence", ref: "receipts=empty" }],
      next_action: "attach_evidence_receipt",
    };
  }

  for (const receipt of envelope.receipts) {
    const missing: string[] = [];
    if (!receipt.source_kind) missing.push("source_kind");
    if (!receipt.source_id) missing.push("source_id");
    if (!receipt.fetched_at) missing.push("fetched_at");
    if (!receipt.evidence_fingerprint) missing.push("evidence_fingerprint");
    if (context.current_head_sha && !receipt.head_sha) missing.push("head_sha");

    if (missing.length > 0) {
      return {
        verdict: "HOLD",
        rule_id: null,
        reason: `Evidence receipt ${receipt.source_id || "unknown"} missing required field(s): ${missing.join(", ")}.`,
        evidence: [toEvidence(receipt, `missing=${missing.join(",")}`)],
        next_action: "supply_complete_evidence_receipt",
      };
    }

    const fetchedAtMs = Date.parse(receipt.fetched_at);
    if (Number.isNaN(fetchedAtMs)) {
      return {
        verdict: "HOLD",
        rule_id: null,
        reason: `Evidence receipt ${receipt.source_id} has an invalid fetched_at timestamp.`,
        evidence: [toEvidence(receipt, "fetched_at=invalid")],
        next_action: "supply_valid_fetched_at",
      };
    }

    const expectedFingerprint = createEvidenceFingerprint(receipt);
    if (receipt.evidence_fingerprint !== expectedFingerprint) {
      return {
        verdict: "BLOCKER",
        rule_id: null,
        reason: `Evidence receipt ${receipt.source_id} fingerprint does not match its payload.`,
        evidence: [toEvidence(receipt, "fingerprint=mismatch")],
        next_action: "recompute_evidence_fingerprint",
      };
    }

    const freshnessWindowMs =
      receipt.freshness_window_ms ??
      context.default_freshness_window_ms ??
      DEFAULT_EVIDENCE_FRESHNESS_WINDOW_MS;

    if (context.now_ms - fetchedAtMs > freshnessWindowMs) {
      return {
        verdict: "BLOCKER",
        rule_id: null,
        reason: `Evidence receipt ${receipt.source_id} is stale for the ${freshnessWindowMs}ms freshness window.`,
        evidence: [toEvidence(receipt, `freshness_window_ms=${freshnessWindowMs}`)],
        next_action: "refresh_evidence_receipt",
      };
    }

    if (context.current_head_sha && receipt.head_sha !== context.current_head_sha) {
      return {
        verdict: "BLOCKER",
        rule_id: null,
        reason: `Evidence receipt ${receipt.source_id} was fetched for ${receipt.head_sha?.slice(0, 7)} but current head is ${context.current_head_sha.slice(0, 7)}.`,
        evidence: [
          toEvidence(receipt, "head_sha=stale"),
          { kind: "sha", ref: context.current_head_sha, note: "current_head" },
        ],
        next_action: "refresh_evidence_on_current_head",
      };
    }
  }

  return {
    verdict: "PASS",
    rule_id: null,
    reason: "Evidence envelope receipts are complete, fresh, and fingerprinted.",
    evidence: envelope.receipts.map((receipt) =>
      toEvidence(receipt, "evidence=fresh"),
    ),
  };
}
