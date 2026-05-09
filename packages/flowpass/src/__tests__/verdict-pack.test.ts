import { describe, expect, it } from "vitest";

import {
  createFlowPassVerdictPack,
  createPlanOnlyFlowPassReport,
} from "../verdict-pack.js";

describe("FlowPass verdict pack", () => {
  it("builds a verdict pack on the GEOPass source seam", () => {
    const pack = createFlowPassVerdictPack({
      targetUrl: "https://example.com/app",
      journeyId: "checkout",
      journeyName: "Checkout journey",
      journeyKind: "checkout",
      steps: ["entry-route", "form-readiness", "success-state"],
    });

    expect(pack.targetUrl).toBe("https://example.com/app");
    expect(pack.scannerSource.source).toBe("geopass");
    expect(pack.scannerSource.shared_check_ids).toEqual([
      "aggregate-ai-engine-readiness",
    ]);
    expect(pack.steps).toHaveLength(3);
  });

  it("creates a typed plan-only report", () => {
    const report = createPlanOnlyFlowPassReport({
      targetUrl: "https://example.com/signup",
      generatedAt: "2026-05-09T17:38:00.000Z",
      journeyId: "signup",
      journeyName: "Signup journey",
      journeyKind: "signup",
      scannerSource: {
        source: "geopass",
        target_url: "https://example.com/signup",
        mode: "plan-only",
        shared_check_ids: ["aggregate-ai-engine-readiness"],
      },
    });

    expect(report.target_url).toBe("https://example.com/signup");
    expect(report.verdict).toBe("unknown");
    expect(report.steps).toHaveLength(7);
    expect(report.scanner_source.kind).toBe("geopass-plan");
  });
});
