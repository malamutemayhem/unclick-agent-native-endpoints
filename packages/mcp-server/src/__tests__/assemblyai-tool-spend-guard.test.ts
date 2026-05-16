import { describe, expect, it } from "vitest";

import { decideAssemblyAiToolProviderCall } from "../assemblyai-tool.js";

describe("AssemblyAI MCP tool spend guard", () => {
  it("blocks paid AssemblyAI tool calls without the caller API key signal", () => {
    expect(decideAssemblyAiToolProviderCall("transcription", "AssemblyAI /transcript", "")).toMatchObject({
      allowed: false,
      path_id: "mcp.assemblyai.tool.transcription",
      provider: "AssemblyAI",
      model: "AssemblyAI /transcript",
      cost_tier: "paid",
      default_allowed: false,
      reason: "paid_or_unknown_blocked",
      allow_paid_flag: "api_key argument",
    });
  });

  it("allows AssemblyAI tool calls when the caller supplied an API key", () => {
    expect(decideAssemblyAiToolProviderCall("transcription", "AssemblyAI /transcript", "aai-test")).toMatchObject({
      allowed: true,
      path_id: "mcp.assemblyai.tool.transcription",
      provider: "AssemblyAI",
      model: "AssemblyAI /transcript",
      cost_tier: "paid",
      default_allowed: false,
      reason: "explicit_paid_allowed",
      allow_paid_flag: "api_key argument",
    });
  });

  it("labels transcript reads as paid or unknown provider surfaces", () => {
    expect(decideAssemblyAiToolProviderCall("transcript-read", "AssemblyAI /transcript/{id}", "aai-test")).toMatchObject({
      allowed: true,
      path_id: "mcp.assemblyai.tool.transcript-read",
      cost_tier: "paid_or_unknown",
      reason: "explicit_paid_allowed",
    });
  });
});
