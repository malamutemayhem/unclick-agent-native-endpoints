// ElevenLabs API integration for the UnClick MCP server.
// Uses the ElevenLabs REST API via fetch - no external dependencies.
// Users must supply an API key from elevenlabs.io.

const EL_API_BASE = "https://api.elevenlabs.io/v1";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ElVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  labels?: Record<string, string>;
  preview_url?: string;
  samples?: unknown[];
}

interface ElVoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

interface ElModel {
  model_id: string;
  name: string;
  description?: string;
  can_be_finetuned: boolean;
  can_do_text_to_speech: boolean;
  can_do_voice_conversion: boolean;
  languages: Array<{ language_id: string; name: string }>;
}

interface ElHistoryItem {
  history_item_id: string;
  voice_id: string;
  voice_name: string;
  voice_category?: string;
  text: string;
  date_unix: number;
  character_count_change_from: number;
  character_count_change_to: number;
  content_type: string;
  state: string;
}

export type ElevenLabsToolOperation =
  | "voice-listing"
  | "voice-read"
  | "text-to-speech"
  | "model-listing"
  | "history-listing";

type ElevenLabsToolCostTier = "paid" | "paid_or_unknown";

interface ElevenLabsToolDecisionInput {
  path_id: string;
  model: string;
  allow_paid?: boolean;
}

export interface ElevenLabsToolDecision {
  allowed: boolean;
  path_id: string;
  provider: "ElevenLabs";
  model: string;
  cost_tier: ElevenLabsToolCostTier;
  default_allowed: false;
  reason: "explicit_paid_allowed" | "paid_or_unknown_blocked";
  allow_paid_flag: "api_key argument";
}

// ─── Spend guard ──────────────────────────────────────────────────────────────

const ELEVENLABS_TOOL_PATH_IDS: Record<ElevenLabsToolOperation, string> = {
  "voice-listing": "mcp.elevenlabs.tool.voice-listing",
  "voice-read": "mcp.elevenlabs.tool.voice-read",
  "text-to-speech": "mcp.elevenlabs.tool.text-to-speech",
  "model-listing": "mcp.elevenlabs.tool.model-listing",
  "history-listing": "mcp.elevenlabs.tool.history-listing",
};

const ELEVENLABS_TOOL_OPERATION_BY_PATH_ID: Record<string, ElevenLabsToolOperation> =
  Object.fromEntries(
    Object.entries(ELEVENLABS_TOOL_PATH_IDS).map(([operation, pathId]) => [pathId, operation]),
  ) as Record<string, ElevenLabsToolOperation>;

const ELEVENLABS_TOOL_COST_TIERS: Record<ElevenLabsToolOperation, ElevenLabsToolCostTier> = {
  "voice-listing": "paid_or_unknown",
  "voice-read": "paid_or_unknown",
  "text-to-speech": "paid",
  "model-listing": "paid_or_unknown",
  "history-listing": "paid_or_unknown",
};

function decideAiProviderCall(input: ElevenLabsToolDecisionInput): ElevenLabsToolDecision {
  const operation = ELEVENLABS_TOOL_OPERATION_BY_PATH_ID[input.path_id];
  const allowed = input.allow_paid === true;

  return {
    allowed,
    path_id: input.path_id,
    provider: "ElevenLabs",
    model: input.model,
    cost_tier: operation ? ELEVENLABS_TOOL_COST_TIERS[operation] : "paid_or_unknown",
    default_allowed: false,
    reason: allowed ? "explicit_paid_allowed" : "paid_or_unknown_blocked",
    allow_paid_flag: "api_key argument",
  };
}

export function decideElevenLabsToolProviderCall(
  operation: ElevenLabsToolOperation,
  model: string,
  apiKey: string,
): ElevenLabsToolDecision {
  return decideAiProviderCall({
    path_id: ELEVENLABS_TOOL_PATH_IDS[operation],
    model,
    allow_paid: Boolean(apiKey),
  });
}

function requireElevenLabsSpendAllowed(operation: ElevenLabsToolOperation, model: string, apiKey: string): void {
  const decision = decideElevenLabsToolProviderCall(operation, model, apiKey);
  if (!decision.allowed) {
    throw new Error(`AI spend guard blocked ${decision.path_id}: ${decision.allow_paid_flag} is required.`);
  }
}

// ─── Auth validation ──────────────────────────────────────────────────────────

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? "").trim();
  if (!key) throw new Error("api_key is required. Get one at elevenlabs.io.");
  return key;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function elGet<T>(apiKey: string, path: string): Promise<T> {
  const res = await fetch(`${EL_API_BASE}${path}`, {
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const detail = data.detail as Record<string, unknown> | string | undefined;
    const msg = typeof detail === "object" ? (detail?.message ?? JSON.stringify(detail)) : detail;
    throw new Error(`ElevenLabs error (${res.status}): ${msg ?? `HTTP ${res.status}`}`);
  }
  return data as T;
}

async function elPost<T>(apiKey: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${EL_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json() as Record<string, unknown>;
      const detail = data.detail as Record<string, unknown> | string | undefined;
      msg = typeof detail === "object" ? String(detail?.message ?? JSON.stringify(detail)) : (detail ?? msg);
    } catch { /* ignore parse errors */ }
    throw new Error(`ElevenLabs error (${res.status}): ${msg}`);
  }

  // text-to-speech returns audio binary
  return res as unknown as T;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function elevenlabsListVoices(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  requireElevenLabsSpendAllowed("voice-listing", "ElevenLabs /voices", apiKey);
  const data = await elGet<{ voices: ElVoice[] }>(apiKey, "/voices");

  return {
    count: data.voices.length,
    voices: data.voices.map((v) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category,
      description: v.description ?? null,
      labels: v.labels ?? {},
      preview_url: v.preview_url ?? null,
    })),
  };
}

