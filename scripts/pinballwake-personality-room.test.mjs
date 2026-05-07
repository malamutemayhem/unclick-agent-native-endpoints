import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  COMPLEXITY_LEVELS,
  EMOJI_LEVELS,
  evaluatePersonalityRoom,
  RESPONSE_LENGTHS,
  STATUS_SYMBOL_SETS,
  WRITING_STYLE_PRESETS,
} from "./pinballwake-personality-room.mjs";

describe("PinballWake Personality Room", () => {
  it("creates a ready style prompt from identity, memory, and controls", () => {
    const result = evaluatePersonalityRoom({
      identity: "UnClick is an AI-native infrastructure ecosystem.",
      audience: "Founder/operator using AI agents and automation.",
      memoryNotes: ["Chris prefers simple English.", "Use analogies when the system gets complex."],
      writingStyle: "friendly_builder",
      responseLength: "short",
      complexity: "very_simple_with_analogies",
      emojiLevel: "light",
    });

    assert.equal(result.result, "ready");
    assert.equal(result.writing_style.key, "friendly_builder");
    assert.equal(result.controls.response_length, "short");
    assert.equal(result.controls.complexity, "very_simple_with_analogies");
    assert.match(result.style_prompt, /UnClick is an AI-native infrastructure ecosystem/);
    assert.match(result.style_prompt, /Very simple with analogies/);
  });

  it("falls back to safe defaults for unknown preset values", () => {
    const result = evaluatePersonalityRoom({
      identity: "UnClick assistant",
      memoryNotes: ["Keep the user moving."],
      writingStyle: "chaos_mode",
      responseLength: "tiny",
      complexity: "wizard",
      emojiLevel: "extreme",
      statusSymbols: "laser_show",
    });

    assert.equal(result.writing_style.key, "plain_english_operator");
    assert.equal(result.controls.response_length, "medium");
    assert.equal(result.controls.complexity, "simple");
    assert.equal(result.controls.emoji_level, "light");
    assert.equal(result.controls.status_symbols, "traffic_light");
  });

  it("flags missing identity as setup-needed", () => {
    const result = evaluatePersonalityRoom({
      memoryNotes: ["User likes direct practical answers."],
    });

    assert.equal(result.result, "setup_needed");
    assert.equal(result.setup_steps[0].kind, "add_identity");
    assert.match(result.style_prompt, /identity not set/);
  });

  it("keeps emoji-free profiles plain when no status set is provided", () => {
    const result = evaluatePersonalityRoom({
      identity: "Professional assistant",
      memoryNotes: ["No emoji for formal work."],
      emojiLevel: "none",
      statusSymbols: "unknown",
    });

    assert.equal(result.controls.emoji_level, "none");
    assert.equal(result.controls.status_symbols, "plain");
    assert.equal(Object.keys(result.emoji_palette).length, 0);
    assert.match(result.style_prompt, /Do not use emojis/);
  });

  it("warns when short replies are paired with heavy emoji", () => {
    const result = evaluatePersonalityRoom({
      identity: "UnClick assistant",
      memoryNotes: ["Use status markers."],
      responseLength: "short",
      emojiLevel: "heavy",
    });

    assert.equal(result.result, "ready");
    assert.ok(result.setup_steps.some((step) => step.kind === "watch_style_conflict"));
  });

  it("exports the expected preset surfaces", () => {
    assert.deepEqual(Object.keys(RESPONSE_LENGTHS), ["short", "medium", "long"]);
    assert.ok(Object.keys(COMPLEXITY_LEVELS).includes("very_simple_with_analogies"));
    assert.ok(Object.keys(EMOJI_LEVELS).includes("heavy"));
    assert.ok(Object.keys(WRITING_STYLE_PRESETS).includes("professional_founder"));
    assert.ok(Object.keys(STATUS_SYMBOL_SETS).includes("traffic_light"));
  });
});
