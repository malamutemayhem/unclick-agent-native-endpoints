// Stability AI API integration for the UnClick MCP server.
// Uses the Stability AI REST API via fetch - no external dependencies.
// Users must supply an API key from platform.stability.ai.

const STABILITY_API_BASE = "https://api.stability.ai";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StabilityEngine {
  id: string;
  name: string;
  description: string;
  type: string;
  ready: boolean;
}

interface StabilityArtifact {
  base64: string;
  seed: number;
  finishReason: string;
  mime_type?: string;
}

interface StabilityGenerationResponse {
  artifacts: StabilityArtifact[];
}

// ─── Auth validation ──────────────────────────────────────────────────────────

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? "").trim();
  if (!key) throw new Error("api_key is required. Get one at platform.stability.ai.");
  return key;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function stabilityGet<T>(apiKey: string, path: string): Promise<T> {
  const res = await fetch(`${STABILITY_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.message as string) ?? `HTTP ${res.status}`;
    const id = data.id ? ` (id: ${data.id})` : "";
    throw new Error(`Stability AI error${id}: ${msg}`);
  }
  return data as T;
}

async function stabilityPost<T>(
  apiKey: string,
  path: string,
  body: unknown,
  acceptHeader = "application/json"
): Promise<T> {
  const res = await fetch(`${STABILITY_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: acceptHeader,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.message as string) ?? `HTTP ${res.status}`;
    const id = data.id ? ` (id: ${data.id})` : "";
    throw new Error(`Stability AI error${id}: ${msg}`);
  }
  return data as T;
}

async function stabilityPostMultipart<T>(
  apiKey: string,
  path: string,
  form: FormData
): Promise<T> {
  const res = await fetch(`${STABILITY_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    body: form,
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.message as string) ?? `HTTP ${res.status}`;
    throw new Error(`Stability AI error: ${msg}`);
  }
  return data as T;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function stabilityTextToImage(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const prompt = String(args.prompt ?? "").trim();
  if (!prompt) throw new Error("prompt is required.");
  const engineId = String(args.engine_id ?? "stable-diffusion-xl-1024-v1-0");
  const negativePrompt = String(args.negative_prompt ?? "").trim();

  const width = Number(args.width ?? 1024);
  const height = Number(args.height ?? 1024);
  const steps = Math.min(150, Math.max(10, Number(args.steps ?? 30)));
  const cfgScale = Math.min(35, Math.max(0, Number(args.cfg_scale ?? 7)));
  const samples = Math.min(10, Math.max(1, Number(args.samples ?? 1)));
  const stylePreset = args.style_preset ? String(args.style_preset) : undefined;

  const textPrompts = [{ text: prompt, weight: 1 }];
  if (negativePrompt) textPrompts.push({ text: negativePrompt, weight: -1 });

  const body: Record<string, unknown> = {
    text_prompts: textPrompts,
    cfg_scale: cfgScale,
    height,
    width,
    steps,
    samples,
  };
  if (stylePreset) body.style_preset = stylePreset;
  if (args.seed !== undefined) body.seed = Number(args.seed);

  const result = await stabilityPost<StabilityGenerationResponse>(
    apiKey, `/v1/generation/${encodeURIComponent(engineId)}/text-to-image`, body
  );

  return {
    success: true,
    engine_id: engineId,
    count: result.artifacts.length,
    images: result.artifacts.map((a) => ({
      base64: a.base64,
      seed: a.seed,
      finish_reason: a.finishReason,
      note: "Decode base64 and write as PNG to save the image.",
    })),
  };
}

export async function stabilityImageToImage(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const prompt = String(args.prompt ?? "").trim();
  const imageUrl = String(args.image_url ?? "").trim();
  if (!prompt) throw new Error("prompt is required.");
  if (!imageUrl) throw new Error("image_url is required (URL of the source image).");
  const engineId = String(args.engine_id ?? "stable-diffusion-xl-1024-v1-0");
  const strength = Math.min(1, Math.max(0, Number(args.strength ?? 0.35)));
  const steps = Math.min(150, Math.max(10, Number(args.steps ?? 30)));
  const cfgScale = Math.min(35, Math.max(0, Number(args.cfg_scale ?? 7)));
  const samples = Math.min(10, Math.max(1, Number(args.samples ?? 1)));

  // Fetch the source image
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to fetch image_url: HTTP ${imgRes.status}`);
  const imgBlob = await imgRes.blob();

  const form = new FormData();
  form.append("init_image", imgBlob, "init_image.png");
  form.append("init_image_mode", "IMAGE_STRENGTH");
  form.append("image_strength", String(strength));
  form.append("text_prompts[0][text]", prompt);
  form.append("text_prompts[0][weight]", "1");
  const negativePrompt = String(args.negative_prompt ?? "").trim();
  if (negativePrompt) {
    form.append("text_prompts[1][text]", negativePrompt);
    form.append("text_prompts[1][weight]", "-1");
  }
  form.append("cfg_scale", String(cfgScale));
  form.append("steps", String(steps));
  form.append("samples", String(samples));

  const result = await stabilityPostMultipart<StabilityGenerationResponse>(
    apiKey, `/v1/generation/${encodeURIComponent(engineId)}/image-to-image`, form
  );

  return {
    success: true,
    engine_id: engineId,
    count: result.artifacts.length,
    images: result.artifacts.map((a) => ({
      base64: a.base64,
      seed: a.seed,
      finish_reason: a.finishReason,
      note: "Decode base64 and write as PNG to save the image.",
    })),
  };
}

export async function stabilityUpscale(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const imageUrl = String(args.image_url ?? "").trim();
  if (!imageUrl) throw new Error("image_url is required (URL of the image to upscale).");
  const width = Number(args.width ?? 2048);
  const engineId = String(args.engine_id ?? "esrgan-v1-x2plus");

  // Fetch source image
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to fetch image_url: HTTP ${imgRes.status}`);
  const imgBlob = await imgRes.blob();

  const form = new FormData();
  form.append("image", imgBlob, "image.png");
  form.append("width", String(width));

  const result = await stabilityPostMultipart<StabilityGenerationResponse>(
    apiKey, `/v1/generation/${encodeURIComponent(engineId)}/image-to-image/upscale`, form
  );

  return {
    success: true,
    engine_id: engineId,
    count: result.artifacts.length,
    images: result.artifacts.map((a) => ({
      base64: a.base64,
      seed: a.seed,
      finish_reason: a.finishReason,
    })),
  };
}

export async function stabilityListEngines(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const engines = await stabilityGet<StabilityEngine[]>(apiKey, "/v1/engines/list");

  return {
    count: engines.length,
    engines: engines.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      type: e.type,
      ready: e.ready,
    })),
  };
}
