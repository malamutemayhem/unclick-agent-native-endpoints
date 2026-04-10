// Cohere AI API integration for the UnClick MCP server.
// Uses the Cohere REST API via fetch - no external dependencies.
// Users must supply an API key from dashboard.cohere.com.

const COHERE_API_BASE = "https://api.cohere.com/v1";

// --- Types -------------------------------------------------------------------

interface CohereChatMessage {
  role: "USER" | "CHATBOT";
  message: string;
}

interface CohereChatResponse {
  text: string;
  generation_id: string;
  finish_reason: string;
  meta?: {
    billed_units?: { input_tokens: number; output_tokens: number };
    tokens?: { input_tokens: number; output_tokens: number };
  };
}

interface CohereGenerateResponse {
  id: string;
  generations: Array<{ id: string; text: string; finish_reason: string }>;
  meta?: Record<string, unknown>;
}

interface CohereEmbedResponse {
  id: string;
  embeddings: number[][];
  texts: string[];
  meta?: Record<string, unknown>;
}

interface CohereRerankResponse {
  id: string;
  results: Array<{ index: number; relevance_score: number; document?: Record<string, unknown> }>;
  meta?: Record<string, unknown>;
}

interface CohereClassifyResponse {
  id: string;
  classifications: Array<{
    id: string;
    input: string;
    prediction: string;
    confidence: number;
    labels: Record<string, { confidence: number }>;
  }>;
  meta?: Record<string, unknown>;
}

interface CohereModel {
  name: string;
  endpoints?: string[];
  context_length?: number;
  tokenizer_url?: string;
}

// --- Auth validation ---------------------------------------------------------

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? "").trim();
  if (!key) throw new Error("api_key is required. Get one at dashboard.cohere.com.");
  return key;
}

// --- API helpers -------------------------------------------------------------

async function coherePost<T>(apiKey: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${COHERE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Client-Name": "unclick-mcp",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.message as string) ?? `HTTP ${res.status}`;
    throw new Error(`Cohere error: ${msg}`);
  }
  return data as T;
}

async function cohereGet<T>(apiKey: string, path: string): Promise<T> {
  const res = await fetch(`${COHERE_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-Client-Name": "unclick-mcp",
    },
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.message as string) ?? `HTTP ${res.status}`;
    throw new Error(`Cohere error: ${msg}`);
  }
  return data as T;
}

function parseJsonOrArray<T>(value: unknown, fieldName: string): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try { return JSON.parse(value) as T[]; }
    catch { throw new Error(`${fieldName} must be a JSON array or an array.`); }
  }
  throw new Error(`${fieldName} is required as an array or JSON string array.`);
}

// --- Operations --------------------------------------------------------------

export async function cohereChat(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = requireKey(args);
    const message = String(args.message ?? "").trim();
    if (!message) throw new Error("message is required.");

    const model = String(args.model ?? "command-r-plus");

    const body: Record<string, unknown> = { message, model };
    if (args.preamble) body.preamble = String(args.preamble);
    if (args.max_tokens) body.max_tokens = Number(args.max_tokens);
    if (args.temperature !== undefined) body.temperature = Number(args.temperature);

    if (args.chat_history) {
      let history: CohereChatMessage[];
      if (Array.isArray(args.chat_history)) {
        history = args.chat_history as CohereChatMessage[];
      } else if (typeof args.chat_history === "string") {
        try { history = JSON.parse(args.chat_history); }
        catch { throw new Error("chat_history must be a JSON array of {role, message} objects."); }
      } else {
        throw new Error("chat_history must be an array or JSON string.");
      }
      body.chat_history = history;
    }

    const result = await coherePost<CohereChatResponse>(apiKey, "/chat", body);
    return {
      text: result.text,
      generation_id: result.generation_id,
      finish_reason: result.finish_reason,
      usage: result.meta?.billed_units ?? result.meta?.tokens ?? null,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function cohereGenerate(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = requireKey(args);
    const prompt = String(args.prompt ?? "").trim();
    if (!prompt) throw new Error("prompt is required.");

    const model = String(args.model ?? "command");
    const body: Record<string, unknown> = { prompt, model, max_tokens: Number(args.max_tokens ?? 256) };
    if (args.temperature !== undefined) body.temperature = Number(args.temperature);
    if (args.k !== undefined) body.k = Number(args.k);
    if (args.p !== undefined) body.p = Number(args.p);
    if (args.stop_sequences) {
      body.stop_sequences = Array.isArray(args.stop_sequences)
        ? args.stop_sequences
        : JSON.parse(String(args.stop_sequences));
    }

    const result = await coherePost<CohereGenerateResponse>(apiKey, "/generate", body);
    return {
      id: result.id,
      generations: result.generations.map((g) => ({
        id: g.id,
        text: g.text,
        finish_reason: g.finish_reason,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function cohereEmbed(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = requireKey(args);
    const texts = parseJsonOrArray<string>(args.texts, "texts");
    const model = String(args.model ?? "embed-english-v3.0");
    const input_type = String(args.input_type ?? "search_document");
    const truncate = String(args.truncate ?? "END");

    const body: Record<string, unknown> = { texts, model, input_type, truncate };

    const result = await coherePost<CohereEmbedResponse>(apiKey, "/embed", body);
    return {
      model,
      count: result.embeddings.length,
      embeddings: result.embeddings.map((emb, i) => ({
        index: i,
        dimensions: emb.length,
        embedding: emb,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function cohereRerank(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = requireKey(args);
    const query = String(args.query ?? "").trim();
    if (!query) throw new Error("query is required.");

    const documents = parseJsonOrArray<unknown>(args.documents, "documents");
    const model = String(args.model ?? "rerank-english-v3.0");

    const body: Record<string, unknown> = { query, documents, model };
    if (args.top_n !== undefined) body.top_n = Number(args.top_n);

    const result = await coherePost<CohereRerankResponse>(apiKey, "/rerank", body);
    return {
      id: result.id,
      count: result.results.length,
      results: result.results.map((r) => ({
        index: r.index,
        relevance_score: r.relevance_score,
        document: r.document ?? null,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function cohereClassify(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = requireKey(args);
    const inputs = parseJsonOrArray<string>(args.inputs, "inputs");
    const examples = parseJsonOrArray<{ text: string; label: string }>(args.examples, "examples");
    const model = String(args.model ?? "embed-english-v2.0");

    const body: Record<string, unknown> = { inputs, examples, model };

    const result = await coherePost<CohereClassifyResponse>(apiKey, "/classify", body);
    return {
      id: result.id,
      count: result.classifications.length,
      classifications: result.classifications.map((c) => ({
        input: c.input,
        prediction: c.prediction,
        confidence: c.confidence,
        labels: c.labels,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function cohereListModels(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = requireKey(args);
    const data = await cohereGet<{ models: CohereModel[] }>(apiKey, "/models");
    const models = data.models ?? [];

    return {
      count: models.length,
      models: models.map((m) => ({
        name: m.name,
        endpoints: m.endpoints ?? [],
        context_length: m.context_length ?? null,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
