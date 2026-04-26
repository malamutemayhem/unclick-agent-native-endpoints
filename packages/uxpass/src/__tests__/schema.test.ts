import { describe, it, expect } from "vitest";
import { UXPassPackSchema } from "../schema.js";

const validPack = {
  name: "marketing-site-baseline",
  url: "https://example.com",
  viewports: ["mobile", "tablet", "desktop"],
  themes: ["light", "dark"],
  hats: [
    "graphic-designer",
    "ux-specialist",
    "frontend",
    "accessibility",
    "performance",
    "motion",
    "mobile",
    "agent-readability",
    "dark-pattern-detector",
  ],
  synthesiser: "default",
  budgets: {
    "ux-score": ">= 80",
    performance: ">= 90",
    accessibility: "no critical",
    "dark-patterns": "zero",
  },
  remediation: {
    "high-severity": "fishbowl-todos",
    all: "report-only",
  },
};

describe("UXPassPackSchema", () => {
  it("accepts the canonical pack from brief Section 7.2", () => {
    const result = UXPassPackSchema.safeParse(validPack);
    expect(result.success).toBe(true);
  });

  it("rejects a pack missing the name field", () => {
    const { name, ...rest } = validPack;
    const result = UXPassPackSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("name"))).toBe(true);
    }
  });

  it("rejects a pack missing the url field", () => {
    const { url, ...rest } = validPack;
    const result = UXPassPackSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a pack with an invalid url", () => {
    const result = UXPassPackSchema.safeParse({ ...validPack, url: "not a url" });
    expect(result.success).toBe(false);
  });

  it("rejects a pack with an empty viewports array", () => {
    const result = UXPassPackSchema.safeParse({ ...validPack, viewports: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a pack with an unknown viewport", () => {
    const result = UXPassPackSchema.safeParse({
      ...validPack,
      viewports: ["watch"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a pack with an empty themes array", () => {
    const result = UXPassPackSchema.safeParse({ ...validPack, themes: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a pack with an empty hats array", () => {
    const result = UXPassPackSchema.safeParse({ ...validPack, hats: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a pack missing the synthesiser field", () => {
    const { synthesiser, ...rest } = validPack;
    const result = UXPassPackSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a pack missing the budgets field", () => {
    const { budgets, ...rest } = validPack;
    const result = UXPassPackSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a pack missing the remediation field", () => {
    const { remediation, ...rest } = validPack;
    const result = UXPassPackSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("accepts custom hat ids beyond the canonical roster", () => {
    const result = UXPassPackSchema.safeParse({
      ...validPack,
      hats: ["my-custom-hat", "accessibility"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts extra budget keys via catchall", () => {
    const result = UXPassPackSchema.safeParse({
      ...validPack,
      budgets: { ...validPack.budgets, "custom-metric": ">= 50" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a remediation target that is not in the enum", () => {
    const result = UXPassPackSchema.safeParse({
      ...validPack,
      remediation: { "high-severity": "email-bailey" },
    });
    expect(result.success).toBe(false);
  });
});
