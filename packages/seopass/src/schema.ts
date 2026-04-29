import { z } from "zod";

export const SeoPassCheckIdSchema = z.enum([
  "lighthouse-performance",
  "crawlability",
  "metadata",
  "structured-data",
  "indexability",
  "canonical-signals",
  "internal-links",
  "ai-overview-readiness",
]);

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
