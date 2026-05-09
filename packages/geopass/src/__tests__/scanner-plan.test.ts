import { describe, expect, it } from "vitest";
import {
  DEFAULT_GEOPASS_BOTS,
  DEFAULT_GEOPASS_ENGINES,
  createGeoPassScannerPlan,
} from "../scanner-plan.js";

describe("createGeoPassScannerPlan", () => {
  it("creates a plan-only scanner blueprint for the seven target engines", () => {
    const plan = createGeoPassScannerPlan({
      targetUrl: "https://example.com",
    });

    expect(plan.mode).toBe("plan-only");
    expect(plan.targetUrl).toBe("https://example.com/");
    expect(plan.engines).toEqual(DEFAULT_GEOPASS_ENGINES);
    expect(plan.bots).toEqual(DEFAULT_GEOPASS_BOTS);
    expect(plan.steps.map((step) => step.id)).toContain("ai-bot-crawlability");
    expect(plan.steps.map((step) => step.id)).toContain(
      "aggregate-ai-engine-readiness",
    );
  });

  it("allows a small scoped check subset", () => {
    const plan = createGeoPassScannerPlan({
      targetUrl: "https://example.com",
      checks: ["llms-txt", "schema-org-citation-grade"],
    });

    expect(plan.steps.map((step) => step.id)).toEqual([
      "llms-txt",
      "schema-org-citation-grade",
    ]);
  });

  it("records stop conditions for live crawler and paid API work", () => {
    const plan = createGeoPassScannerPlan({
      targetUrl: "https://example.com",
    });

    expect(plan.disallowedActions).toContain("live crawler execution");
    expect(plan.disallowedActions).toContain("paid API calls");
    expect(plan.disallowedActions).toContain("citation guarantees");
  });

  it("rejects invalid target URLs", () => {
    expect(() =>
      createGeoPassScannerPlan({
        targetUrl: "not a url",
      }),
    ).toThrow();
  });
});
