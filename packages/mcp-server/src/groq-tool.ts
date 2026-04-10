// Groq Fast Inference API integration for the UnClick MCP server.
// Uses the Groq REST API via fetch - no external dependencies.
// Compatible with OpenAI API format. Users must supply an API key from console.groq.com.

const GROQ_BASE = "https://api.groq.com/openai/v1";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: GroqMessage;
    finish_reason: string;
    logprobs: unknown;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_time: number;
    completion_time: number;
    total_time: number;
  };
  x_groq?: { id: string };
}

interface GroqModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  active: boolean;
  context_window: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? "").trim();
  if (!key) throw new Error("api_key is required. Get one at console.groq.com/keys.");
  return key;
}

async function groqPost<T>(apiKey: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${GROQ_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as Record<string, unknown> | undefined;
    const msg = (err?.message as string) ?? `HTTP ${res.status}`;
    throw new Error(`Groq error: ${msg}`);
  }
  return data as T;
}

async function groqGet<T>(apiKey: string, path: string): Promise<T> {
  const res = await fetch(`${GROQ_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as Record<string, unknown> | undefined;
    const msg = (err?.message as string) ?? `HTTP ${res.status}`;
    throw new Error(`Groq error: ${msg}`);
  }
  return data as T;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function groqChatCompletion(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const model = String(args.model ?? "llama-3.3-70b-versatile");

  let messages: GroqMessage[];
  if (Array.isArray(args.messages)) {
    messages = args.messages as GroqMessage[];
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

  const body: Record<string, unknown> = { model, messages };
  if (args.max_tokens)           body.max_tokens  = Number(args.max_tokens);
  if (args.temperature !== undefined) body.temperature = Number(args.temperature);
  if (args.top_p !== undefined)       body.top_p = Number(args.top_p);
  if (args.stop)                 body.stop = args.stop;
  if (args.stream !== undefined) body.stream = Boolean(args.stream);

  const result = await groqPost<GroqChatResponse>(apiKey, "/chat/completions", body);
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
}

export async function groqListModels(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const data = await groqGet<{ data: GroqModel[] }>(apiKey, "/models");
  const models = (data.data ?? []).filter((m) => m.active !== false);
  models.sort((a, b) => b.created - a.created);
  return {
    count: models.length,
    models: models.map((m) => ({
      id: m.id,
      owned_by: m.owned_by,
      context_window: m.context_window,
      created: new Date(m.created * 1000).toISOString(),
    })),
  };
}
