import { describe, expect, it } from "vitest";
import {
  LegalPassFixtureDocumentSchema,
  LegalPassReportSchema,
} from "../schema.js";

describe("LegalPass phase-one schema", () => {
  it("parses public fixture documents with safe defaults", () => {
    const document = LegalPassFixtureDocumentSchema.parse({
      id: "privacy-fixture",
      kind: "privacy-policy",
      title: "Privacy Policy Fixture",
      text: "We collect account data and provide a privacy contact.",
    });

    expect(document.public_only).toBe(true);
  });

  it("requires report disclaimers", () => {
    expect(() =>
      LegalPassReportSchema.parse({
        target: { name: "Example", url: "https://example.com" },
        generated_at: "2026-05-09T18:10:00.000Z",
        mode: "plan-only",
        jurisdictions: ["AU"],
        overall_score: 0,
        verdict: "unknown",
        hats: [],
        scanner_source: {
          kind: "manual",
          mode: "plan-only",
          shared_check_ids: [],
        },
        disclaimers: [],
      }),
    ).toThrow();
  });
});
