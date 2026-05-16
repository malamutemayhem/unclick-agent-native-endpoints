export type AiProviderCostTier = "free" | "paid" | "paid_or_unknown";

export type AiProviderCallKind =
  | "chat_completion"
  | "text_generation"
  | "embedding"
  | "image_generation"
  | "transcription"
  | "classification"
  | "reranking"
  | "model_listing";

export interface AiProviderInventoryEntry {
  id: string;
  provider: string;
  surface: string;
  call_kind: AiProviderCallKind;
  model: string;
  cost_tier: AiProviderCostTier;
  default_allowed: boolean;
  allow_paid_flag?: string;
  notes: string;
}

export interface AiProviderDecisionInput {
  path_id: string;
  model?: string | null;
  allow_paid?: boolean;
}

export interface AiProviderCallDecision {
  allowed: boolean;
  path_id: string;
  provider: string;
  model: string;
  cost_tier: AiProviderCostTier;
  default_allowed: boolean;
  reason: "free_default_allowed" | "paid_or_unknown_blocked" | "explicit_paid_allowed";
  allow_paid_flag?: string;
}

export type MemoryAdminAiChatProvider = "google" | "openai" | "anthropic";

const MEMORY_ADMIN_AI_CHAT_PATH_IDS: Record<MemoryAdminAiChatProvider, string> = {
  google: "memory.admin.google.ai-chat",
  openai: "memory.admin.openai.ai-chat",
  anthropic: "memory.admin.anthropic.ai-chat",
};

