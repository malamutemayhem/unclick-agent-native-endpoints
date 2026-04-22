import { z } from "zod";
import { PackSchema } from "./pack-schema.js";

export type Pack = z.infer<typeof PackSchema>;
export type PackItem = Pack["items"][number];
export type CheckType = PackItem["check_type"];
export type Severity = PackItem["severity"];
export type Verdict = "check" | "na" | "fail" | "other" | "pending";
export type RunProfile = "smoke" | "standard" | "deep";
export type RunStatus = "running" | "complete" | "failed" | "budget_exceeded";
export type EvidenceKind = "tool_list" | "snapshot" | "screenshot" | "http_trace" | "log" | "agent_verdict";

export interface RunTarget {
  type: "mcp" | "url" | "git";
  url?: string;
  commit?: string;
  branch?: string;
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
