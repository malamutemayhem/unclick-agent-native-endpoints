/**
 * CommonSensePass schema.
 *
 * Verdict-only sanity gate for AI/worker claims. Inputs are snapshots of
 * queue / PR / wake state; outputs are a single Verdict with rule_id,
 * reason, evidence, and an optional next_action.
 */

export type Verdict = "PASS" | "BLOCKER" | "HOLD" | "SUPPRESS" | "ROUTE";

export type ClaimKind =
  | "healthy"
  | "quiet"
  | "no_work"
  | "pass"
  | "done"
  | "merge_ready"
  | "duplicate_wake";

export type RuleId = "R1" | "R2" | "R3" | "R4" | "R5";

export interface Evidence {
  kind: string;
  ref: string;
  note?: string;
}

export interface CommonSensePassResult {
  verdict: Verdict;
  rule_id: RuleId | null;
  reason: string;
  evidence: Evidence[];
  next_action?: string;
  route_to?: string;
}

export type TodoStatus =
  | "actionable"
  | "in_progress"
  | "blocked"
  | "queued"
  | "done";

export interface TodoSnapshot {
  id: string;
  status: TodoStatus;
  pipeline?: number;
  owner?: string;
  /** Milliseconds since epoch for owner's last heartbeat. */
  owner_last_seen_ms?: number;
  /** PR or commit reference that closes this todo. */
  closing_ref?: string;
}

export interface ReviewSnapshot {
  verdict: "PASS" | "BLOCKER" | "HOLD" | null;
  /** SHA the review was authored on. */
  sha: string;
}

export interface PRSnapshot {
  number: number;
  head_sha: string;
  mergeable: boolean;
  checks_state: "success" | "failure" | "pending" | "neutral";
  reviewer_pass?: ReviewSnapshot;
  safety_pass?: ReviewSnapshot;
}

export interface WakeSnapshot {
  id: string;
  state_fingerprint: string;
  emitted_ms: number;
}

export interface ClaimContext {
  now_ms: number;
  current_head_sha?: string;
  commented_on_sha?: string;
  todos?: TodoSnapshot[];
  /** active_jobs count the worker is claiming. */
  active_jobs?: number;
  pr?: PRSnapshot;
  recent_wakes?: WakeSnapshot[];
  current_wake?: WakeSnapshot;
  /** Target todo id for done/merge_ready claims; if absent, first todo is used. */
  subject_todo_id?: string;
}

export interface ClaimInput {
  claim: ClaimKind;
  context: ClaimContext;
  /** Optional evidence the caller wants echoed on a PASS result. */
  evidence?: Evidence[];
}

/**
 * Owner-freshness window for the active_jobs definition.
 * Matches OWNER_FRESH_WINDOW_MS pinned in api/lib/orchestrator-context.ts (PR #735).
 */
export const OWNER_FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Window within which a wake with the same id+fingerprint is a duplicate. */
export const DUPLICATE_WAKE_WINDOW_MS = 10 * 60 * 1000;
