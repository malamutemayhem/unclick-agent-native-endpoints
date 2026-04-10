// Pika API integration for the UnClick MCP server.
// Uses the Pika REST API via fetch - no external dependencies.
// Users must supply an API key from pika.art.

const PIKA_API_BASE = "https://api.pika.art/v1";

// ─── Auth validation ──────────────────────────────────────────────────────────

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? "").trim();
  if (!key) throw new Error("api_key is required. Get one at pika.art.");
  return key;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function pikaGet<T>(apiKey: string, path: string): Promise<T> {
  const res = await fetch(`${PIKA_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.message as string) ?? (data.error as string) ?? `HTTP ${res.status}`;
    throw new Error(`Pika error (${res.status}): ${msg}`);
  }
  return data as T;
}

async function pikaPost<T>(apiKey: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${PIKA_API_BASE}${path}`, {
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
    throw new Error(`Pika error (${res.status}): ${msg}`);
  }
  return data as T;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function pika_generate_video(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const prompt = String(args.prompt ?? "").trim();
  if (!prompt) throw new Error("prompt is required.");

  const body: Record<string, unknown> = { prompt };
  if (args.image_url) body.image = String(args.image_url);
  if (args.style) body.style = String(args.style);
  if (args.duration) body.duration = Number(args.duration);
  if (args.aspect_ratio) body.aspectRatio = String(args.aspect_ratio);
  if (args.negative_prompt) body.negativePrompt = String(args.negative_prompt);
  if (args.seed !== undefined) body.seed = Number(args.seed);
  if (args.motion) body.motion = Number(args.motion);
  if (args.guidance_scale !== undefined) body.guidanceScale = Number(args.guidance_scale);

  const result = await pikaPost<Record<string, unknown>>(apiKey, "/generate", body);

  return {
    generation_id: result.id ?? result.generation_id ?? null,
    status: result.status ?? "submitted",
    prompt,
    note: "Use pika_get_generation with the generation_id to poll for completion.",
    raw: result,
  };
}

export async function pika_get_generation(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const generationId = String(args.generation_id ?? "").trim();
  if (!generationId) throw new Error("generation_id is required.");

  const result = await pikaGet<Record<string, unknown>>(
    apiKey, `/generations/${encodeURIComponent(generationId)}`
  );

  return {
    generation_id: generationId,
    status: result.status ?? null,
    video_url: result.video_url ?? result.url ?? null,
    thumbnail_url: result.thumbnail_url ?? null,
    duration: result.duration ?? null,
    created_at: result.created_at ?? result.createdAt ?? null,
    error: result.error ?? null,
    raw: result,
  };
}

export async function pika_list_styles(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const data = await pikaGet<{ styles?: unknown[]; data?: unknown[] } & Record<string, unknown>>(
    apiKey, "/styles"
  );

  const styles = data.styles ?? data.data ?? [];
  return {
    count: Array.isArray(styles) ? styles.length : 0,
    styles,
    note: "Pass a style name or ID as the style parameter in pika_generate_video.",
  };
}
