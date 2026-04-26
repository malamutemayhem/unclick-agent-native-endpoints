import type { Severity, Theme, Viewport, UXPassPack } from "./schema.js";

export type RunStatus = "queued" | "running" | "complete" | "failed";

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

export type { UXPassPack, Severity, Theme, Viewport };
