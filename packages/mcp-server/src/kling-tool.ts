// Kling AI API integration for the UnClick MCP server.
// Uses the Kling AI REST API via fetch - no external dependencies.
// Users must supply an API key from klingai.com (access_key format or pre-generated JWT).

const KLING_API_BASE = "https://api.klingai.com/v1";

// ─── Auth validation ──────────────────────────────────────────────────────────

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? "").trim();
  if (!key) throw new Error("api_key is required. Get one at klingai.com.");
  return key;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function klingGet<T>(apiKey: string, path: string): Promise<T> {
  const res = await fetch(`${KLING_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.message as string) ?? (data.error as string) ?? `HTTP ${res.status}`;
    throw new Error(`Kling AI error (${res.status}): ${msg}`);
  }
  return data as T;
}

async function klingPost<T>(apiKey: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${KLING_API_BASE}${path}`, {
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
    throw new Error(`Kling AI error (${res.status}): ${msg}`);
  }
  return data as T;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function kling_generate_video(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const prompt = String(args.prompt ?? "").trim();
  if (!prompt) throw new Error("prompt is required.");

  const model = String(args.model ?? "kling-v1");
  const mode = String(args.mode ?? "std");
  const duration = String(args.duration ?? "5");

  const body: Record<string, unknown> = {
    model_name: model,
    prompt,
    mode,
    duration,
  };

  if (args.image_url) body.image = String(args.image_url);
  if (args.negative_prompt) body.negative_prompt = String(args.negative_prompt);
  if (args.cfg_scale !== undefined) body.cfg_scale = Number(args.cfg_scale);
  if (args.aspect_ratio) body.aspect_ratio = String(args.aspect_ratio);
  if (args.camera_control) body.camera_control = args.camera_control;

  const result = await klingPost<Record<string, unknown>>(apiKey, "/videos/text2video", body);

  const taskData = result.data as Record<string, unknown> | undefined;
  const taskId = taskData?.task_id ?? result.task_id ?? null;

  return {
    task_id: taskId,
    status: taskData?.task_status ?? result.status ?? "submitted",
    model,
    mode,
    duration,
    note: "Use kling_get_task with the task_id to poll for completion. Status: submitted -> processing -> succeed/failed.",
    raw: result,
  };
}

export async function kling_get_task(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const taskId = String(args.task_id ?? "").trim();
  if (!taskId) throw new Error("task_id is required.");

  const result = await klingGet<Record<string, unknown>>(
    apiKey, `/videos/text2video/${encodeURIComponent(taskId)}`
  );

  const taskData = result.data as Record<string, unknown> | undefined;
  const info = taskData ?? result;
  const videos = info.task_result as Record<string, unknown> | undefined;

  return {
    task_id: taskId,
    status: info.task_status ?? null,
    progress: info.task_progress ?? null,
    video_url: (videos?.videos as Array<Record<string, unknown>>)?.[0]?.url ?? null,
    videos: videos?.videos ?? [],
    created_at: info.created_at ?? null,
    updated_at: info.updated_at ?? null,
    error: info.task_status_msg ?? null,
    raw: result,
  };
}
