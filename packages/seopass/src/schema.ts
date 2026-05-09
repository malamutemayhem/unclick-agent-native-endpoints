import { z } from "zod";

export const SeoPassCheckIdSchema = z.enum([
  "lighthouse-performance",
  "crawlability",
  "metadata",
  "structured-data",
  "indexability",
  "canonical-signals",
  "internal-links",
  "core-web-vitals",
  "ai-overview-readiness",
]);

export const SeoPassSeveritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

export const SeoPassCheckVerdictSchema = z.enum([
  "pass",
  "warn",
  "fail",
  "unknown",
]);

export const SeoPassReportVerdictSchema = z.enum([
  "ready",
  "needs-work",
  "blocked",
  "unknown",
]);

export const SeoPassEvidenceSchema = z.object({
  kind: z.enum([
    "robots-txt",
    "sitemap",
    "html-head",
    "canonical",
    "structured-data",
    "internal-link",
    "lighthouse",
    "geopass-signal",
    "manual-note",
  ]),
  label: z.string().min(1),
  source_url: z.string().url().optional(),
  summary: z.string().min(1),
});

export const SeoPassFindingSchema = z.object({
  id: z.string().min(1),
  check_id: SeoPassCheckIdSchema,
  severity: SeoPassSeveritySchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  evidence: z.array(SeoPassEvidenceSchema).default([]),
  recommendation: z.string().min(1).optional(),
});

export const SeoPassCheckResultSchema = z.object({
  check_id: SeoPassCheckIdSchema,
  label: z.string().min(1),
  score: z.number().min(0).max(100),
  verdict: SeoPassCheckVerdictSchema,
  findings: z.array(SeoPassFindingSchema).default([]),
  comments: z.array(z.string().min(1)).default([]),
});

export const SeoPassScannerSourceSchema = z.object({
  kind: z.enum(["geopass-plan", "fixture", "manual"]),
  mode: z.enum(["plan-only", "fixture", "live-readonly"]).default("plan-only"),
  target_url: z.string().url(),
  shared_check_ids: z.array(z.string().min(1)).default([]),
});

export const SeoPassReportSchema = z.object({
  target_url: z.string().url(),
  generated_at: z.string().datetime(),
  mode: z.enum(["plan-only", "fixture", "live-readonly"]).default("plan-only"),
  search_engine_readiness_score: z.number().min(0).max(100),
  verdict: SeoPassReportVerdictSchema,
  checks: z.array(SeoPassCheckResultSchema).min(1),
  scanner_source: SeoPassScannerSourceSchema,
  notes: z.array(z.string().min(1)).default([]),
});

export const SeoPassGeoPassAdapterSchema = z.object({
  source: z.literal("geopass"),
  target_url: z.string().url(),
  mode: z.enum(["plan-only", "fixture", "live-readonly"]).optional(),
  aggregate_ai_engine_readiness_score: z.number().min(0).max(100).optional(),
  verdict: z.enum(["ready", "needs-work", "blocked", "unknown"]).optional(),
  shared_check_ids: z.array(z.string().min(1)).default([]),
});

export const SeoPassBudgetSchema = z
  .object({
    performance: z.string().optional(),
    accessibility: z.string().optional(),
    best_practices: z.string().optional(),
    seo: z.string().optional(),
    crawl_errors: z.string().optional(),
  })
  .catchall(z.string());

export const SeoPassPackSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  checks: z.array(SeoPassCheckIdSchema).min(1),
  lighthouse: z
    .object({
      strategy: z.enum(["mobile", "desktop"]).default("mobile"),
      categories: z.array(z.enum(["performance", "accessibility", "best-practices", "seo"])).default(["seo"]),
    })
    .default({ strategy: "mobile", categories: ["seo"] }),
  crawl: z
    .object({
      max_pages: z.number().int().positive().max(500).default(25),
      respect_robots: z.boolean().default(true),
    })
    .default({ max_pages: 25, respect_robots: true }),
  budgets: SeoPassBudgetSchema.default({ seo: ">= 90" }),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type SeoPassPack = z.infer<typeof SeoPassPackSchema>;
export type SeoPassCheckId = z.infer<typeof SeoPassCheckIdSchema>;
export type SeoPassSeverity = z.infer<typeof SeoPassSeveritySchema>;
export type SeoPassCheckVerdict = z.infer<typeof SeoPassCheckVerdictSchema>;
export type SeoPassReportVerdict = z.infer<typeof SeoPassReportVerdictSchema>;
export type SeoPassEvidence = z.infer<typeof SeoPassEvidenceSchema>;
export type SeoPassFinding = z.infer<typeof SeoPassFindingSchema>;
export type SeoPassCheckResult = z.infer<typeof SeoPassCheckResultSchema>;
export type SeoPassScannerSource = z.infer<typeof SeoPassScannerSourceSchema>;
export type SeoPassReport = z.infer<typeof SeoPassReportSchema>;
export type SeoPassGeoPassAdapter = z.infer<typeof SeoPassGeoPassAdapterSchema>;
