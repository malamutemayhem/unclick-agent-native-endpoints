import { describe, expect, it } from "vitest";
import { DEFAULT_CHECKS } from "../categories.js";
import { SlopPassResultSchema, SlopPassRunInputSchema } from "../schema.js";

describe("SlopPass run schema", () => {
  it("accepts the canonical target, files, and provider shape", () => {
    const parsed = SlopPassRunInputSchema.parse({
      target: { kind: "files", label: "fixture", files: ["src/example.ts"] },
      files: [{ path: "src/example.ts", content: "export const ok = true;" }],
    });

    expect(parsed.provider).toBe("http");
    expect(parsed.target.label).toBe("fixture");
  });

  it("keeps the six PRD categories as built-in checks", () => {
    expect(DEFAULT_CHECKS).toEqual([
      "grounding_api_reality",
      "logic_plausibility",
      "scaffold_without_substance",
      "test_proof_theatre",
      "slopocalypse_failure_mode",
      "maintenance_change_risk",
    ]);
  });

  it("rejects a run without files", () => {
    expect(() =>
      SlopPassRunInputSchema.parse({
        target: { kind: "files", label: "empty" },
        files: [],
      })
    ).toThrow();
  });

  it("validates the advisory result contract with verdict and scope", () => {
    const parsed = SlopPassResultSchema.parse({
      target: { kind: "files", label: "fixture", files: ["src/example.ts"] },
      scope: {
        checks_attempted: ["maintenance_change_risk"],
        files_reviewed: ["src/example.ts"],
        provider: "fixture-only",
      },
      verdict: "warn",
      findings: [],
      not_checked: [
        {
          label: "logic_plausibility",
          reason: "Check was not requested.",
        },
      ],
      summary: {
        posture: "Scoped static review completed.",
        counts_by_severity: { critical: 0, high: 0, medium: 0, low: 1, info: 0 },
        coverage_note: "Only fixture files were inspected.",
      },
      disclaimer: {
        headline: "Scoped review only",
        body: "Human review is still required.",
        compact: "Scoped review only.",
      },
    });

    expect(parsed.verdict).toBe("warn");
    expect(parsed.scope.provider).toBe("fixture-only");
  });
});
