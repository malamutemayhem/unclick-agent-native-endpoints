import { z } from "zod";

export const SlopPassSeveritySchema = z.enum(["critical", "high", "medium", "low", "info"]);

export const SlopPassCategorySchema = z.enum([
  "grounding_api_reality",
  "logic_plausibility",
  "scaffold_without_substance",
  "test_proof_theatre",
  "slopocalypse_failure_mode",
  "maintenance_change_risk",
]);

export const SlopPassTargetSchema = z.object({
  kind: z.enum(["repo", "branch", "diff", "files", "pr", "artifact"]),
  label: z.string().min(1),
  files: z.array(z.string()).optional(),
  ref: z.string().optional(),
});

export const SlopPassSourceFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

export const SlopPassFindingSchema = z.object({
  title: z.string().min(1),
  category: SlopPassCategorySchema,
  severity: SlopPassSeveritySchema,
  why_it_matters: z.string().min(1),
  evidence: z.string().min(1),
  suggested_fix: z.string().min(1),
  confidence_note: z.string().optional(),
  file: z.string().optional(),
  line: z.number().int().positive().optional(),
});

export const SlopPassVerdictSchema = z.enum(["pass", "warn", "fail", "unknown"]);

export const SlopPassScopeSchema = z.object({
  checks_attempted: z.array(SlopPassCategorySchema),
  files_reviewed: z.array(z.string().min(1)),
  provider: z.string().min(1),
});

export const SlopPassNotCheckedSchema = z.object({
  label: z.string().min(1),
  reason: z.string().min(1),
});

export const SlopPassSummarySchema = z.object({
  posture: z.string().min(1),
  counts_by_severity: z.record(SlopPassSeveritySchema, z.number().int().nonnegative()),
  coverage_note: z.string().min(1),
});

export const SlopPassDisclaimerSchema = z.object({
  headline: z.string().min(1),
  body: z.string().min(1),
  compact: z.string().min(1),
});

export const SlopPassResultSchema = z.object({
  target: SlopPassTargetSchema,
  scope: SlopPassScopeSchema,
  verdict: SlopPassVerdictSchema,
  findings: z.array(SlopPassFindingSchema),
  not_checked: z.array(SlopPassNotCheckedSchema),
  summary: SlopPassSummarySchema,
  disclaimer: SlopPassDisclaimerSchema,
});

export const SlopPassRunInputSchema = z.object({
  target: SlopPassTargetSchema,
  files: z.array(SlopPassSourceFileSchema).min(1),
  checks: z.array(SlopPassCategorySchema).optional(),
  provider: z.enum(["openai", "anthropic", "google", "ollama", "http"]).default("http"),
});

export type SlopPassRunInput = z.input<typeof SlopPassRunInputSchema>;
export type SlopPassParsedRunInput = z.output<typeof SlopPassRunInputSchema>;