export async function elevenlabsGetVoice(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const voiceId = String(args.voice_id ?? "").trim();
  if (!voiceId) throw new Error("voice_id is required.");

  const withSettings = args.with_settings === true;
  requireElevenLabsSpendAllowed("voice-read", "ElevenLabs /voices/{voice_id}", apiKey);
  const path = `/voices/${encodeURIComponent(voiceId)}${withSettings ? "?with_settings=true" : ""}`;
  const voice = await elGet<ElVoice & { settings?: ElVoiceSettings }>(apiKey, path);

  return {
    voice_id: voice.voice_id,
    name: voice.name,
    category: voice.category,
    description: voice.description ?? null,
    labels: voice.labels ?? {},
    preview_url: voice.preview_url ?? null,
    settings: voice.settings ?? null,
  };
}

export async function elevenlabsTextToSpeech(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const voiceId = String(args.voice_id ?? "").trim();
  const text = String(args.text ?? "").trim();
  if (!voiceId) throw new Error("voice_id is required.");
  if (!text) throw new Error("text is required.");
  if (text.length > 5000) throw new Error("text must be 5000 characters or fewer.");

  const modelId = String(args.model_id ?? "eleven_monolingual_v1");
  const outputFormat = String(args.output_format ?? "mp3_44100_128");
  requireElevenLabsSpendAllowed("text-to-speech", modelId, apiKey);

  const voiceSettings: ElVoiceSettings = {
    stability: Math.min(1, Math.max(0, Number(args.stability ?? 0.5))),
    similarity_boost: Math.min(1, Math.max(0, Number(args.similarity_boost ?? 0.75))),
  };
  if (args.style !== undefined) voiceSettings.style = Math.min(1, Math.max(0, Number(args.style)));
  if (args.use_speaker_boost !== undefined) voiceSettings.use_speaker_boost = Boolean(args.use_speaker_boost);

  const path = `/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`;
  const res = await elPost<Response>(apiKey, path, {
    text,
    model_id: modelId,
    voice_settings: voiceSettings,
  });

  // Return audio as base64 for transport over JSON
  const audioBuffer = await (res as unknown as Response).arrayBuffer();
  const base64 = Buffer.from(audioBuffer).toString("base64");
  const contentType = (res as unknown as Response).headers?.get("content-type") ?? "audio/mpeg";

  return {
    success: true,
    voice_id: voiceId,
    model_id: modelId,
    output_format: outputFormat,
    character_count: text.length,
    content_type: contentType,
    audio_base64: base64,
    note: "Decode audio_base64 and write as binary to play the audio file.",
  };
}

export async function elevenlabsGetModels(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  requireElevenLabsSpendAllowed("model-listing", "ElevenLabs /models", apiKey);
  const models = await elGet<ElModel[]>(apiKey, "/models");

  return {
    count: models.length,
    models: models.map((m) => ({
      model_id: m.model_id,
      name: m.name,
      description: m.description ?? null,
      can_do_text_to_speech: m.can_do_text_to_speech,
      can_do_voice_conversion: m.can_do_voice_conversion,
      languages: m.languages.map((l) => ({ id: l.language_id, name: l.name })),
    })),
  };
}

export async function elevenlabsGetHistory(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  requireElevenLabsSpendAllowed("history-listing", "ElevenLabs /history", apiKey);
  const pageSize = Math.min(1000, Math.max(1, Number(args.page_size ?? 30)));
  const params = new URLSearchParams({ page_size: String(pageSize) });
  if (args.start_after_history_item_id) {
    params.set("start_after_history_item_id", String(args.start_after_history_item_id));
  }
  if (args.voice_id) {
    params.set("voice_id", String(args.voice_id));
  }

  const data = await elGet<{ history: ElHistoryItem[]; last_history_item_id?: string; has_more: boolean }>(
    apiKey, `/history?${params.toString()}`
  );

  return {
    count: data.history.length,
    has_more: data.has_more,
    last_history_item_id: data.last_history_item_id ?? null,
    items: data.history.map((h) => ({
      history_item_id: h.history_item_id,
      voice_id: h.voice_id,
      voice_name: h.voice_name,
      text: h.text,
      date: new Date(h.date_unix * 1000).toISOString(),
      character_count: h.character_count_change_to - h.character_count_change_from,
      state: h.state,
    })),
  };
}
