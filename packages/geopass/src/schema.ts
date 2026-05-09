import { z } from "zod";

export const GeoPassSeveritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

export const GeoPassVerdictSchema = z.enum([
  "ready",
  "needs-work",
  "blocked",
  "unknown",
]);

export const GeoPassEngineIdSchema = z.enum([
  "chatgpt",
  "claude",
  "perplexity",
  "gemini",
  "copilot",
  "grok",
  "meta-ai",
]);

export const GeoPassBotIdSchema = z.enum([
  "GPTBot",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
  "Bingbot",
  "Twitterbot",
  "FacebookBot",
]);

export const GeoPassCheckIdSchema = z.enum([
  "ai-bot-crawlability",
  "llms-txt",
  "schema-org-citation-grade",
  "brand-mention-readiness",
  "wikidata-presence",
  "common-crawl-presence",
  "aggregate-ai-engine-readiness",
]);

export const GeoPassEvidenceSchema = z.object({
  kind: z.enum([
    "robots-txt",
    "llms-txt",
    "schema-org",
    "wikidata",
    "common-crawl",
    "brand-query",
    "lighthouse",
    "manual-note",
  ]),
  label: z.string().min(1),
  source_url: z.string().url().optional(),
  summary: z.string().min(1),
});

export const GeoPassFindingSchema = z.object({
  id: z.string().min(1),
  check_id: GeoPassCheckIdSchema,
  severity: GeoPassSeveritySchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  evidence: z.array(GeoPassEvidenceSchema).default([]),
  recommendation: z.string().min(1).optional(),
});

export const GeoPassCheckResultSchema = z.object({
  check_id: GeoPassCheckIdSchema,
  label: z.string().min(1),
  score: z.number().min(0).max(100),
  verdict: GeoPassVerdictSchema,
  findings: z.array(GeoPassFindingSchema).default([]),
});

export const GeoPassCrossPassSignalSchema = z.object({
  pass: z.enum(["seopass", "flowpass", "legalpass", "sloppass", "uxpass"]),
  signal: z.string().min(1),
  score: z.number().min(0).max(100).optional(),
});

export const GeoPassReportSchema = z.object({
  target_url: z.string().url(),
  generated_at: z.string().datetime(),
  mode: z.enum(["plan-only", "fixture", "live-readonly"]).default("plan-only"),
  engines: z.array(GeoPassEngineIdSchema).min(1),
  aggregate_ai_engine_readiness_score: z.number().min(0).max(100),
  verdict: GeoPassVerdictSchema,
  checks: z.array(GeoPassCheckResultSchema).min(1),
  cross_pass_signals: z.array(GeoPassCrossPassSignalSchema).default([]),
  notes: z.array(z.string().min(1)).default([]),
});

export type GeoPassSeverity = z.infer<typeof GeoPassSeveritySchema>;
export type GeoPassVerdict = z.infer<typeof GeoPassVerdictSchema>;
export type GeoPassEngineId = z.infer<typeof GeoPassEngineIdSchema>;
export type GeoPassBotId = z.infer<typeof GeoPassBotIdSchema>;
export type GeoPassCheckId = z.infer<typeof GeoPassCheckIdSchema>;
export type GeoPassEvidence = z.infer<typeof GeoPassEvidenceSchema>;
export type GeoPassFinding = z.infer<typeof GeoPassFindingSchema>;
export type GeoPassCheckResult = z.infer<typeof GeoPassCheckResultSchema>;
export type GeoPassCrossPassSignal = z.infer<typeof GeoPassCrossPassSignalSchema>;
export type GeoPassReport = z.infer<typeof GeoPassReportSchema>;
