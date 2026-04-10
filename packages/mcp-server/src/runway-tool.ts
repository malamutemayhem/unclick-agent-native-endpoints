// Runway ML API integration for the UnClick MCP server.
// Uses the Runway REST API via fetch - no external dependencies.
// Users must supply an API key from app.runwayml.com/account/api-keys.

const RW_API_BASE = "https://api.dev.runwayml.com/v1";

// ─── Auth validation ──────────────────────────────────────────────────────────

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? "").trim();
  if (!key) throw new Error("api_key is required. Get one at app.runwayml.com/account/api-keys.");
  return key;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function rwGet<T>(apiKey: string, path: string): Promise<T> {
  const res = await fetch(`${RW_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Runway-Version": "2024-11-06",
    },
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.message as string) ?? (data.error as string) ?? `HTTP ${res.status}`;
    throw new Error(`Runway error (${res.status}): ${msg}`);
  }
  return data as T;
}

async function rwPost<T>(apiKey: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${RW_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Runway-Version": "2024-11-06",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.message as string) ?? (data.error as string) ?? `HTTP ${res.status}`;
    throw new Error(`Runway error (${res.status}): ${msg}`);
  }
  return data as T;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function runway_generate_video(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const promptText = String(args.prompt ?? "").trim();
  const imageUrl = args.image_url ? String(args.image_url).trim() : undefined;

  if (!promptText && !imageUrl) {
    throw new Error("Either prompt (text description) or image_url is required.");
  }

  const model = String(args.model ?? "gen3a_turbo");
  const duration = Number(args.duration ?? 5);
  const ratio = String(args.ratio ?? "1280:768");

  // Runway supports image_to_video (with promptImage) or text_to_video
  const body: Record<string, unknown> = {
    model,
    ratio,
    duration,
  };

  if (imageUrl) {
    body.promptImage = imageUrl;
    if (promptText) body.promptText = promptText;
  } else {
    body.promptText = promptText;
  }

  if (args.seed !== undefined) body.seed = Number(args.seed);

  const result = await rwPost<Record<string, unknown>>(apiKey, "/image_to_video", body);

  return {
    task_id: result.id ?? null,
    status: result.status ?? "submitted",
    model,
    note: "Use runway_get_task with the task_id to poll for completion.",
    raw: result,
  };
}

export async function runway_get_task(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const taskId = String(args.task_id ?? "").trim();
  if (!taskId) throw new Error("task_id is required.");

  const result = await rwGet<Record<string, unknown>>(apiKey, `/tasks/${encodeURIComponent(taskId)}`);

  const output = result.output as string[] | undefined;
  return {
    task_id: taskId,
    status: result.status ?? null,
    progress: result.progress ?? null,
    video_url: Array.isArray(output) && output.length > 0 ? output[0] : null,
    outputs: output ?? [],
    failure: result.failure ?? null,
    failure_code: result.failureCode ?? null,
    created_at: result.createdAt ?? null,
    raw: result,
  };
}

export async function runway_list_models(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const data = await rwGet<{ data?: unknown[]; models?: unknown[] } & Record<string, unknown>>(
    apiKey, "/models"
  );

  const models = data.data ?? data.models ?? [];
  return {
    count: Array.isArray(models) ? models.length : 0,
    models,
    note: "Common models: gen3a_turbo (fast), gen3a (quality). Use model name in runway_generate_video.",
  };
}
