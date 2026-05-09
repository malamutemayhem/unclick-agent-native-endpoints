import { describe, expect, it } from "vitest";
import {
  CopyPassCopyBlockSchema,
  CopyPassReportSchema,
} from "../schema.js";

describe("CopyPass schemas", () => {
  it("accepts a minimal fixture report", () => {
    const report = CopyPassReportSchema.parse({
      target: {
        kind: "page",
        label: "UnClick home",
        url: "https://unclick.world/",
      },
      generated_at: "2026-05-09T19:00:00.000Z",
      mode: "fixture",
      overall_score: 100,
      verdict: "pass",
      checks_attempted: ["value-prop-clarity", "cta-presence"],
      blocks_reviewed: ["hero"],
      findings: [],
      not_checked: [
        {
          label: "Production crawl",
          reason: "Fixture-only scaffold.",
        },
      ],
      scanner_source: {
        kind: "fixture",
        mode: "fixture",
        target_url: "https://unclick.world/",
        shared_check_ids: ["value-prop-clarity"],
      },
      disclaimers: ["Advisory fixture check."],
      notes: [],
    });

    expect(report.verdict).toBe("pass");
  });

  it("rejects empty copy block text", () => {
    expect(() =>
      CopyPassCopyBlockSchema.parse({
        id: "hero",
        kind: "hero",
        text: "",
      }),
    ).toThrow();
  });
});
