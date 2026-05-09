import { describe, expect, it } from "vitest";
import { GeoPassReportSchema } from "../schema.js";

const validReport = {
  target_url: "https://example.com/",
  generated_at: "2026-05-09T16:30:00.000Z",
  mode: "plan-only",
  engines: ["chatgpt", "claude", "perplexity", "gemini", "copilot", "grok", "meta-ai"],
  aggregate_ai_engine_readiness_score: 74,
  verdict: "needs-work",
  checks: [
    {
      check_id: "llms-txt",
      label: "llms.txt presence and quality",
      score: 60,
      verdict: "needs-work",
      findings: [
        {
          id: "llms-txt-missing-summary",
          check_id: "llms-txt",
          severity: "medium",
          title: "llms.txt needs a product summary",
          summary: "The file exists but does not explain the product in plain public language.",
          evidence: [
            {
              kind: "llms-txt",
              label: "Public llms.txt",
              source_url: "https://example.com/llms.txt",
              summary: "Short file with links only.",
            },
          ],
          recommendation:
            "Add a short public summary that explains what the product does and who it serves.",
        },
      ],
    },
  ],
  cross_pass_signals: [
    {
      pass: "seopass",
      signal: "structured data quality affects both SEO and GEO citation readiness",
      score: 70,
    },
  ],
  notes: ["Diagnostic readiness only. It does not guarantee citation."],
};

describe("GeoPassReportSchema", () => {
  it("accepts the chunk-1 public readiness report shape", () => {
    const result = GeoPassReportSchema.safeParse(validReport);
    expect(result.success).toBe(true);
  });

  it("rejects invalid targets", () => {
    const result = GeoPassReportSchema.safeParse({
      ...validReport,
      target_url: "not a url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects readiness scores outside 0 to 100", () => {
    const result = GeoPassReportSchema.safeParse({
      ...validReport,
      aggregate_ai_engine_readiness_score: 101,
    });
    expect(result.success).toBe(false);
  });

  it("requires at least one engine and one check", () => {
    const noEngine = GeoPassReportSchema.safeParse({
      ...validReport,
      engines: [],
    });
    const noChecks = GeoPassReportSchema.safeParse({
      ...validReport,
      checks: [],
    });
    expect(noEngine.success).toBe(false);
    expect(noChecks.success).toBe(false);
  });

  it("keeps the report public-safe with source-linked evidence only", () => {
    const result = GeoPassReportSchema.parse(validReport);
    expect(result.mode).toBe("plan-only");
    expect(result.checks[0]?.findings[0]?.evidence[0]?.source_url).toBe(
      "https://example.com/llms.txt",
    );
  });
});
