import { z } from "zod";

export const FlowPassStepIdSchema = z.enum([
  "entry-route",
  "primary-cta",
  "form-readiness",
  "success-state",
  "failure-state",
  "navigation-continuity",
  "handoff-proof",
]);

export const FlowPassJourneyKindSchema = z.enum([
  "signup",
  "auth",
  "checkout",
  "onboarding",
  "support",
  "custom",
]);

export const FlowPassSeveritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

export const FlowPassStepVerdictSchema = z.enum([
  "pass",
  "warn",
  "fail",
  "unknown",
]);

export const FlowPassReportVerdictSchema = z.enum([
  "ready",
  "needs-work",
  "blocked",
  "unknown",
]);

export const FlowPassEvidenceSchema = z.object({
  kind: z.enum([
    "route",
    "link",
    "form",
    "fixture",
    "screenshot",
    "console-log",
    "network-log",
    "accessibility-snapshot",
    "geopass-signal",
    "manual-note",
  ]),
  label: z.string().min(1),
  source_url: z.string().url().optional(),
  summary: z.string().min(1),
});

export const FlowPassFindingSchema = z.object({
  id: z.string().min(1),
  step_id: FlowPassStepIdSchema,
  severity: FlowPassSeveritySchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  evidence: z.array(FlowPassEvidenceSchema).default([]),
  recommendation: z.string().min(1).optional(),
});

export const FlowPassStepSchema = z.object({
  id: FlowPassStepIdSchema,
  label: z.string().min(1),
  route: z.string().min(1).optional(),
  required: z.boolean().default(true),
  fixtures: z.array(z.string().min(1)).default([]),
  evidence_kinds: z.array(z.string().min(1)).default([]),
});

export const FlowPassStepResultSchema = z.object({
  step_id: FlowPassStepIdSchema,
  label: z.string().min(1),
  score: z.number().min(0).max(100),
  verdict: FlowPassStepVerdictSchema,
  findings: z.array(FlowPassFindingSchema).default([]),
  comments: z.array(z.string().min(1)).default([]),
});

export const FlowPassScannerSourceSchema = z.object({
  kind: z.enum(["geopass-plan", "fixture", "manual"]),
  mode: z.enum(["plan-only", "fixture", "live-readonly"]).default("plan-only"),
  target_url: z.string().url(),
  shared_check_ids: z.array(z.string().min(1)).default([]),
});

export const FlowPassReportSchema = z.object({
  target_url: z.string().url(),
  generated_at: z.string().datetime(),
  mode: z.enum(["plan-only", "fixture", "live-readonly"]).default("plan-only"),
  journey: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    kind: FlowPassJourneyKindSchema,
  }),
  journey_readiness_score: z.number().min(0).max(100),
  verdict: FlowPassReportVerdictSchema,
  steps: z.array(FlowPassStepResultSchema).min(1),
  scanner_source: FlowPassScannerSourceSchema,
  notes: z.array(z.string().min(1)).default([]),
});

export const FlowPassPackSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  journey: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    kind: FlowPassJourneyKindSchema.default("custom"),
  }),
  steps: z.array(FlowPassStepSchema).min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const FlowPassGeoPassAdapterSchema = z.object({
  source: z.literal("geopass"),
  target_url: z.string().url(),
  mode: z.enum(["plan-only", "fixture", "live-readonly"]).optional(),
  shared_check_ids: z.array(z.string().min(1)).default([]),
});

export type FlowPassStepId = z.infer<typeof FlowPassStepIdSchema>;
export type FlowPassJourneyKind = z.infer<typeof FlowPassJourneyKindSchema>;
export type FlowPassSeverity = z.infer<typeof FlowPassSeveritySchema>;
export type FlowPassStepVerdict = z.infer<typeof FlowPassStepVerdictSchema>;
export type FlowPassReportVerdict = z.infer<typeof FlowPassReportVerdictSchema>;
export type FlowPassEvidence = z.infer<typeof FlowPassEvidenceSchema>;
export type FlowPassFinding = z.infer<typeof FlowPassFindingSchema>;
export type FlowPassStep = z.infer<typeof FlowPassStepSchema>;
export type FlowPassStepResult = z.infer<typeof FlowPassStepResultSchema>;
export type FlowPassScannerSource = z.infer<typeof FlowPassScannerSourceSchema>;
export type FlowPassReport = z.infer<typeof FlowPassReportSchema>;
export type FlowPassPack = z.infer<typeof FlowPassPackSchema>;
export type FlowPassGeoPassAdapter = z.infer<typeof FlowPassGeoPassAdapterSchema>;
