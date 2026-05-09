import { describe, expect, it } from "vitest";
import {
  createFixtureSlopPassReport,
  createSlopPassVerdictPack,
} from "../verdict-pack.js";

describe("SlopPass verdict pack", () => {
  it("creates a plan-only advisory pack for shared scanner wiring", () => {
    const pack = createSlopPassVerdictPack({
      target: { kind: "repo", label: "unclick", ref: "main" },
      generated_at: "2026-05-09T18:42:00.000Z",
      scanner_source: {
        kind: "geopass-plan",
        mode: "plan-only",
        source_id: "geopass-fixture-adapter",
        shared_check_ids: ["static-source-file-inventory"],
      },
    });

    expect(pack.mode).toBe("plan-only");
    expect(pack.verdict).toBe("unknown");
    expect(pack.scanner_source.kind).toBe("geopass-plan");
    expect(pack.smell_checks.length).toBeGreaterThan(0);
  });

  it("evaluates fixture files deterministically", () => {
    const pack = createFixtureSlopPassReport({
      target: { kind: "files", label: "generated fixture", files: ["src/generated.ts"] },
      generated_at: "2026-05-09T18:42:00.000Z",
      files: [
        {
          path: "src/generated.ts",
          content: "export const value: any = eval(input);",
        },
      ],
      checks: ["grounding_api_reality", "maintenance_change_risk"],
    });

    expect(pack.mode).toBe("fixture");
    expect(pack.verdict).toBe("fail");
    expect(pack.findings).toContainEqual(
      expect.objectContaining({
        category: "grounding_api_reality",
        title: "Dynamic code execution is present",
      }),
    );
    expect(pack.not_checked.length).toBeGreaterThan(0);
  });

  it("keeps secret-looking fixture evidence redacted", () => {
    const pack = createFixtureSlopPassReport({
      target: { kind: "files", label: "secret fixture", files: ["src/config.ts"] },
      files: [
        {
          path: "src/config.ts",
          content: "export const apiKey = 'demo_token_value_12345';",
        },
      ],
      checks: ["maintenance_change_risk"],
    });

    expect(pack.verdict).toBe("fail");
    expect(JSON.stringify(pack)).not.toContain("demo_token_value_12345");
    expect(pack.findings[0]?.evidence).toBe("[redacted-secret-like-literal]");
  });
});
