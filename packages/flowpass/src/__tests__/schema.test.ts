import { describe, expect, it } from "vitest";

import {
  FlowPassFindingSchema,
  FlowPassGeoPassAdapterSchema,
  FlowPassReportSchema,
} from "../schema.js";

describe("FlowPass schema", () => {
  it("validates a fixture-safe flow finding", () => {
    const finding = FlowPassFindingSchema.parse({
      id: "primary-cta-missing",
      step_id: "primary-cta",
      severity: "high",
      title: "Primary CTA is missing",
      summary: "The fixture did not expose a clear primary action.",
      evidence: [
        {
          kind: "fixture",
          label: "Landing fixture",
          source_url: "https://example.com/",
          summary: "No button or link was marked as the primary CTA.",
        },
      ],
      recommendation: "Expose one primary action for the journey.",
    });

    expect(finding.evidence).toHaveLength(1);
  });

  it("accepts a GEOPass source adapter for shared scanner context", () => {
    const adapter = FlowPassGeoPassAdapterSchema.parse({
      source: "geopass",
      target_url: "https://example.com/",
      mode: "plan-only",
      shared_check_ids: ["aggregate-ai-engine-readiness"],
    });

    expect(adapter.shared_check_ids).toEqual([
      "aggregate-ai-engine-readiness",
    ]);
  });

  it("validates a plan-only FlowPass report", () => {
    const report = FlowPassReportSchema.parse({
      target_url: "https://example.com/",
      generated_at: "2026-05-09T17:38:00.000Z",
      mode: "plan-only",
      journey: {
        id: "signup",
        name: "Signup journey",
        kind: "signup",
      },
      journey_readiness_score: 0,
      verdict: "unknown",
      scanner_source: {
        kind: "fixture",
        mode: "plan-only",
        target_url: "https://example.com/",
      },
      steps: [
        {
          step_id: "entry-route",
          label: "Entry route loads",
          score: 0,
          verdict: "unknown",
        },
      ],
    });

    expect(report.steps[0]?.findings).toEqual([]);
  });
});
