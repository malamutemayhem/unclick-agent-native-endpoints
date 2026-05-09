import { describe, expect, it } from "vitest";

import {
  SeoPassFindingSchema,
  SeoPassGeoPassAdapterSchema,
  SeoPassReportSchema,
} from "../schema.js";

describe("SEOPass schema", () => {
  it("validates a public-safe SEO finding", () => {
    const finding = SeoPassFindingSchema.parse({
      id: "metadata-title-missing",
      check_id: "metadata",
      severity: "high",
      title: "Page title is missing",
      summary: "The public HTML head did not provide a title.",
      evidence: [
        {
          kind: "html-head",
          label: "HTML head",
          source_url: "https://example.com/",
          summary: "No title element was present in the fixture.",
        },
      ],
      recommendation: "Add a descriptive title for search snippets.",
    });

    expect(finding.evidence).toHaveLength(1);
  });

  it("accepts the GEOPass adapter seam without importing scanner internals", () => {
    const adapter = SeoPassGeoPassAdapterSchema.parse({
      source: "geopass",
      target_url: "https://example.com/",
      mode: "plan-only",
      aggregate_ai_engine_readiness_score: 72,
      verdict: "needs-work",
      shared_check_ids: ["schema-org-citation-grade"],
    });

    expect(adapter.shared_check_ids).toEqual(["schema-org-citation-grade"]);
  });

  it("validates a plan-only report with scores and verdicts", () => {
    const report = SeoPassReportSchema.parse({
      target_url: "https://example.com/",
      generated_at: "2026-05-09T16:58:00.000Z",
      mode: "plan-only",
      search_engine_readiness_score: 0,
      verdict: "unknown",
      scanner_source: {
        kind: "geopass-plan",
        mode: "plan-only",
        target_url: "https://example.com/",
        shared_check_ids: ["ai-bot-crawlability"],
      },
      checks: [
        {
          check_id: "indexability",
          label: "Indexability",
          score: 0,
          verdict: "unknown",
          comments: ["Awaiting read-only scanner evidence."],
        },
      ],
    });

    expect(report.checks[0]?.findings).toEqual([]);
  });
});
