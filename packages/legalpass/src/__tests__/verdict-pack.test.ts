import { describe, expect, it } from "vitest";
import {
  createFixtureLegalPassReport,
  createLegalPassVerdictPack,
} from "../verdict-pack.js";

describe("LegalPass verdict pack", () => {
  it("creates a plan-only advisory pack", () => {
    const report = createLegalPassVerdictPack({
      target: { name: "Example", url: "https://example.com" },
      generated_at: "2026-05-09T18:10:00.000Z",
    });

    expect(report.mode).toBe("plan-only");
    expect(report.verdict).toBe("unknown");
    expect(report.hats).toHaveLength(3);
    expect(report.disclaimers[0]).toContain("issue-spotter");
  });

  it("evaluates public fixture text deterministically", () => {
    const report = createFixtureLegalPassReport({
      target: { name: "Example", url: "https://example.com" },
      generated_at: "2026-05-09T18:10:00.000Z",
      documents: [
        {
          id: "privacy",
          kind: "privacy-policy",
          title: "Privacy Policy",
          text: "Our privacy team provides contact details. We collect and use data, retain records, and share with a third party.",
        },
        {
          id: "terms",
          kind: "terms-of-service",
          title: "Terms",
          text: "The terms cover liability, indemnity, dispute support, and when we change or terminate access.",
        },
        {
          id: "oss",
          kind: "oss-manifest",
          title: "OSS manifest",
          text: "Each dependency has a license entry, attribution, copyleft marker, patent grant, and notice text.",
        },
      ],
    });

    expect(report.mode).toBe("fixture");
    expect(report.verdict).toBe("ready");
    expect(report.overall_score).toBe(100);
  });

  it("flags missing fixture signals without issuing legal instructions", () => {
    const report = createFixtureLegalPassReport({
      target: { name: "Example", url: "https://example.com" },
      generated_at: "2026-05-09T18:10:00.000Z",
      documents: [
        {
          id: "privacy",
          kind: "privacy-policy",
          title: "Privacy Policy",
          text: "This page says hello.",
        },
      ],
    });

    expect(report.verdict).toBe("blocked");
    expect(report.hats.some((hat) => hat.findings.length > 0)).toBe(true);
    expect(JSON.stringify(report)).not.toContain("you should");
  });
});
