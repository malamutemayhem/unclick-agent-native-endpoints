import { describe, expect, it } from "vitest";

import { decideAnthropicToolProviderCall } from "../anthropic-tool.js";

describe("Anthropic MCP tool spend guard", () => {
  it("blocks paid Anthropic tool calls without the caller API key signal", () => {
    expect(decideAnthropicToolProviderCall("chat", "claude-sonnet-4-6", "")).toMatchObject({
      allowed: false,
      path_id: "mcp.anthropic.tool.chat",
      provider: "Anthropic",
      model: "claude-sonnet-4-6",
      cost_tier: "paid",
      default_allowed: false,
      reason: "paid_or_unknown_blocked",
      allow_paid_flag: "api_key argument",
    });
  });

  it("allows Anthropic tool calls when the caller supplied an API key", () => {
    expect(decideAnthropicToolProviderCall("chat", "claude-sonnet-4-6", "sk-ant-test")).toMatchObject({
      allowed: true,
      path_id: "mcp.anthropic.tool.chat",
      provider: "Anthropic",
      model: "claude-sonnet-4-6",
      cost_tier: "paid",
      default_allowed: false,
      reason: "explicit_paid_allowed",
      allow_paid_flag: "api_key argument",
    });
  });

  it("labels model listing as a paid or unknown provider surface", () => {
    expect(decideAnthropicToolProviderCall("model-listing", "Anthropic /models", "sk-ant-test")).toMatchObject({
      allowed: true,
      path_id: "mcp.anthropic.tool.model-listing",
      cost_tier: "paid_or_unknown",
      reason: "explicit_paid_allowed",
    });
  });
});
