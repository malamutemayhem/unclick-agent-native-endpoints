import { describe, expect, it } from "vitest";
import {
  decideBackstagePassConnectionProbeProviderCall,
  decideMemoryAdminAiChatProviderCall,
  decideAiProviderCall,
  getBackstagePassConnectionProbePathId,
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
    expect(inventory.some((entry) => entry.id === "memory.mcp.openai.fact-extraction")).toBe(true);
    expect(inventory.every((entry) => ["free", "paid", "paid_or_unknown"].includes(entry.cost_tier))).toBe(true);
    expect(inventory.filter((entry) => entry.default_allowed).every((entry) => entry.cost_tier === "free")).toBe(true);
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
    expect(decideAiProviderCall({ path_id: "memory.mcp.openai.fact-extraction" })).toMatchObject({
      allowed: false,
      provider: "OpenAI",
      model: "gpt-4o-mini",
      cost_tier: "paid",
      reason: "paid_or_unknown_blocked",
      allow_paid_flag: "MEMORY_OPENAI_FACT_EXTRACTION_ENABLED or MEMORY_AI_FACT_EXTRACTION_ENABLED",
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
      "mcp.togetherai.tool.chat",
      "mcp.togetherai.tool.completion",
      "mcp.togetherai.tool.embedding",
      "mcp.togetherai.tool.model-listing",
      "mcp.elevenlabs.tool.text-to-speech",
      "mcp.elevenlabs.tool.voice-listing",
      "mcp.elevenlabs.tool.voice-metadata",
      "mcp.elevenlabs.tool.model-listing",
      "mcp.elevenlabs.tool.history",
      "mcp.stability.tool.text-to-image",
      "mcp.stability.tool.image-to-image",
      "mcp.stability.tool.upscale",
      "mcp.stability.tool.engine-listing",
      "mcp.mistral.tool.chat",
      "mcp.mistral.tool.embedding",
      "mcp.mistral.tool.model-listing",
      "mcp.perplexity.tool.chat",
      "mcp.higgsfield.tool.generate-video",
      "mcp.higgsfield.tool.generate-image",
      "mcp.higgsfield.tool.style-listing",
      "mcp.higgsfield.tool.generation-status",
      "mcp.heygen.tool.avatar-video",
      "mcp.heygen.tool.avatar-listing",
      "mcp.heygen.tool.video-status",
      "mcp.heygen.tool.voice-listing",
      "mcp.runway.tool.generate-video",
      "mcp.runway.tool.generation-status",
      "mcp.runway.tool.model-listing",
      "mcp.pika.tool.generate-video",
      "mcp.pika.tool.generation-status",
      "mcp.pika.tool.style-listing",
      "mcp.kling.tool.generate-video",
      "mcp.kling.tool.generation-status",
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

  it("labels AI media provider operations with blocked generation and status metadata", () => {
    const expected = [
      ["mcp.higgsfield.tool.generate-video", "Higgsfield", "video_generation", "paid"],
      ["mcp.higgsfield.tool.generate-image", "Higgsfield", "image_generation", "paid"],
      ["mcp.higgsfield.tool.style-listing", "Higgsfield", "model_listing", "paid_or_unknown"],
      ["mcp.higgsfield.tool.generation-status", "Higgsfield", "prediction", "paid_or_unknown"],
      ["mcp.heygen.tool.avatar-video", "HeyGen", "video_generation", "paid"],
      ["mcp.heygen.tool.avatar-listing", "HeyGen", "model_listing", "paid_or_unknown"],
      ["mcp.heygen.tool.video-status", "HeyGen", "prediction", "paid_or_unknown"],
      ["mcp.heygen.tool.voice-listing", "HeyGen", "model_listing", "paid_or_unknown"],
      ["mcp.runway.tool.generate-video", "Runway", "video_generation", "paid"],
      ["mcp.runway.tool.generation-status", "Runway", "prediction", "paid_or_unknown"],
      ["mcp.runway.tool.model-listing", "Runway", "model_listing", "paid_or_unknown"],
      ["mcp.pika.tool.generate-video", "Pika", "video_generation", "paid"],
      ["mcp.pika.tool.generation-status", "Pika", "prediction", "paid_or_unknown"],
      ["mcp.pika.tool.style-listing", "Pika", "model_listing", "paid_or_unknown"],
      ["mcp.kling.tool.generate-video", "Kling AI", "video_generation", "paid"],
      ["mcp.kling.tool.generation-status", "Kling AI", "prediction", "paid_or_unknown"],
    ] as const;

    for (const [pathId, provider, callKind, costTier] of expected) {
      expect(getAiProviderInventoryEntry(pathId)).toMatchObject({
        provider,
        call_kind: callKind,
        cost_tier: costTier,
        default_allowed: false,
        allow_paid_flag: "api_key argument",
      });
      expect(decideAiProviderCall({ path_id: pathId })).toMatchObject({
        allowed: false,
        provider,
        cost_tier: costTier,
        reason: "paid_or_unknown_blocked",
        allow_paid_flag: "api_key argument",
      });
    }

    expect(decideAiProviderCall({
      path_id: "mcp.runway.tool.generate-video",
      allow_paid: true,
    })).toMatchObject({
      allowed: true,
      reason: "explicit_paid_allowed",
    });
  });

  it("labels external web API provider operations with visible cost gates", () => {
    const expected = [
      ["mcp.web-search.tavily.search", "Tavily", "web_search", "TAVILY_API_KEY"],
      ["mcp.web-search.exa.search", "Exa", "web_search", "EXA_API_KEY"],
      ["mcp.web-search.brave.search", "Brave Search", "web_search", "BRAVE_SEARCH_API_KEY"],
      ["mcp.web-scrape.firecrawl.scrape", "Firecrawl", "web_scrape", "FIRECRAWL_API_KEY"],
      ["mcp.web-scrape.tavily.extract", "Tavily", "web_scrape", "TAVILY_API_KEY"],
    ] as const;

    for (const [pathId, provider, callKind, allowPaidFlag] of expected) {
      expect(getAiProviderInventoryEntry(pathId)).toMatchObject({
        provider,
        surface: "packages/mcp-server/src/web-tools.ts",
        call_kind: callKind,
        cost_tier: "paid_or_unknown",
        default_allowed: false,
        allow_paid_flag: allowPaidFlag,
      });
      expect(decideAiProviderCall({ path_id: pathId })).toMatchObject({
        allowed: false,
        provider,
        reason: "paid_or_unknown_blocked",
        allow_paid_flag: allowPaidFlag,
      });
      expect(decideAiProviderCall({ path_id: pathId, allow_paid: true })).toMatchObject({
        allowed: true,
        provider,
        reason: "explicit_paid_allowed",
      });
    }

    expect(getAiProviderInventoryEntry("mcp.search-docs.context7.lookup")).toMatchObject({
      provider: "Context7",
      surface: "packages/mcp-server/src/web-tools.ts",
      call_kind: "web_search",
      cost_tier: "free",
      default_allowed: true,
    });
    expect(decideAiProviderCall({ path_id: "mcp.search-docs.context7.lookup" })).toMatchObject({
      allowed: true,
      provider: "Context7",
      reason: "free_default_allowed",
    });
  });

  it("labels token-gated Replicate provider operations separately", () => {
    const expected = [
      "mcp.replicate.tool.prediction",
      "mcp.replicate.tool.model-listing",
      "mcp.replicate.tool.model-metadata",
      "mcp.replicate.tool.prediction-status",
      "mcp.replicate.tool.prediction-listing",
      "mcp.replicate.tool.prediction-cancel",
    ];

    for (const pathId of expected) {
      const entry = getAiProviderInventoryEntry(pathId);
      expect(entry).toMatchObject({
        provider: "Replicate",
        default_allowed: false,
        allow_paid_flag: "api_token argument",
      });
      expect(decideAiProviderCall({ path_id: pathId })).toMatchObject({
        allowed: false,
        reason: "paid_or_unknown_blocked",
        allow_paid_flag: "api_token argument",
      });
    }

    expect(getAiProviderInventoryEntry("mcp.replicate.tool.prediction")).toMatchObject({
      call_kind: "prediction",
      cost_tier: "paid",
    });
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

  it("labels BackstagePass connection probes as explicit owner test actions", () => {
    const expected = [
      ["openai", "backstagepass.openai.connection-test", "OpenAI", "OpenAI /models"],
      ["anthropic", "backstagepass.anthropic.connection-test", "Anthropic", "Anthropic /models"],
    ] as const;

    for (const [provider, pathId, providerLabel, model] of expected) {
      expect(getBackstagePassConnectionProbePathId(provider)).toBe(pathId);
      expect(getAiProviderInventoryEntry(pathId)).toMatchObject({
        provider: providerLabel,
        surface: "api/backstagepass.ts?action=testConnection",
        call_kind: "model_listing",
        model,
        cost_tier: "paid_or_unknown",
        default_allowed: false,
        allow_paid_flag: "testConnection allow_paid + owner api_key + stored provider api_key",
      });
      expect(decideBackstagePassConnectionProbeProviderCall({ provider })).toMatchObject({
        allowed: false,
        path_id: pathId,
        reason: "paid_or_unknown_blocked",
      });
      expect(decideBackstagePassConnectionProbeProviderCall({ provider, allow_paid: true })).toMatchObject({
        allowed: true,
        path_id: pathId,
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
    expect(decideAiProviderCall({
      path_id: "memory.mcp.openai.fact-extraction",
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
