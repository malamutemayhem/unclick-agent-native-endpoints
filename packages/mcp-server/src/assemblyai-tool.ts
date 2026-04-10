// AssemblyAI Speech-to-Text API integration for the UnClick MCP server.
// Uses the AssemblyAI REST API via fetch - no external dependencies.
// Users must supply an API key from assemblyai.com.

const AAI_BASE = "https://api.assemblyai.com/v2";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? "").trim();
  if (!key) throw new Error("api_key is required. Get one at assemblyai.com/dashboard.");
  return key;
}

async function aaiGet<T>(apiKey: string, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${AAI_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.error as string) ?? `HTTP ${res.status}`;
    throw new Error(`AssemblyAI error (${res.status}): ${msg}`);
  }
  return data as T;
}

async function aaiPost<T>(apiKey: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${AAI_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.error as string) ?? `HTTP ${res.status}`;
    throw new Error(`AssemblyAI error (${res.status}): ${msg}`);
  }
  return data as T;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function assemblyaiTranscribe(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const audioUrl = String(args.audio_url ?? "").trim();
  if (!audioUrl) throw new Error("audio_url is required (publicly accessible URL of the audio/video file).");

  const body: Record<string, unknown> = { audio_url: audioUrl };
  if (args.language_code)         body.language_code         = String(args.language_code);
  if (args.language_detection !== undefined) body.language_detection = Boolean(args.language_detection);
  if (args.punctuate !== undefined)          body.punctuate          = Boolean(args.punctuate);
  if (args.format_text !== undefined)        body.format_text        = Boolean(args.format_text);
  if (args.dual_channel !== undefined)       body.dual_channel       = Boolean(args.dual_channel);
  if (args.speaker_labels !== undefined)     body.speaker_labels     = Boolean(args.speaker_labels);
  if (args.auto_chapters !== undefined)      body.auto_chapters      = Boolean(args.auto_chapters);
  if (args.entity_detection !== undefined)   body.entity_detection   = Boolean(args.entity_detection);
  if (args.sentiment_analysis !== undefined) body.sentiment_analysis = Boolean(args.sentiment_analysis);
  if (args.summarization !== undefined)      body.summarization      = Boolean(args.summarization);
  if (args.summary_model)         body.summary_model         = String(args.summary_model);
  if (args.summary_type)          body.summary_type          = String(args.summary_type);
  if (args.webhook_url)           body.webhook_url           = String(args.webhook_url);

  const data = await aaiPost<{ id: string; status: string }>(apiKey, "/transcript", body);
  return {
    transcript_id: data.id,
    status: data.status,
    note: "Use get_transcript with the transcript_id to poll for completion.",
  };
}

export async function assemblyaiGetTranscript(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const id = String(args.transcript_id ?? "").trim();
  if (!id) throw new Error("transcript_id is required.");
  return aaiGet(apiKey, `/transcript/${encodeURIComponent(id)}`);
}

export async function assemblyaiListTranscripts(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const params: Record<string, string> = {};
  if (args.limit)  params.limit  = String(Math.min(200, Math.max(1, Number(args.limit ?? 10))));
  if (args.status) params.status = String(args.status);
  if (args.after_id)  params.after_id  = String(args.after_id);
  if (args.before_id) params.before_id = String(args.before_id);
  return aaiGet(apiKey, "/transcript", params);
}

export async function assemblyaiGetSentences(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const id = String(args.transcript_id ?? "").trim();
  if (!id) throw new Error("transcript_id is required.");
  const data = await aaiGet<{ sentences: unknown[] }>(apiKey, `/transcript/${encodeURIComponent(id)}/sentences`);
  return { transcript_id: id, count: data.sentences?.length ?? 0, sentences: data.sentences ?? [] };
}

export async function assemblyaiGetParagraphs(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const id = String(args.transcript_id ?? "").trim();
  if (!id) throw new Error("transcript_id is required.");
  const data = await aaiGet<{ paragraphs: unknown[] }>(apiKey, `/transcript/${encodeURIComponent(id)}/paragraphs`);
  return { transcript_id: id, count: data.paragraphs?.length ?? 0, paragraphs: data.paragraphs ?? [] };
}

export async function assemblyaiSummarize(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const id = String(args.transcript_id ?? "").trim();
  if (!id) throw new Error("transcript_id is required (transcript must already be completed with summarization enabled).");
  const data = await aaiGet<{ summary?: string; status: string; error?: string }>(apiKey, `/transcript/${encodeURIComponent(id)}`);
  if (data.error) throw new Error(`Transcript error: ${data.error}`);
  if (data.status !== "completed") return { transcript_id: id, status: data.status, note: "Transcript not yet completed. Poll get_transcript until status is completed." };
  return { transcript_id: id, status: data.status, summary: data.summary ?? null };
}
