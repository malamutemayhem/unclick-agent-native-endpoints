import { describe, expect, it } from "vitest";

import { decideElevenLabsToolProviderCall } from "../elevenlabs-tool.js";

describe("ElevenLabs MCP tool spend guard", () => {
  it("blocks paid ElevenLabs tool calls without the caller API key signal", () => {
    expect(decideElevenLabsToolProviderCall("text-to-speech", "eleven_monolingual_v1", "")).toMatchObject({
      allowed: false,
      path_id: "mcp.elevenlabs.tool.text-to-speech",
      provider: "ElevenLabs",
      model: "eleven_monolingual_v1",
      cost_tier: "paid",
      default_allowed: false,
      reason: "paid_or_unknown_blocked",
      allow_paid_flag: "api_key argument",
    });
  });

  it("allows ElevenLabs tool calls when the caller supplied an API key", () => {
    expect(decideElevenLabsToolProviderCall("text-to-speech", "eleven_monolingual_v1", "el-test")).toMatchObject({
      allowed: true,
      path_id: "mcp.elevenlabs.tool.text-to-speech",
      provider: "ElevenLabs",
      model: "eleven_monolingual_v1",
      cost_tier: "paid",
      default_allowed: false,
      reason: "explicit_paid_allowed",
      allow_paid_flag: "api_key argument",
    });
  });

  it("labels metadata reads as paid or unknown provider surfaces", () => {
    expect(decideElevenLabsToolProviderCall("voice-listing", "ElevenLabs /voices", "el-test")).toMatchObject({
      allowed: true,
      path_id: "mcp.elevenlabs.tool.voice-listing",
      cost_tier: "paid_or_unknown",
      reason: "explicit_paid_allowed",
    });
  });
});
