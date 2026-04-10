// Higgsfield AI API integration for the UnClick MCP server.
// Uses the Higgsfield REST API via fetch - no external dependencies.
// Users must supply an API key from higgsfield.ai.

const HF_API_BASE = "https://api.higgsfield.ai/v1";

// ─── Auth validation ──────────────────────────────────────────────────────────

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? "").trim();
  if (!key) throw new Error("api_key is required. Get one at higgsfield.ai.");
  return key;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function hfGet<T>(apiKey: string, path: string): Promise<T> {
  const res = await fetch(`${HF_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.message as string) ?? (data.error as string) ?? `HTTP ${res.status}`;
    throw new Error(`Higgsfield error (${res.status}): ${msg}`);
  }
  return data as T;
}

async function hfPost<T>(apiKey: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${HF_API_BASE}${path}`, {
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
    throw new Error(`Higgsfield error (${res.status}): ${msg}`);
  }
  return data as T;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function higgsfield_generate_video(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const prompt = String(args.prompt ?? "").trim();
  if (!prompt) throw new Error("prompt is required.");

  const body: Record<string, unknown> = { prompt };
  if (args.style) body.style = String(args.style);
  if (args.duration) body.duration = Number(args.duration);
  if (args.aspect_ratio) body.aspect_ratio = String(args.aspect_ratio);
  if (args.negative_prompt) body.negative_prompt = String(args.negative_prompt);
  if (args.seed !== undefined) body.seed = Number(args.seed);

  const result = await hfPost<Record<string, unknown>>(apiKey, "/video/generate", body);

  return {
    generation_id: result.id ?? result.generation_id ?? null,
    status: result.status ?? "submitted",
    prompt,
    note: "Use higgsfield_get_status with the generation_id to poll for completion.",
    raw: result,
  };
}

export async function higgsfield_generate_image(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const prompt = String(args.prompt ?? "").trim();
  if (!prompt) throw new Error("prompt is required.");

  const body: Record<string, unknown> = { prompt };
  if (args.style) body.style = String(args.style);
  if (args.width) body.width = Number(args.width);
  if (args.height) body.height = Number(args.height);
  if (args.negative_prompt) body.negative_prompt = String(args.negative_prompt);
  if (args.seed !== undefined) body.seed = Number(args.seed);

  const result = await hfPost<Record<string, unknown>>(apiKey, "/image/generate", body);

  return {
    generation_id: result.id ?? result.generation_id ?? null,
    status: result.status ?? "submitted",
    image_url: result.image_url ?? result.url ?? null,
    prompt,
    raw: result,
  };
}

export async function higgsfield_get_styles(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const data = await hfGet<{ styles?: unknown[]; data?: unknown[] }>(apiKey, "/styles");

  const styles = data.styles ?? data.data ?? [];
  return {
    count: Array.isArray(styles) ? styles.length : 0,
    styles,
  };
}

export async function higgsfield_get_status(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const generationId = String(args.generation_id ?? "").trim();
  if (!generationId) throw new Error("generation_id is required.");

  const result = await hfGet<Record<string, unknown>>(apiKey, `/generation/${encodeURIComponent(generationId)}`);

  return {
    generation_id: generationId,
    status: result.status ?? null,
    video_url: result.video_url ?? result.url ?? null,
    image_url: result.image_url ?? null,
    created_at: result.created_at ?? null,
    completed_at: result.completed_at ?? null,
    error: result.error ?? null,
    raw: result,
  };
}
