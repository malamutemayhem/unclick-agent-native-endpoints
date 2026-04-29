// Verdict shape mirrored from @unclick/testpass (packages/testpass/src/types.ts).
// Kept as a local copy rather than a workspace import so LegalPass can ship
// independently. If TestPass changes its verdict shape, sync this file.
//
// IMMUTABLE DESIGN RULE (parallel to SecurityPass's "PoC never auto-fired"):
// LegalPass NEVER produces output that is a transactional legal instrument
// tailored to the specific user. NEVER recommends a specific legal action.
// NEVER holds itself out as a substitute for a real practitioner.
// Outputs are issue-spotters and information only.

import type { z } from "zod";
import type { PackSchema, HatRosterEntrySchema, JurisdictionCodeSchema } from "./pack-schema.js";

export type Pack = z.infer<typeof PackSchema>;
export type HatRosterEntry = z.infer<typeof HatRosterEntrySchema>;
export type JurisdictionCode = z.infer<typeof JurisdictionCodeSchema>;

export type Verdict = "check" | "na" | "fail" | "other" | "pending";
export type RunProfile = "smoke" | "standard" | "deep";
export type Severity = "critical" | "high" | "medium" | "low";
export type RunStatus = "running" | "complete" | "failed" | "vetoed_by_citation_verifier";

export type TargetKind = "url" | "contract_upload" | "repo";

export interface RunTarget {
  kind: TargetKind;
  url?: string;
  upload_ref?: string;
  repo?: string;
  branch?: string;
  commit?: string;
}

export interface VerdictSummary {
  total: number;
  check: number;
  na: number;
  fail: number;
  other: number;
  pending: number;
  pass_rate: number;
}

export interface PackItemResult {
  hat_id: string;
  item_id: string;
  title: string;
  category: string;
  severity: Severity;
  verdict: Verdict;
  finding: string;
  citations: Array<{ source: string; excerpt: string; url?: string }>;
  on_fail_comment?: string;
}

export interface RunResult {
  run_id: string;
  pack_id: string;
  target: RunTarget;
  profile: RunProfile;
  status: RunStatus;
  summary: VerdictSummary;
  items: PackItemResult[];
  vetoed_items?: string[];
  created_at: string;
  completed_at: string | null;
}
