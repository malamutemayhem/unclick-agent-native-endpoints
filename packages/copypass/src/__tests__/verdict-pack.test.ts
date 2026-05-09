import { describe, expect, it } from "vitest";
import {
  createCopyPassVerdictPack,
  createFixtureCopyPassReport,
} from "../verdict-pack.js";

describe("CopyPass verdict pack", () => {
  it("creates a plan-only pack without scanning production", () => {
    const report = createCopyPassVerdictPack({
      target: {
        kind: "page",
        label: "UnClick home",
        url: "https://unclick.world/",
      },
      generated_at: "2026-05-09T19:00:00.000Z",
    });

    expect(report.mode).toBe("plan-only");
    expect(report.verdict).toBe("unknown");
    expect(report.not_checked.map((item) => item.label)).toContain("Production crawl");
  });

  it("fails a fixture with unsupported outcome language", () => {
    const report = createFixtureCopyPassReport({
      target: {
        kind: "page",
        label: "CopyPass fixture",
      },
      generated_at: "2026-05-09T19:00:00.000Z",
      blocks: [
        {
          id: "hero",
          kind: "hero",
          text: "The best platform with guaranteed instant revenue. Coming soon.",
        },
      ],
    });

    expect(report.verdict).toBe("fail");
    expect(report.overall_score).toBeLessThan(100);
    expect(report.findings.map((finding) => finding.check_id)).toContain(
      "risky-guarantee-language",
    );
  });

  it("passes a clean public fixture", () => {
    const report = createFixtureCopyPassReport({
      target: {
        kind: "page",
        label: "CopyPass fixture",
      },
      generated_at: "2026-05-09T19:00:00.000Z",
      blocks: [
        {
          id: "hero",
          kind: "hero",
          text:
            "UnClick helps teams review AI work with shared context, public proof, and green checks. Start a free review.",
        },
        {
          id: "proof",
          kind: "proof",
          text: "Public receipts and privacy notes show what was checked.",
        },
      ],
    });

    expect(report.verdict).toBe("pass");
    expect(report.overall_score).toBe(100);
    expect(report.findings).toEqual([]);
  });
});
