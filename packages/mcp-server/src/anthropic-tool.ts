// Anthropic Messages API integration for the UnClick MCP server.
// Uses the Anthropic REST API via fetch - no external dependencies.
// Users must supply an API key from console.anthropic.com.
// This tool is useful for agents that need to call Claude (or other models)
// programmatically, compare model outputs, or chain model calls.

const ANTHROPIC_API_BASE = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AnthropicToolOperation = "chat" | "model-listing";

type AnthropicToolCostTier = "paid" | "paid_or_unknown";

interface AnthropicToolDecisionInput {
  path_id: string;
  model: string;
  allow_paid?: boolean;
}

export interface AnthropicToolDecision {
  allowed: boolean;
  path_id: string;
  provider: "Anthropic";
  model: string;
  cost_tier: AnthropicToolCostTier;
  default_allowed: false;
  reason: "explicit_paid_allowed" | "paid_or_unknown_blocked";
  allow_paid_flag: "api_key argument";
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: string; text?: string }>;
}

interface AnthropicContentBlock {
  type: "text" | "tool_use";
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: { input_tokens: number; output_tokens: number };
}

interface AnthropicModel {
  type: string;
  id: string;
  display_name: string;
  created_at: string;
}

// ─── Spend guard ──────────────────────────────────────────────────────────────

const ANTHROPIC_TOOL_PATH_IDS: Record<AnthropicToolOperation, string> = {
  chat: "mcp.anthropic.tool.chat",
  "model-listing": "mcp.anthropic.tool.model-listing",
};

const ANTHROPIC_TOOL_OPERATION_BY_PATH_ID: Record<string, AnthropicToolOperation> =
  Object.fromEntries(
    Object.entries(ANTHROPIC_TOOL_PATH_IDS).map(([operation, pathId]) => [pathId, operation]),
  ) as Record<string, AnthropicToolOperation>;

const ANTHROPIC_TOOL_COST_TIERS: Record<AnthropicToolOperation, AnthropicToolCostTier> = {
  chat: "paid",
  "model-listing": "paid_or_unknown",
};

function decideAiProviderCall(input: AnthropicToolDecisionInput): AnthropicToolDecision {
  const operation = ANTHROPIC_TOOL_OPERATION_BY_PATH_ID[input.path_id];
  const allowed = input.allow_paid === true;

  return {
    allowed,
    path_id: input.path_id,
    provider: "Anthropic",
    model: input.model,
    cost_tier: operation ? ANTHROPIC_TOOL_COST_TIERS[operation] : "paid_or_unknown",
    default_allowed: false,
    reason: allowed ? "explicit_paid_allowed" : "paid_or_unknown_blocked",
    allow_paid_flag: "api_key argument",
  };
}

export function decideAnthropicToolProviderCall(
  operation: AnthropicToolOperation,
  model: string,
  apiKey: string,
): AnthropicToolDecision {
  return decideAiProviderCall({
    path_id: ANTHROPIC_TOOL_PATH_IDS[operation],
    model,
    allow_paid: Boolean(apiKey),
  });
}

function requireAnthropicSpendAllowed(operation: AnthropicToolOperation, model: string, apiKey: string): void {
  const decision = decideAnthropicToolProviderCall(operation, model, apiKey);
  if (!decision.allowed) {
    throw new Error(`AI spend guard blocked ${decision.path_id}: ${decision.allow_paid_flag} is required.`);
  }
}

// ─── Auth validation ──────────────────────────────────────────────────────────

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? "").trim();
  if (!key) throw new Error("api_key is required. Get one at console.anthropic.com/settings/keys.");
  return key;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function anthropicPost<T>(apiKey: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${ANTHROPIC_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as Record<string, unknown> | undefined;
    const msg = (err?.message as string) ?? `HTTP ${res.status}`;
    const type = err?.type ? ` [${err.type}]` : "";
    throw new Error(`Anthropic API error${type}: ${msg}`);
  }
  return data as T;
}

async function anthropicGet<T>(apiKey: string, path: string): Promise<T> {
  const res = await fetch(`${ANTHROPIC_API_BASE}${path}`, {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as Record<string, unknown> | undefined;
    const msg = (err?.message as string) ?? `HTTP ${res.status}`;
    throw new Error(`Anthropic API error: ${msg}`);
  }
  return data as T;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function anthropicCreateMessage(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const model = String(args.model ?? "claude-sonnet-4-6");
  const maxTokens = Math.min(8192, Math.max(1, Number(args.max_tokens ?? 1024)));
  requireAnthropicSpendAllowed("chat", model, apiKey);

  // Parse messages
  let messages: AnthropicMessage[];
  if (Array.isArray(args.messages)) {
    messages = args.messages as AnthropicMessage[];
  } else if (typeof args.messages === "string") {
    try { messages = JSON.parse(args.messages); }
    catch { throw new Error("messages must be a JSON array of {role, content} objects."); }
  } else if (args.prompt) {
    // Convenience: single user message via 'prompt'
    messages = [{ role: "user", content: String(args.prompt) }];
  } else {
    throw new Error("Either messages (array) or prompt (string) is required.");
  }

  if (messages.length === 0) throw new Error("messages array must not be empty.");

  const body: Record<string, unknown> = { model, max_tokens: maxTokens, messages };

  if (args.system) body.system = String(args.system);
  if (args.temperature !== undefined) body.temperature = Number(args.temperature);
  if (args.top_p !== undefined) body.top_p = Number(args.top_p);
  if (args.top_k !== undefined) body.top_k = Number(args.top_k);
  if (args.stop_sequences) body.stop_sequences = args.stop_sequences;
  if (args.metadata) body.metadata = args.metadata;

  const result = await anthropicPost<AnthropicResponse>(apiKey, "/messages", body);

  // Extract text content blocks
  const textBlocks = result.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "");

  return {
    id: result.id,
    model: result.model,
    role: result.role,
    content: textBlocks.join("\n"),
    content_blocks: result.content.map((b) => ({
      type: b.type,
      text: b.text ?? null,
      tool_name: b.name ?? null,
      tool_input: b.input ?? null,
    })),
    stop_reason: result.stop_reason,
    usage: result.usage,
  };
}

export async function anthropicListModels(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  requireAnthropicSpendAllowed("model-listing", "Anthropic /models", apiKey);
  const data = await anthropicGet<{ data: AnthropicModel[]; has_more: boolean; first_id?: string; last_id?: string }>(
    apiKey, "/models"
  );

  return {
    count: data.data.length,
    has_more: data.has_more,
    models: data.data.map((m) => ({
      id: m.id,
      display_name: m.display_name,
      created_at: m.created_at,
    })),
  };
}
