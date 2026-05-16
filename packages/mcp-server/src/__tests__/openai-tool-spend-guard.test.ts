import { describe, expect, it } from "vitest";

import { decideOpenAiToolProviderCall } from "../openai-tool.js";

describe("OpenAI MCP tool spend guard", () => {
  it("blocks paid OpenAI tool calls without the caller API key signal", () => {
    expect(decideOpenAiToolProviderCall("chat", "gpt-4o-mini", "")).toMatchObject({
      allowed: false,
      path_id: "mcp.openai.tool.chat",
      provider: "OpenAI",
      model: "gpt-4o-mini",
      cost_tier: "paid",
      default_allowed: false,
      reason: "paid_or_unknown_blocked",
      allow_paid_flag: "api_key argument",
    });
  });

  it("allows OpenAI tool calls when the caller supplied an API key", () => {
    expect(decideOpenAiToolProviderCall("embedding", "text-embedding-3-small", "sk-test")).toMatchObject({
      allowed: true,
      path_id: "mcp.openai.tool.embedding",
      provider: "OpenAI",
      model: "text-embedding-3-small",
      cost_tier: "paid",
      default_allowed: false,
      reason: "explicit_paid_allowed",
      allow_paid_flag: "api_key argument",
    });
  });

  it("labels model listing as a paid or unknown provider surface", () => {
    expect(decideOpenAiToolProviderCall("model-listing", "OpenAI /models", "sk-test")).toMatchObject({
      allowed: true,
      path_id: "mcp.openai.tool.model-listing",
      cost_tier: "paid_or_unknown",
      reason: "explicit_paid_allowed",
    });
  });
});
