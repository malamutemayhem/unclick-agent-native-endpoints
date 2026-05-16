import { describe, expect, it } from "vitest";

import { decideAssemblyAiToolProviderCall } from "../assemblyai-tool.js";

describe("AssemblyAI MCP tool spend guard", () => {
  it("blocks paid AssemblyAI transcription calls without the caller API key signal", () => {
    expect(decideAssemblyAiToolProviderCall("transcribe", "AssemblyAI transcript", "")).toMatchObject({
      allowed: false,
      path_id: "mcp.assemblyai.tool.transcribe",
      provider: "AssemblyAI",
      model: "AssemblyAI transcript",
      cost_tier: "paid",
      default_allowed: false,
      reason: "paid_or_unknown_blocked",
      allow_paid_flag: "api_key argument",
    });
  });

  it("allows AssemblyAI calls when the caller supplied an API key", () => {
    expect(decideAssemblyAiToolProviderCall("transcribe", "AssemblyAI transcript", "aai-test")).toMatchObject({
      allowed: true,
      path_id: "mcp.assemblyai.tool.transcribe",
      provider: "AssemblyAI",
      model: "AssemblyAI transcript",
      cost_tier: "paid",
      default_allowed: false,
      reason: "explicit_paid_allowed",
      allow_paid_flag: "api_key argument",
    });
  });

  it("labels transcript helper reads as paid or unknown provider surfaces", () => {
    expect(decideAssemblyAiToolProviderCall("summary", "AssemblyAI transcript summary", "aai-test")).toMatchObject({
      allowed: true,
      path_id: "mcp.assemblyai.tool.summary",
      cost_tier: "paid_or_unknown",
      reason: "explicit_paid_allowed",
    });
  });
});
