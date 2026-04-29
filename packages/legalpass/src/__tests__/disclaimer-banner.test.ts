import { describe, it, expect } from "vitest";
import {
  getDisclaimer,
  wordCount,
  DISCLAIMER_TARGETS,
} from "../passguard/disclaimer-banner.js";

describe("PassGuard disclaimer-banner", () => {
  it("returns the chat disclaimer at the brief's target length (42 words)", () => {
    const text = getDisclaimer("chat");
    expect(wordCount(text)).toBe(DISCLAIMER_TARGETS.chat);
    expect(DISCLAIMER_TARGETS.chat).toBe(42);
  });

  it("returns the results disclaimer at the brief's target length (108 words)", () => {
    const text = getDisclaimer("results");
    expect(wordCount(text)).toBe(DISCLAIMER_TARGETS.results);
    expect(DISCLAIMER_TARGETS.results).toBe(108);
  });

  it("returns the ToS disclaimer at the brief's target length (312 words)", () => {
    const text = getDisclaimer("tos");
    expect(wordCount(text)).toBe(DISCLAIMER_TARGETS.tos);
    expect(DISCLAIMER_TARGETS.tos).toBe(312);
  });

  it("each disclaimer disclaims being a lawyer", () => {
    for (const length of ["chat", "results", "tos"] as const) {
      const text = getDisclaimer(length).toLowerCase();
      expect(
        text.includes("not a lawyer") ||
          text.includes("is not a lawyer") ||
          text.includes("not a lawyer,")
      ).toBe(true);
    }
  });
});
