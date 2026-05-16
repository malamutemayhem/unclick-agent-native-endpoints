import { describe, expect, it } from "vitest";

import { decidePerplexityToolProviderCall } from "../perplexity-tool.js";

describe("Perplexity MCP tool spend guard", () => {
  it("blocks paid Perplexity tool calls without the caller API key signal", () => {
    expect(decidePerplexityToolProviderCall("chat-completion", "sonar", "")).toMatchObject({
      allowed: false,
      path_id: "mcp.perplexity.tool.chat-completion",
      provider: "Perplexity",
      model: "sonar",
      cost_tier: "paid",
      default_allowed: false,
      reason: "paid_or_unknown_blocked",
      allow_paid_flag: "api_key argument",
    });
  });

  it("allows Perplexity tool calls when the caller supplied an API key", () => {
    expect(decidePerplexityToolProviderCall("chat-completion", "sonar-pro", "pplx-test")).toMatchObject({
      allowed: true,
      path_id: "mcp.perplexity.tool.chat-completion",
      provider: "Perplexity",
      model: "sonar-pro",
      cost_tier: "paid",
      default_allowed: false,
      reason: "explicit_paid_allowed",
      allow_paid_flag: "api_key argument",
    });
  });
});
