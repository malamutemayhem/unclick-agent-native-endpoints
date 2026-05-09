import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERSONALITY_PROFILE,
  PERSONALITY_STYLE_PRESETS,
  selectedPersonalityPreset,
  summarizePersonalityProfile,
} from "./pinballwakePersonality";

describe("PinballWake Personality admin model", () => {
  it("ships with practical editable defaults", () => {
    const summary = summarizePersonalityProfile();

    expect(summary.preset).toBe("Plain English Operator");
    expect(summary.memoryNotes).toBeGreaterThanOrEqual(3);
    expect(summary.complexity).toContain("analogies");
    expect(DEFAULT_PERSONALITY_PROFILE.identity).toContain("UnClick");
  });

  it("offers a useful spread of writing style presets", () => {
    expect(PERSONALITY_STYLE_PRESETS.map((preset) => preset.id)).toEqual([
      "plain-english-operator",
      "professional-founder",
      "friendly-builder",
      "concise-executive",
      "technical-expert",
      "creative-strategist",
    ]);
  });

  it("falls back to the first preset when profile selection is stale", () => {
    expect(selectedPersonalityPreset({ ...DEFAULT_PERSONALITY_PROFILE, writingStyle: "missing" }).id).toBe(
      "plain-english-operator",
    );
  });
});
