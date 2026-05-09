import { describe, expect, it } from "vitest";

import { DEFAULT_FLOWPASS_STEPS, createFlowPassPlan } from "../flow-plan.js";

describe("FlowPass plan", () => {
  it("contains the default fixture-driven journey steps", () => {
    expect(DEFAULT_FLOWPASS_STEPS.map((step) => step.id)).toEqual([
      "entry-route",
      "primary-cta",
      "form-readiness",
      "success-state",
      "failure-state",
      "navigation-continuity",
      "handoff-proof",
    ]);
  });

  it("creates a safe plan-only journey", () => {
    const plan = createFlowPassPlan({
      targetUrl: "https://example.com",
      journeyId: "signup",
      journeyName: "Signup journey",
      journeyKind: "signup",
      steps: ["entry-route", "primary-cta"],
    });

    expect(plan.targetUrl).toBe("https://example.com/");
    expect(plan.mode).toBe("plan-only");
    expect(plan.steps.map((step) => step.id)).toEqual([
      "entry-route",
      "primary-cta",
    ]);
    expect(plan.disallowedActions).toContain("live signup execution");
    expect(plan.disallowedActions).toContain("production database writes");
  });
});
