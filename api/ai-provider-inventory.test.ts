import { describe, expect, it } from "vitest";
import {
  decideMemoryAdminAiChatProviderCall,
  decideAiProviderCall,
  getAiProviderInventoryEntry,
  listAiProviderInventory,
  publicAiProviderCostLabels,
} from "./lib/ai-provider-inventory";

describe("ai provider inventory", () => {
  it("lists known provider paths with cost labels and default allowance", () => {
    const inventory = listAiProviderInventory();

    expect(inventory.some((entry) => entry.id === "nudgeonly.openrouter.free-default")).toBe(true);
    expect(inventory.some((entry) => entry.id === "nudgeonly.openrouter.custom-model")).toBe(true);
    expect(inventory.some((entry) => entry.id === "memory.mcp.openai.embeddings")).toBe(true);
    expect(inventory.every((entry) => ["free", "paid", "paid_or_unknown"].includes(entry.cost_tier))).toBe(true);
    expect(inventory.filter((entry) => entry.default_allowed).map((entry) => entry.cost_tier)).toEqual(["free"]);
  });

  it("allows explicitly labelled free default paths", () => {
    expect(decideAiProviderCall({ path_id: "nudgeonly.openrouter.free-default" })).toMatchObject({
      allowed: true,
      cost_tier: "free",
      reason: "free_default_allowed",
      default_allowed: true,
    });
  });

  it("blocks NudgeOnly custom model paths by default", () => {
    expect(getAiProviderInventoryEntry("nudgeonly.openrouter.custom-model")).toMatchObject({
      provider: "OpenRouter",
      call_kind: "classification",
      cost_tier: "paid_or_unknown",
      default_allowed: false,
      allow_paid_flag: "NUDGEONLY_OPENROUTER_ALLOW_PAID or allow_paid argument",
    });
    expect(decideAiProviderCall({
      path_id: "nudgeonly.openrouter.custom-model",
      model: "anthropic/claude-sonnet-4",
    })).toMatchObject({
      allowed: false,
      provider: "OpenRouter",
      model: "anthropic/claude-sonnet-4",
      cost_tier: "paid_or_unknown",
      reason: "paid_or_unknown_blocked",
      allow_paid_flag: "NUDGEONLY_OPENROUTER_ALLOW_PAID or allow_paid argument",
    });
    expect(decideAiProviderCall({
      path_id: "nudgeonly.openrouter.custom-model",
      model: "anthropic/claude-sonnet-4",
      allow_paid: true,
    })).toMatchObject({
      allowed: true,
      reason: "explicit_paid_allowed",
    });
  });

  it("blocks paid paths by default and records the required opt-in flag", () => {
    expect(decideAiProviderCall({ path_id: "memory.mcp.openai.embeddings" })).toMatchObject({
      allowed: false,
      provider: "OpenAI",
      model: "text-embedding-3-small",
      cost_tier: "paid",
      reason: "paid_or_unknown_blocked",
      allow_paid_flag: "MEMORY_OPENAI_EMBEDDINGS_ENABLED",
    });
  });

  it("labels MCP provider tool operations with explicit caller-key gates", () => {
    const expected = [
      "mcp.openai.tool.chat",
      "mcp.openai.tool.embedding",
      "mcp.openai.tool.image-generation",
      "mcp.openai.tool.transcription",
      "mcp.openai.tool.model-listing",
      "mcp.anthropic.tool.chat",
      "mcp.anthropic.tool.model-listing",
      "mcp.groq.tool.chat",
      "mcp.groq.tool.model-listing",
      "mcp.cohere.tool.chat",
      "mcp.cohere.tool.generate",
      "mcp.cohere.tool.embedding",
      "mcp.cohere.tool.rerank",
      "mcp.cohere.tool.classify",
      "mcp.cohere.tool.model-listing",
    ];

    for (const pathId of expected) {
      const entry = getAiProviderInventoryEntry(pathId);
      expect(entry).toMatchObject({
        default_allowed: false,
        allow_paid_flag: "api_key argument",
      });
      expect(decideAiProviderCall({ path_id: pathId })).toMatchObject({
        allowed: false,
        reason: "paid_or_unknown_blocked",
        allow_paid_flag: "api_key argument",
      });
    }
  });

  it("labels Memory Admin AI chat provider paths with tenant-key spend gates", () => {
    const expected = [
      ["memory.admin.google.ai-chat", "google", "gemini-2.5-flash-lite"],
      ["memory.admin.openai.ai-chat", "openai", "gpt-4o-mini"],
      ["memory.admin.anthropic.ai-chat", "anthropic", "claude-haiku-4-5"],
    ] as const;

    for (const [pathId, provider, model] of expected) {
      expect(getAiProviderInventoryEntry(pathId)).toMatchObject({
        call_kind: "chat_completion",
        cost_tier: "paid",
        default_allowed: false,
        allow_paid_flag: "AI_CHAT_ENABLED + tenant ai_chat_enabled + tenant ai_chat_api_key",
      });
      expect(decideMemoryAdminAiChatProviderCall({ provider, model })).toMatchObject({
        allowed: false,
        path_id: pathId,
        model,
        reason: "paid_or_unknown_blocked",
      });
      expect(decideMemoryAdminAiChatProviderCall({ provider, model, allow_paid: true })).toMatchObject({
        allowed: true,
        path_id: pathId,
        model,
        reason: "explicit_paid_allowed",
      });
    }
  });

  it("keeps MCP model listing paths blocked as paid or unknown by default", () => {
    expect(decideAiProviderCall({ path_id: "mcp.groq.tool.model-listing" })).toMatchObject({
      allowed: false,
      provider: "Groq",
      cost_tier: "paid_or_unknown",
      default_allowed: false,
      reason: "paid_or_unknown_blocked",
    });
    expect(getAiProviderInventoryEntry("mcp.groq.tool.model-listing")).toMatchObject({
      provider: "Groq",
      call_kind: "model_listing",
      cost_tier: "paid_or_unknown",
      default_allowed: false,
    });
    expect(getAiProviderInventoryEntry("mcp.cohere.tool.model-listing")).toMatchObject({
      provider: "Cohere",
      call_kind: "model_listing",
      cost_tier: "paid_or_unknown",
      default_allowed: false,
    });
  });

  it("allows paid paths only when an explicit allow-paid decision is present", () => {
    expect(decideAiProviderCall({
      path_id: "memory.mcp.openai.embeddings",
      allow_paid: true,
    })).toMatchObject({
      allowed: true,
      cost_tier: "paid",
      reason: "explicit_paid_allowed",
    });
  });

  it("fails closed for unknown provider or model costs", () => {
    expect(decideAiProviderCall({
      path_id: "new.experimental.provider",
      model: "surprise-premium-model",
    })).toMatchObject({
      allowed: false,
      provider: "unknown",
      model: "surprise-premium-model",
      cost_tier: "paid_or_unknown",
      reason: "paid_or_unknown_blocked",
    });
  });

  it("keeps public cost-label output free of secret values", () => {
    const labels = publicAiProviderCostLabels();

    expect(labels[0]).not.toHaveProperty("notes");
    expect(JSON.stringify(labels)).not.toMatch(/sk-|secret-value|Bearer\s/i);
    expect(getAiProviderInventoryEntry("arena.anthropic.bot-solve")).toMatchObject({
      provider: "Anthropic",
      cost_tier: "paid",
      default_allowed: false,
    });
  });
});
