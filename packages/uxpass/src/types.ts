import type { Severity, Theme, Viewport, UXPassPack } from "./schema.js";

export type RunStatus = "queued" | "running" | "complete" | "failed";
export type Verdict = "pass" | "fail" | "na" | "pending";

export interface RunTarget {
  type: "url";
  url: string;
}

export interface Finding {
  id: string;
  hat_id: string;
  title: string;
  description: string;
  severity: Severity;
  selector?: string;
  viewport?: Viewport;
  theme?: Theme;
  evidence?: Record<string, unknown>;
  remediation?: string[];
}

export interface HatVerdict {
  hat_id: string;
  score: number;
  summary: string;
  findings: Finding[];
  ran_at: string;
  duration_ms: number;
}

export interface UXScoreBreakdown {
  agent_readability: number;
  dark_pattern_cleanliness: number;
  aesthetic_coherence: number;
  motion_quality: number;
  first_run_quality: number;
}

export interface RunResult {
  run_id: string;
  pack_name?: string;
  url: string;
  status: RunStatus;
  ux_score?: number;
  breakdown?: UXScoreBreakdown;
  hat_verdicts?: HatVerdict[];
  summary?: string;
  started_at: string;
  finished_at?: string;
  error?: string;
}

// Runtime row shapes used by the runner and API. These match the columns in
// the uxpass_runs and uxpass_findings tables defined in
// supabase/migrations/20260428000000_uxpass_schema.sql.

export interface RunSummary {
  total: number;
  pass: number;
  fail: number;
  na: number;
  pending: number;
  pass_rate: number;
}

export interface RuntimeFinding {
  check_id: string;
  hat: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  verdict: Verdict;
  evidence?: Record<string, unknown>;
  remediation?: string;
  time_ms?: number;
}

export interface UxpassRunRow {
  id: string;
  target: RunTarget;
  pack_slug: string;
  status: RunStatus;
  ux_score: number | null;
  summary: RunSummary | Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  actor_user_id: string;
  cost_usd: number;
  tokens_used: number;
}

export interface UxpassFindingRow extends RuntimeFinding {
  id: string;
  run_id: string;
  created_at: string;
}

export type { UXPassPack, Severity, Theme, Viewport };
