import { describe, expect, it } from "vitest";
import {
  decideArenaAnthropicProviderCall,
  isArenaAnthropicSpendEnabled,
} from "./arena";

describe("arena Anthropic spend guardrail", () => {
  it("keeps the Anthropic bot-solve path blocked by default", () => {
    expect(decideArenaAnthropicProviderCall("claude-haiku-4-5-20251001", false)).toMatchObject({
      allowed: false,
      path_id: "arena.anthropic.bot-solve",
      provider: "Anthropic",
      model: "claude-haiku-4-5-20251001",
      cost_tier: "paid",
      default_allowed: false,
      reason: "paid_or_unknown_blocked",
      allow_paid_flag: "ARENA_ANTHROPIC_ENABLED",
    });
  });

  it("allows the Anthropic bot-solve path only after the arena spend flag is explicit", () => {
    expect(decideArenaAnthropicProviderCall("claude-sonnet-4-6", true)).toMatchObject({
      allowed: true,
      path_id: "arena.anthropic.bot-solve",
      provider: "Anthropic",
      model: "claude-sonnet-4-6",
      cost_tier: "paid",
      reason: "explicit_paid_allowed",
      allow_paid_flag: "ARENA_ANTHROPIC_ENABLED",
    });
  });

  it("uses the safe default model label when the bot row has no model", () => {
    expect(decideArenaAnthropicProviderCall(null, false)).toMatchObject({
      allowed: false,
      model: "claude-haiku-4-5-20251001",
    });
  });

  it("treats only true or 1 as explicit arena spend opt-in", () => {
    expect(isArenaAnthropicSpendEnabled(undefined)).toBe(false);
    expect(isArenaAnthropicSpendEnabled("")).toBe(false);
    expect(isArenaAnthropicSpendEnabled("0")).toBe(false);
    expect(isArenaAnthropicSpendEnabled("false")).toBe(false);
    expect(isArenaAnthropicSpendEnabled("1")).toBe(true);
    expect(isArenaAnthropicSpendEnabled("true")).toBe(true);
    expect(isArenaAnthropicSpendEnabled("TRUE")).toBe(true);
  });
});