export const AI_PROVIDER_INVENTORY: AiProviderInventoryEntry[] = [
  {
    id: "nudgeonly.openrouter.free-default",
    provider: "OpenRouter",
    surface: "packages/mcp-server/src/nudgeonly-tool.ts",
    call_kind: "classification",
    model: "liquid/lfm-2.5-1.2b-instruct:free",
    cost_tier: "free",
    default_allowed: true,
    notes: "PinballWake NudgeOnly default route is explicitly labelled free and remains advisory-only.",
  },
  {
    id: "event-wake-router.openrouter.classifier",
    provider: "OpenRouter",
    surface: "scripts/event-wake-router.mjs",
    call_kind: "classification",
    model: "OPENROUTER_WAKE_MODEL",
    cost_tier: "paid_or_unknown",
    default_allowed: false,
    allow_paid_flag: "OPENROUTER_WAKE_ALLOW_PAID",
    notes: "Wake classifier model is environment-selected. Models explicitly ending in :free may run by default; paid or unknown routes must require the wake allow-paid flag.",
  },
  {
    id: "memory.mcp.openai.embeddings",
    provider: "OpenAI",
    surface: "packages/mcp-server/src/memory/embeddings.ts",
    call_kind: "embedding",
    model: "text-embedding-3-small",
    cost_tier: "paid",
    default_allowed: false,
    allow_paid_flag: "MEMORY_OPENAI_EMBEDDINGS_ENABLED",
    notes: "Memory MCP embeddings already require an explicit true/1 opt-in before calling OpenAI.",
  },
  {
    id: "memory.package.openai.embeddings",
    provider: "OpenAI",
    surface: "packages/memory-mcp/src/embeddings.ts",
    call_kind: "embedding",
    model: "text-embedding-3-small",
    cost_tier: "paid",
    default_allowed: false,
    allow_paid_flag: "MEMORY_OPENAI_EMBEDDINGS_ENABLED",
    notes: "Standalone Memory MCP embeddings match the explicit true/1 gate and ignore OPENAI_API_KEY alone.",
  },
  {
    id: "memory.api.openai.embed-endpoint",
    provider: "OpenAI",
    surface: "api/memory/embed.ts",
    call_kind: "embedding",
    model: "text-embedding-3-small",
    cost_tier: "paid",
    default_allowed: false,
    allow_paid_flag: "ADMIN_EMBED_SECRET",
    notes: "Server-only embed endpoint is paid and must stay behind admin secret plus server-side credentials.",
  },
  {
    id: "memory.script.openai.backfill",
    provider: "OpenAI",
    surface: "scripts/backfill-embeddings.ts",
    call_kind: "embedding",
    model: "text-embedding-3-small",
    cost_tier: "paid",
    default_allowed: false,
    allow_paid_flag: "DRY_RUN=0 with explicit operator launch",
    notes: "Backfill script defaults to a capped operational path, but actual embedding spend is never a free/default path.",
  },
  {
    id: "arena.anthropic.bot-solve",
    provider: "Anthropic",
    surface: "api/arena.ts",
    call_kind: "chat_completion",
    model: "arena_bots.model or claude-haiku-4-5-20251001",
    cost_tier: "paid",
    default_allowed: false,
    allow_paid_flag: "ARENA_ANTHROPIC_ENABLED",
    notes: "Arena bot solve uses Anthropic for live generated solutions and must require an explicit arena spend opt-in in addition to server-side credentials.",
  },
  {
    id: "memory.admin.google.ai-chat",
    provider: "Google",
    surface: "api/memory-admin.ts?action=admin_ai_chat",
    call_kind: "chat_completion",
    model: "tenant ai_chat_model or gemini-2.5-flash-lite",
    cost_tier: "paid",
    default_allowed: false,
    allow_paid_flag: "AI_CHAT_ENABLED + tenant ai_chat_enabled + tenant ai_chat_api_key",
    notes: "Memory Admin AI chat can call Google models only after the global chat gate, tenant chat toggle, and tenant-owned API key all pass.",
  },
  {
    id: "memory.admin.openai.ai-chat",
    provider: "OpenAI",
    surface: "api/memory-admin.ts?action=admin_ai_chat",
    call_kind: "chat_completion",
    model: "tenant ai_chat_model or gpt-4o-mini",
    cost_tier: "paid",
    default_allowed: false,
    allow_paid_flag: "AI_CHAT_ENABLED + tenant ai_chat_enabled + tenant ai_chat_api_key",
    notes: "Memory Admin AI chat can call OpenAI models only after the global chat gate, tenant chat toggle, and tenant-owned API key all pass.",
  },
  {
    id: "memory.admin.anthropic.ai-chat",
    provider: "Anthropic",
    surface: "api/memory-admin.ts?action=admin_ai_chat",
    call_kind: "chat_completion",
    model: "tenant ai_chat_model or claude-haiku-4-5",
    cost_tier: "paid",
    default_allowed: false,
    allow_paid_flag: "AI_CHAT_ENABLED + tenant ai_chat_enabled + tenant ai_chat_api_key",
    notes: "Memory Admin AI chat can call Anthropic models only after the global chat gate, tenant chat toggle, and tenant-owned API key all pass.",
  },
  {
    id: "mcp.openai.tool.chat",
    provider: "OpenAI",
    surface: "packages/mcp-server/src/openai-tool.ts",
    call_kind: "chat_completion",
    model: "caller supplied or gpt-4o-mini",
    cost_tier: "paid",
    default_allowed: false,
    allow_paid_flag: "api_key argument",
    notes: "MCP OpenAI tools are paid provider calls and require an explicit caller key.",
  },
  {
    id: "mcp.openai.tool.embedding",
    provider: "OpenAI",
    surface: "packages/mcp-server/src/openai-tool.ts",
    call_kind: "embedding",
    model: "caller supplied or text-embedding-3-small",
    cost_tier: "paid",
    default_allowed: false,
    allow_paid_flag: "api_key argument",
    notes: "MCP OpenAI embedding calls are paid provider calls and require an explicit caller key.",
  },
  {
    id: "mcp.openai.tool.image-generation",
    provider: "OpenAI",
    surface: "packages/mcp-server/src/openai-tool.ts",
    call_kind: "image_generation",
    model: "caller supplied or dall-e-3",
    cost_tier: "paid",
    default_allowed: false,
    allow_paid_flag: "api_key argument",
    notes: "MCP OpenAI image generation calls are paid provider calls and require an explicit caller key.",
  },
  {
    id: "mcp.openai.tool.transcription",
    provider: "OpenAI",
    surface: "packages/mcp-server/src/openai-tool.ts",
    call_kind: "transcription",
    model: "caller supplied or whisper-1",
    cost_tier: "paid",
    default_allowed: false,
    allow_paid_flag: "api_key argument",
    notes: "MCP OpenAI transcription calls are paid provider calls and require an explicit caller key.",
  },
  {
    id: "mcp.openai.tool.model-listing",
    provider: "OpenAI",
    surface: "packages/mcp-server/src/openai-tool.ts",
    call_kind: "model_listing",
    model: "OpenAI /models",
    cost_tier: "paid_or_unknown",
    default_allowed: false,
    allow_paid_flag: "api_key argument",
    notes: "MCP OpenAI model listing still reaches a provider API and requires an explicit caller key.",
  },
  {
    id: "mcp.anthropic.tool.chat",
    provider: "Anthropic",
    surface: "packages/mcp-server/src/anthropic-tool.ts",
    call_kind: "chat_completion",
    model: "caller supplied or claude-sonnet-4-6",
    cost_tier: "paid",
    default_allowed: false,
    allow_paid_flag: "api_key argument",
    notes: "MCP Anthropic tools are paid provider calls and require an explicit caller key.",
  },
  {
    id: "mcp.anthropic.tool.model-listing",
    provider: "Anthropic",
    surface: "packages/mcp-server/src/anthropic-tool.ts",
    call_kind: "model_listing",
    model: "Anthropic /models",
    cost_tier: "paid_or_unknown",
    default_allowed: false,
    allow_paid_flag: "api_key argument",
    notes: "MCP Anthropic model listing still reaches a provider API and requires an explicit caller key.",
  },
  {
    id: "mcp.groq.tool.chat",
    provider: "Groq",
    surface: "packages/mcp-server/src/groq-tool.ts",
    call_kind: "chat_completion",
    model: "caller supplied or llama-3.3-70b-versatile",
    cost_tier: "paid",
    default_allowed: false,
    allow_paid_flag: "api_key argument",
    notes: "MCP Groq chat completions are paid or quota-bearing provider calls and require an explicit caller key.",
  },
  {
    id: "mcp.groq.tool.model-listing",
    provider: "Groq",
    surface: "packages/mcp-server/src/groq-tool.ts",
    call_kind: "model_listing",
    model: "Groq /models",
    cost_tier: "paid_or_unknown",
    default_allowed: false,
    allow_paid_flag: "api_key argument",
    notes: "MCP Groq model listing still reaches a provider API and requires an explicit caller key.",
  },
  {
    id: "mcp.cohere.tool.chat",
    provider: "Cohere",
    surface: "packages/mcp-server/src/cohere-tool.ts",
    call_kind: "chat_completion",
    model: "caller supplied or command-r-plus",
    cost_tier: "paid",
    default_allowed: false,
    allow_paid_flag: "api_key argument",
    notes: "MCP Cohere chat calls are paid provider calls and require an explicit caller key.",
  },
  {
    id: "mcp.cohere.tool.generate",
    provider: "Cohere",
    surface: "packages/mcp-server/src/cohere-tool.ts",
    call_kind: "text_generation",
    model: "caller supplied or command",
    cost_tier: "paid",
    default_allowed: false,
    allow_paid_flag: "api_key argument",
    notes: "MCP Cohere generate calls are paid provider calls and require an explicit caller key.",
  },
  {
    id: "mcp.cohere.tool.embedding",
    provider: "Cohere",
    surface: "packages/mcp-server/src/cohere-tool.ts",
    call_kind: "embedding",
    model: "caller supplied or embed-english-v3.0",
    cost_tier: "paid",
    default_allowed: false,
    allow_paid_flag: "api_key argument",
    notes: "MCP Cohere embed calls are paid provider calls and require an explicit caller key.",
  },
  {
    id: "mcp.cohere.tool.rerank",
    provider: "Cohere",
    surface: "packages/mcp-server/src/cohere-tool.ts",
    call_kind: "reranking",
    model: "caller supplied or rerank-english-v3.0",
    cost_tier: "paid",
    default_allowed: false,
    allow_paid_flag: "api_key argument",
    notes: "MCP Cohere rerank calls are paid provider calls and require an explicit caller key.",
  },
  {
    id: "mcp.cohere.tool.classify",
    provider: "Cohere",
    surface: "packages/mcp-server/src/cohere-tool.ts",
    call_kind: "classification",
    model: "caller supplied or embed-english-v2.0",
    cost_tier: "paid",
    default_allowed: false,
    allow_paid_flag: "api_key argument",
    notes: "MCP Cohere classify calls are paid provider calls and require an explicit caller key.",
  },
  {
    id: "mcp.cohere.tool.model-listing",
    provider: "Cohere",
    surface: "packages/mcp-server/src/cohere-tool.ts",
    call_kind: "model_listing",
    model: "Cohere /models",
    cost_tier: "paid_or_unknown",
    default_allowed: false,
    allow_paid_flag: "api_key argument",
    notes: "MCP Cohere model listing still reaches a provider API and requires an explicit caller key.",
  },
] as const;

