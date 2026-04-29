import type { Severity, Theme, Viewport, UXPassPack } from "./schema.js";

export type RunStatus = "queued" | "running" | "complete" | "failed" | "budget_exceeded";
export type Verdict = "pass" | "fail" | "na";

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
  agent_readability: number | null;
  dark_pattern_cleanliness: number | null;
  aesthetic_coherence: number | null;
  motion_quality: number | null;
  first_run_quality: number | null;
}

export type CriticExecutionMode = "deterministic" | "llm";
export type CriticExecutionStatus = "ran" | "queued";

export interface CriticBreakdown {
  id: string;
  label: string;
  score_component: keyof UXScoreBreakdown;
  mode: CriticExecutionMode;
  status: CriticExecutionStatus;
  pass: number;
  fail: number;
  na: number;
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

// Runtime shapes used by the deterministic runner. These map onto the
// uxpass_runs and uxpass_findings tables defined in
// supabase/migrations/20260428100000_uxpass_schema.sql (the schema landed by
// PR #227). The deterministic runner only writes findings for FAIL outcomes;
// passes are recorded in the breakdown jsonb on the run row, not as rows.

export interface CheckEvaluation {
  check_id: string;
  hat: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  verdict: Verdict;
  evidence?: Record<string, unknown>;
  remediation?: string;
  time_ms?: number;
}

export interface RuntimeFinding {
  hat_id: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  selector?: string;
  viewport?: string;
  theme?: string;
  evidence: Record<string, unknown>;
  remediation: string[];
}

export interface RunBreakdown {
  version: string;
  score_components: UXScoreBreakdown;
  by_hat: Record<string, { pass: number; fail: number; na: number }>;
  checks_run: string[];
  critics?: CriticBreakdown[];
}

export interface RunSummaryStats {
  total: number;
  pass: number;
  fail: number;
  na: number;
  pass_rate: number;
}

export interface UxpassRunRow {
  id: string;
  pack_id: string | null;
  target_url: string;
  hats: string[];
  viewports: string[];
  themes: string[];
  status: RunStatus;
  ux_score: number | null;
  breakdown: RunBreakdown | Record<string, unknown>;
  summary: string | null;
  started_at: string;
  completed_at: string | null;
  actor_user_id: string;
  cost_usd: number;
  tokens_used: number;
  error: string | null;
}

export interface UxpassFindingRow {
  id: string;
  run_id: string;
  hat_id: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  selector: string | null;
  viewport: string | null;
  theme: string | null;
  evidence_ref: string | null;
  evidence: Record<string, unknown>;
  remediation: string[];
  cost_usd: number;
  created_at: string;
}

export type { UXPassPack, Severity, Theme, Viewport };
