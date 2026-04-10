// HeyGen API integration for the UnClick MCP server.
// Uses the HeyGen REST API via fetch - no external dependencies.
// Users must supply an API key from app.heygen.com/settings.

const HG_API_BASE = "https://api.heygen.com";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HeyGenAvatar {
  avatar_id: string;
  avatar_name: string;
  gender?: string;
  preview_image_url?: string;
  preview_video_url?: string;
}

interface HeyGenVoice {
  voice_id: string;
  language: string;
  gender: string;
  name: string;
  preview_audio?: string;
}

// ─── Auth validation ──────────────────────────────────────────────────────────

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? "").trim();
  if (!key) throw new Error("api_key is required. Get one at app.heygen.com/settings.");
  return key;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function hgGet<T>(apiKey: string, path: string): Promise<T> {
  const res = await fetch(`${HG_API_BASE}${path}`, {
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.message as string) ?? (data.error as string) ?? `HTTP ${res.status}`;
    throw new Error(`HeyGen error (${res.status}): ${msg}`);
  }
  return data as T;
}

async function hgPost<T>(apiKey: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${HG_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.message as string) ?? (data.error as string) ?? `HTTP ${res.status}`;
    throw new Error(`HeyGen error (${res.status}): ${msg}`);
  }
  return data as T;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function heygen_create_avatar_video(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const avatarId = String(args.avatar_id ?? "").trim();
  const script = String(args.script ?? "").trim();
  if (!avatarId) throw new Error("avatar_id is required.");
  if (!script) throw new Error("script is required (the text the avatar will speak).");

  const voiceId = args.voice_id ? String(args.voice_id) : undefined;
  const backgroundUrl = args.background_url ? String(args.background_url) : undefined;
  const width = args.width ? Number(args.width) : 1280;
  const height = args.height ? Number(args.height) : 720;

  const body: Record<string, unknown> = {
    video_inputs: [
      {
        character: {
          type: "avatar",
          avatar_id: avatarId,
          avatar_style: args.avatar_style ?? "normal",
        },
        voice: voiceId
          ? { type: "text", input_text: script, voice_id: voiceId }
          : { type: "text", input_text: script },
        background: backgroundUrl
          ? { type: "image", url: backgroundUrl }
          : { type: "color", value: "#ffffff" },
      },
    ],
    dimension: { width, height },
  };

  if (args.title) body.title = String(args.title);
  if (args.test !== undefined) body.test = Boolean(args.test);

  const result = await hgPost<{ data?: Record<string, unknown> } & Record<string, unknown>>(
    apiKey, "/v2/video/generate", body
  );

  const videoId = (result.data?.video_id ?? result.video_id) as string | undefined;

  return {
    video_id: videoId ?? null,
    status: "submitted",
    note: "Use heygen_get_video_status with the video_id to poll for completion.",
    raw: result,
  };
}

export async function heygen_list_avatars(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const data = await hgGet<{ data?: { avatars?: HeyGenAvatar[] } } & Record<string, unknown>>(
    apiKey, "/v2/avatars"
  );

  const avatars = data.data?.avatars ?? [];
  return {
    count: avatars.length,
    avatars: avatars.map((a) => ({
      avatar_id: a.avatar_id,
      name: a.avatar_name,
      gender: a.gender ?? null,
      preview_image_url: a.preview_image_url ?? null,
    })),
  };
}

export async function heygen_get_video_status(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const videoId = String(args.video_id ?? "").trim();
  if (!videoId) throw new Error("video_id is required.");

  const data = await hgGet<{ data?: Record<string, unknown> } & Record<string, unknown>>(
    apiKey, `/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`
  );

  const info = data.data ?? data;
  return {
    video_id: videoId,
    status: info.status ?? null,
    video_url: info.video_url ?? null,
    thumbnail_url: info.thumbnail_url ?? null,
    duration: info.duration ?? null,
    created_at: info.created_at ?? null,
    error: info.error ?? null,
    raw: data,
  };
}

export async function heygen_list_voices(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const data = await hgGet<{ data?: { voices?: HeyGenVoice[] } } & Record<string, unknown>>(
    apiKey, "/v2/voices"
  );

  const voices = data.data?.voices ?? [];
  return {
    count: voices.length,
    voices: voices.map((v) => ({
      voice_id: v.voice_id,
      name: v.name,
      language: v.language,
      gender: v.gender,
      preview_audio: v.preview_audio ?? null,
    })),
  };
}
