import { describe, expect, it } from "vitest";

import {
  DEFAULT_SEOPASS_VERDICT_CHECKS,
  createPlanOnlySeoPassReport,
  createSeoPassVerdictPack,
} from "../verdict-pack.js";

describe("SEOPass verdict pack", () => {
  it("contains the default search-engine readiness checks", () => {
    expect(DEFAULT_SEOPASS_VERDICT_CHECKS.map((check) => check.id)).toEqual([
      "indexability",
      "metadata",
      "canonical-signals",
      "structured-data",
      "internal-links",
      "core-web-vitals",
    ]);
  });

  it("builds a plan-only verdict pack on the GEOPass scanner seam", () => {
    const pack = createSeoPassVerdictPack({
      targetUrl: "https://example.com",
      checks: ["metadata", "structured-data"],
    });

    expect(pack.targetUrl).toBe("https://example.com/");
    expect(pack.mode).toBe("plan-only");
    expect(pack.checks.map((check) => check.id)).toEqual([
      "metadata",
      "structured-data",
    ]);
    expect(pack.scannerSource.source).toBe("geopass");
    expect(pack.disallowedActions).toContain("live crawler execution");
  });

  it("creates a typed plan-only report from the verdict pack", () => {
    const report = createPlanOnlySeoPassReport({
      targetUrl: "https://example.com/products",
      generatedAt: "2026-05-09T16:58:00.000Z",
      scannerSource: {
        source: "geopass",
        target_url: "https://example.com/products",
        mode: "plan-only",
        shared_check_ids: ["ai-bot-crawlability"],
      },
    });

    expect(report.target_url).toBe("https://example.com/products");
    expect(report.verdict).toBe("unknown");
    expect(report.checks).toHaveLength(6);
    expect(report.scanner_source.kind).toBe("geopass-plan");
  });
});
