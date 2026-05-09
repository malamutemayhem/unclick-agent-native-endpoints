import { z } from "zod";

export const CopyPassSeveritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

export const CopyPassCheckIdSchema = z.enum([
  "value-prop-clarity",
  "cta-presence",
  "proof-trust-gap",
  "unsupported-superiority",
  "placeholder-copy",
  "risky-guarantee-language",
]);

export const CopyPassBlockKindSchema = z.enum([
  "hero",
  "headline",
  "cta",
  "feature",
  "proof",
  "pricing",
  "legal",
  "email",
  "ad",
  "other",
]);

export const CopyPassTargetSchema = z.object({
  kind: z.enum(["page", "component", "campaign", "email", "ad", "doc", "artifact"]),
  label: z.string().min(1),
  url: z.string().url().optional(),
  source: z.string().min(1).optional(),
});

export const CopyPassCopyBlockSchema = z.object({
  id: z.string().min(1),
  kind: CopyPassBlockKindSchema,
  label: z.string().min(1).optional(),
  text: z.string().min(1),
  source_path: z.string().min(1).optional(),
  source_url: z.string().url().optional(),
  public_only: z.boolean().default(true),
});

export const CopyPassCheckDefinitionSchema = z.object({
  id: CopyPassCheckIdSchema,
  label: z.string().min(1),
  goal: z.string().min(1),
  severity: CopyPassSeveritySchema,
  recommended_fix: z.string().min(1),
});

export const CopyPassFindingSchema = z.object({
  id: z.string().min(1),
  check_id: CopyPassCheckIdSchema,
  severity: CopyPassSeveritySchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  evidence: z.string().min(1),
  suggested_fix: z.string().min(1),
  block_id: z.string().min(1).optional(),
  source_path: z.string().min(1).optional(),
  source_url: z.string().url().optional(),
});

export const CopyPassVerdictSchema = z.enum(["pass", "warn", "fail", "unknown"]);

export const CopyPassNotCheckedSchema = z.object({
  label: z.string().min(1),
  reason: z.string().min(1),
});

export const CopyPassScannerSourceSchema = z.object({
  kind: z.enum(["fixture", "manual", "shared-scanner-plan"]),
  mode: z.enum(["plan-only", "fixture"]),
  target_url: z.string().url().optional(),
  shared_check_ids: z.array(z.string().min(1)).default([]),
});

export const CopyPassReportSchema = z.object({
  target: CopyPassTargetSchema,
  generated_at: z.string().datetime(),
  mode: z.enum(["plan-only", "fixture"]),
  overall_score: z.number().int().min(0).max(100),
  verdict: CopyPassVerdictSchema,
  checks_attempted: z.array(CopyPassCheckIdSchema),
  blocks_reviewed: z.array(z.string().min(1)),
  findings: z.array(CopyPassFindingSchema),
  not_checked: z.array(CopyPassNotCheckedSchema),
  scanner_source: CopyPassScannerSourceSchema,
  disclaimers: z.array(z.string().min(1)),
  notes: z.array(z.string().min(1)).default([]),
});

export type CopyPassSeverity = z.output<typeof CopyPassSeveritySchema>;
export type CopyPassCheckId = z.output<typeof CopyPassCheckIdSchema>;
export type CopyPassBlockKind = z.output<typeof CopyPassBlockKindSchema>;
export type CopyPassTarget = z.output<typeof CopyPassTargetSchema>;
export type CopyPassTargetInput = z.input<typeof CopyPassTargetSchema>;
export type CopyPassCopyBlock = z.output<typeof CopyPassCopyBlockSchema>;
export type CopyPassCopyBlockInput = z.input<typeof CopyPassCopyBlockSchema>;
export type CopyPassCheckDefinition = z.output<typeof CopyPassCheckDefinitionSchema>;
export type CopyPassFinding = z.output<typeof CopyPassFindingSchema>;
export type CopyPassVerdict = z.output<typeof CopyPassVerdictSchema>;
export type CopyPassNotChecked = z.output<typeof CopyPassNotCheckedSchema>;
export type CopyPassReport = z.output<typeof CopyPassReportSchema>;