export function listAiProviderInventory(): AiProviderInventoryEntry[] {
  return [...AI_PROVIDER_INVENTORY];
}

export function getAiProviderInventoryEntry(pathId: string): AiProviderInventoryEntry | null {
  return AI_PROVIDER_INVENTORY.find((entry) => entry.id === pathId) ?? null;
}

export function getMemoryAdminAiChatPathId(provider: MemoryAdminAiChatProvider): string {
  return MEMORY_ADMIN_AI_CHAT_PATH_IDS[provider];
}

export function classifyAiProviderPath(pathId: string, model?: string | null): AiProviderInventoryEntry {
  const known = getAiProviderInventoryEntry(pathId);
  if (known) {
    return {
      ...known,
      model: model?.trim() || known.model,
    };
  }

  return {
    id: pathId,
    provider: "unknown",
    surface: "unknown",
    call_kind: "chat_completion",
    model: model?.trim() || "unknown",
    cost_tier: "paid_or_unknown",
    default_allowed: false,
    allow_paid_flag: "explicit allow_paid",
    notes: "Unknown provider or model cost must fail closed until inventoried.",
  };
}

export function decideAiProviderCall(input: AiProviderDecisionInput): AiProviderCallDecision {
  const entry = classifyAiProviderPath(input.path_id, input.model);
  const allowPaid = input.allow_paid === true;
  const freeDefault = entry.cost_tier === "free" && entry.default_allowed;

  if (freeDefault) {
    return {
      allowed: true,
      path_id: entry.id,
      provider: entry.provider,
      model: entry.model,
      cost_tier: entry.cost_tier,
      default_allowed: entry.default_allowed,
      reason: "free_default_allowed",
      allow_paid_flag: entry.allow_paid_flag,
    };
  }

  return {
    allowed: allowPaid,
    path_id: entry.id,
    provider: entry.provider,
    model: entry.model,
    cost_tier: entry.cost_tier,
    default_allowed: entry.default_allowed,
    reason: allowPaid ? "explicit_paid_allowed" : "paid_or_unknown_blocked",
    allow_paid_flag: entry.allow_paid_flag,
  };
}

export function decideMemoryAdminAiChatProviderCall(input: {
  provider: MemoryAdminAiChatProvider;
  model?: string | null;
  allow_paid?: boolean;
}): AiProviderCallDecision {
  return decideAiProviderCall({
    path_id: getMemoryAdminAiChatPathId(input.provider),
    model: input.model,
    allow_paid: input.allow_paid,
  });
}

export function publicAiProviderCostLabels(): Array<Pick<
  AiProviderInventoryEntry,
  "id" | "provider" | "surface" | "call_kind" | "model" | "cost_tier" | "default_allowed" | "allow_paid_flag"
>> {
  return AI_PROVIDER_INVENTORY.map((entry) => ({
    id: entry.id,
    provider: entry.provider,
    surface: entry.surface,
    call_kind: entry.call_kind,
    model: entry.model,
    cost_tier: entry.cost_tier,
    default_allowed: entry.default_allowed,
    allow_paid_flag: entry.allow_paid_flag,
  }));
}
