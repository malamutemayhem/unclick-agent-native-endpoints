// OpenAI API integration for the UnClick MCP server.
// Uses the OpenAI REST API via fetch - no external dependencies.
// Users must supply an API key from platform.openai.com.

const OPENAI_API_BASE = "https://api.openai.com/v1";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpenAiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAiChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenAiMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAiEmbeddingResponse {
  object: string;
  model: string;
  data: Array<{ index: number; object: string; embedding: number[] }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

interface OpenAiImageResponse {
  created: number;
  data: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
}

interface OpenAiTranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: unknown[];
}

interface OpenAiModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

// ─── Auth validation ──────────────────────────────────────────────────────────

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? "").trim();
  if (!key) throw new Error("api_key is required. Get one at platform.openai.com/api-keys.");
  return key;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function openaiPost<T>(apiKey: string, path: string, body: unknown, orgId?: string): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (orgId) headers["OpenAI-Organization"] = orgId;

  const res = await fetch(`${OPENAI_API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as Record<string, unknown> | undefined;
    const msg = (err?.message as string) ?? `HTTP ${res.status}`;
    const code = err?.code ? ` (${err.code})` : "";
    const type = err?.type ? ` [${err.type}]` : "";
    throw new Error(`OpenAI error${type}${code}: ${msg}`);
  }
  return data as T;
}

async function openaiGet<T>(apiKey: string, path: string): Promise<T> {
  const res = await fetch(`${OPENAI_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as Record<string, unknown> | undefined;
    const msg = (err?.message as string) ?? `HTTP ${res.status}`;
    throw new Error(`OpenAI error: ${msg}`);
  }
  return data as T;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function openaiChatCompletion(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const model = String(args.model ?? "gpt-4o-mini");
  const orgId = args.org_id ? String(args.org_id) : undefined;

  // Parse messages
  let messages: OpenAiMessage[];
  if (Array.isArray(args.messages)) {
    messages = args.messages as OpenAiMessage[];
  } else if (typeof args.messages === "string") {
    try { messages = JSON.parse(args.messages); }
    catch { throw new Error("messages must be a JSON array of {role, content} objects."); }
  } else if (args.prompt) {
    // Convenience: single user message via 'prompt'
    const systemPrompt = args.system_prompt ? String(args.system_prompt) : undefined;
    messages = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: String(args.prompt) });
  } else {
    throw new Error("Either messages (array) or prompt (string) is required.");
  }

  if (messages.length === 0) throw new Error("messages array must not be empty.");

  const body: Record<string, unknown> = { model, messages };
  if (args.max_tokens) body.max_tokens = Number(args.max_tokens);
  if (args.temperature !== undefined) body.temperature = Number(args.temperature);
  if (args.top_p !== undefined) body.top_p = Number(args.top_p);
  if (args.n !== undefined) body.n = Number(args.n);
  if (args.stop) body.stop = args.stop;
  if (args.response_format) body.response_format = args.response_format;
  if (args.seed !== undefined) body.seed = Number(args.seed);

  const result = await openaiPost<OpenAiChatResponse>(apiKey, "/chat/completions", body, orgId);
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

export async function openaiCreateEmbedding(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const model = String(args.model ?? "text-embedding-3-small");
  const orgId = args.org_id ? String(args.org_id) : undefined;

  let input: string | string[];
  if (typeof args.input === "string") {
    input = args.input;
  } else if (Array.isArray(args.input)) {
    input = args.input as string[];
  } else {
    throw new Error("input is required (a string or array of strings to embed).");
  }

  const body: Record<string, unknown> = { model, input };
  if (args.dimensions) body.dimensions = Number(args.dimensions);

  const result = await openaiPost<OpenAiEmbeddingResponse>(apiKey, "/embeddings", body, orgId);
  return {
    model: result.model,
    embeddings: result.data.map((d) => ({
      index: d.index,
      dimensions: d.embedding.length,
      embedding: d.embedding,
    })),
    usage: result.usage,
  };
}

export async function openaiGenerateImage(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const prompt = String(args.prompt ?? "").trim();
  if (!prompt) throw new Error("prompt is required.");
  const model = String(args.model ?? "dall-e-3");
  const n = Math.min(10, Math.max(1, Number(args.n ?? 1)));
  const size = String(args.size ?? "1024x1024");
  const quality = String(args.quality ?? "standard");
  const style = args.style ? String(args.style) : undefined;
  const responseFormat = String(args.response_format ?? "url");

  const body: Record<string, unknown> = { model, prompt, n, size, quality, response_format: responseFormat };
  if (style) body.style = style;

  const result = await openaiPost<OpenAiImageResponse>(apiKey, "/images/generations", body);
  return {
    count: result.data.length,
    images: result.data.map((img) => ({
      url: img.url ?? null,
      b64_json: img.b64_json ?? null,
      revised_prompt: img.revised_prompt ?? null,
    })),
  };
}

export async function openaiCreateTranscription(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const audioUrl = String(args.audio_url ?? "").trim();
  if (!audioUrl) throw new Error("audio_url is required (URL of the audio file to transcribe).");
  const model = String(args.model ?? "whisper-1");
  const language = args.language ? String(args.language) : undefined;
  const responseFormat = String(args.response_format ?? "json");

  // Fetch the audio file
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) throw new Error(`Failed to fetch audio_url: HTTP ${audioRes.status}`);
  const audioBlob = await audioRes.blob();

  const filename = args.filename ? String(args.filename) : "audio.mp3";
  const form = new FormData();
  form.append("file", audioBlob, filename);
  form.append("model", model);
  form.append("response_format", responseFormat);
  if (language) form.append("language", language);
  if (args.prompt) form.append("prompt", String(args.prompt));
  if (args.temperature !== undefined) form.append("temperature", String(args.temperature));

  const res = await fetch(`${OPENAI_API_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json() as Record<string, unknown>;
      const err = data.error as Record<string, unknown> | undefined;
      msg = (err?.message as string) ?? msg;
    } catch { /* ignore */ }
    throw new Error(`OpenAI transcription error: ${msg}`);
  }

  if (responseFormat === "json" || responseFormat === "verbose_json") {
    const data = await res.json() as OpenAiTranscriptionResponse;
    return {
      text: data.text,
      language: data.language ?? null,
      duration: data.duration ?? null,
      model,
    };
  } else {
    const text = await res.text();
    return { text, model };
  }
}

export async function openaiListModels(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const data = await openaiGet<{ data: OpenAiModel[] }>(apiKey, "/models");

  const models = data.data ?? [];
  // Sort by creation date descending
  models.sort((a, b) => b.created - a.created);

  return {
    count: models.length,
    models: models.map((m) => ({
      id: m.id,
      created: new Date(m.created * 1000).toISOString(),
      owned_by: m.owned_by,
    })),
  };
}
