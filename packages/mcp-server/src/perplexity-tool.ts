// Perplexity AI API integration for the UnClick MCP server.
// Uses the Perplexity REST API via fetch - no external dependencies.
// Users must supply an API key from www.perplexity.ai/settings/api.

const PERPLEXITY_API_BASE = "https://api.perplexity.ai";

// --- Types -------------------------------------------------------------------

interface PerplexityMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface PerplexityChatResponse {
  id: string;
  model: string;
  object: string;
  created: number;
  choices: Array<{
    index: number;
    message: PerplexityMessage;
    finish_reason: string;
    delta?: { role: string; content: string };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  citations?: string[];
  search_results?: Array<{ title: string; url: string; date?: string; author?: string }>;
  related_questions?: string[];
}

// --- Auth validation ---------------------------------------------------------

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? "").trim();
  if (!key) throw new Error("api_key is required. Get one at www.perplexity.ai/settings/api.");
  return key;
}

// --- API helpers -------------------------------------------------------------

async function perplexityPost<T>(apiKey: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${PERPLEXITY_API_BASE}${path}`, {
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
    const msg = (err?.message as string) ?? (data.detail as string) ?? `HTTP ${res.status}`;
    throw new Error(`Perplexity error: ${msg}`);
  }
  return data as T;
}

// --- Operations --------------------------------------------------------------

export async function perplexityChatCompletion(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = requireKey(args);
    const model = String(args.model ?? "sonar");

    // Parse messages
    let messages: PerplexityMessage[];
    if (Array.isArray(args.messages)) {
      messages = args.messages as PerplexityMessage[];
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
    if (args.max_tokens) body.max_tokens = Number(args.max_tokens);
    if (args.temperature !== undefined) body.temperature = Number(args.temperature);

    // Perplexity-specific search options
    if (args.search_domain_filter) {
      body.search_domain_filter = Array.isArray(args.search_domain_filter)
        ? args.search_domain_filter
        : [String(args.search_domain_filter)];
    }
    if (args.search_recency_filter) body.search_recency_filter = String(args.search_recency_filter);
    if (args.return_images !== undefined) body.return_images = Boolean(args.return_images);
    if (args.return_related_questions !== undefined) body.return_related_questions = Boolean(args.return_related_questions);

    const result = await perplexityPost<PerplexityChatResponse>(apiKey, "/chat/completions", body);
    return {
      id: result.id,
      model: result.model,
      created: new Date(result.created * 1000).toISOString(),
      message: result.choices[0]?.message.content ?? null,
      finish_reason: result.choices[0]?.finish_reason ?? null,
      citations: result.citations ?? [],
      related_questions: result.related_questions ?? [],
      usage: result.usage,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
