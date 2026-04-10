// Mistral AI API integration for the UnClick MCP server.
// Uses the Mistral REST API via fetch - no external dependencies.
// Users must supply an API key from console.mistral.ai.

const MISTRAL_API_BASE = "https://api.mistral.ai/v1";

// --- Types -------------------------------------------------------------------

interface MistralMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface MistralChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: MistralMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface MistralModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  capabilities?: {
    completion_chat: boolean;
    completion_fim: boolean;
    function_calling: boolean;
    fine_tuning: boolean;
    vision: boolean;
  };
}

interface MistralEmbeddingResponse {
  id: string;
  object: string;
  model: string;
  data: Array<{ index: number; object: string; embedding: number[] }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

// --- Auth validation ---------------------------------------------------------

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? "").trim();
  if (!key) throw new Error("api_key is required. Get one at console.mistral.ai.");
  return key;
}

// --- API helpers -------------------------------------------------------------

async function mistralPost<T>(apiKey: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${MISTRAL_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.message as string) ?? (data.error as string) ?? `HTTP ${res.status}`;
    throw new Error(`Mistral error: ${msg}`);
  }
  return data as T;
}

async function mistralGet<T>(apiKey: string, path: string): Promise<T> {
  const res = await fetch(`${MISTRAL_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.message as string) ?? (data.error as string) ?? `HTTP ${res.status}`;
    throw new Error(`Mistral error: ${msg}`);
  }
  return data as T;
}

// --- Operations --------------------------------------------------------------

export async function mistralChatCompletion(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = requireKey(args);
    const model = String(args.model ?? "mistral-small-latest");

    // Parse messages
    let messages: MistralMessage[];
    if (Array.isArray(args.messages)) {
      messages = args.messages as MistralMessage[];
    } else if (typeof args.messages === "string") {
      try { messages = JSON.parse(args.messages); }
      catch { throw new Error("messages must be a JSON array of {role, content} objects."); }
    } else if (args.prompt) {
      const systemPrompt = args.system_prompt ? String(args.system_prompt) : undefined;
      messages = [];
      if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
      messages.push({ role: "user", content: String(args.prompt) });
    } else {
      throw new Error("Either messages (array) or prompt (string) is required.");
    }

    if (messages.length === 0) throw new Error("messages array must not be empty.");

    const body: Record<string, unknown> = { model, messages, stream: false };
    if (args.max_tokens) body.max_tokens = Number(args.max_tokens);
    if (args.temperature !== undefined) body.temperature = Number(args.temperature);
    if (args.top_p !== undefined) body.top_p = Number(args.top_p);

    const result = await mistralPost<MistralChatResponse>(apiKey, "/chat/completions", body);
    return {
      id: result.id,
      model: result.model,
      created: new Date(result.created * 1000).toISOString(),
      message: result.choices[0]?.message.content ?? null,
      finish_reason: result.choices[0]?.finish_reason ?? null,
      choices: result.choices.map((c) => ({
        content: c.message.content,
        finish_reason: c.finish_reason,
      })),
      usage: result.usage,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function mistralListModels(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = requireKey(args);
    const data = await mistralGet<{ data: MistralModel[] }>(apiKey, "/models");
    const models = data.data ?? [];

    return {
      count: models.length,
      models: models.map((m) => ({
        id: m.id,
        owned_by: m.owned_by,
        created: m.created ? new Date(m.created * 1000).toISOString() : null,
        capabilities: m.capabilities ?? null,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function mistralCreateEmbedding(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = requireKey(args);
    const model = String(args.model ?? "mistral-embed");
    const encodingFormat = String(args.encoding_format ?? "float");

    let input: string | string[];
    if (typeof args.input === "string") {
      input = args.input;
    } else if (Array.isArray(args.input)) {
      input = args.input as string[];
    } else {
      throw new Error("input is required (a string or array of strings to embed).");
    }

    const body: Record<string, unknown> = { model, input, encoding_format: encodingFormat };

    const result = await mistralPost<MistralEmbeddingResponse>(apiKey, "/embeddings", body);
    return {
      model: result.model,
      embeddings: result.data.map((d) => ({
        index: d.index,
        dimensions: d.embedding.length,
        embedding: d.embedding,
      })),
      usage: result.usage,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
