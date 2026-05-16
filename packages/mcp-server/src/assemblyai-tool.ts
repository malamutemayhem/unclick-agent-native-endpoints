// AssemblyAI Speech-to-Text API integration for the UnClick MCP server.
// Uses the AssemblyAI REST API via fetch - no external dependencies.
// Users must supply an API key from assemblyai.com.

const AAI_BASE = "https://api.assemblyai.com/v2";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssemblyAiToolOperation =
  | "transcribe"
  | "transcript-read"
  | "transcript-list"
  | "sentences"
  | "paragraphs"
  | "summary";

type AssemblyAiToolCostTier = "paid" | "paid_or_unknown";

interface AssemblyAiToolDecisionInput {
  path_id: string;
  model: string;
  allow_paid?: boolean;
}

export interface AssemblyAiToolDecision {
  allowed: boolean;
  path_id: string;
  provider: "AssemblyAI";
  model: string;
  cost_tier: AssemblyAiToolCostTier;
  default_allowed: false;
  reason: "explicit_paid_allowed" | "paid_or_unknown_blocked";
  allow_paid_flag: "api_key argument";
}

// ─── Spend guard ──────────────────────────────────────────────────────────────

const ASSEMBLYAI_TOOL_PATH_IDS: Record<AssemblyAiToolOperation, string> = {
  transcribe: "mcp.assemblyai.tool.transcribe",
  "transcript-read": "mcp.assemblyai.tool.transcript-read",
  "transcript-list": "mcp.assemblyai.tool.transcript-list",
  sentences: "mcp.assemblyai.tool.sentences",
  paragraphs: "mcp.assemblyai.tool.paragraphs",
  summary: "mcp.assemblyai.tool.summary",
};

const ASSEMBLYAI_TOOL_OPERATION_BY_PATH_ID: Record<string, AssemblyAiToolOperation> =
  Object.fromEntries(
    Object.entries(ASSEMBLYAI_TOOL_PATH_IDS).map(([operation, pathId]) => [pathId, operation]),
  ) as Record<string, AssemblyAiToolOperation>;

const ASSEMBLYAI_TOOL_COST_TIERS: Record<AssemblyAiToolOperation, AssemblyAiToolCostTier> = {
  transcribe: "paid",
  "transcript-read": "paid_or_unknown",
  "transcript-list": "paid_or_unknown",
  sentences: "paid_or_unknown",
  paragraphs: "paid_or_unknown",
  summary: "paid_or_unknown",
};

function decideAiProviderCall(input: AssemblyAiToolDecisionInput): AssemblyAiToolDecision {
  const operation = ASSEMBLYAI_TOOL_OPERATION_BY_PATH_ID[input.path_id];
  const allowed = input.allow_paid === true;

  return {
    allowed,
    path_id: input.path_id,
    provider: "AssemblyAI",
    model: input.model,
    cost_tier: operation ? ASSEMBLYAI_TOOL_COST_TIERS[operation] : "paid_or_unknown",
    default_allowed: false,
    reason: allowed ? "explicit_paid_allowed" : "paid_or_unknown_blocked",
    allow_paid_flag: "api_key argument",
  };
}

export function decideAssemblyAiToolProviderCall(
  operation: AssemblyAiToolOperation,
  model: string,
  apiKey: string,
): AssemblyAiToolDecision {
  return decideAiProviderCall({
    path_id: ASSEMBLYAI_TOOL_PATH_IDS[operation],
    model,
    allow_paid: Boolean(apiKey),
  });
}

function requireAssemblyAiSpendAllowed(operation: AssemblyAiToolOperation, model: string, apiKey: string): void {
  const decision = decideAssemblyAiToolProviderCall(operation, model, apiKey);
  if (!decision.allowed) {
    throw new Error(`AI spend guard blocked ${decision.path_id}: ${decision.allow_paid_flag} is required.`);
  }
}

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
  requireAssemblyAiSpendAllowed("transcribe", "AssemblyAI transcript", apiKey);

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
  requireAssemblyAiSpendAllowed("transcript-read", "AssemblyAI transcript read", apiKey);
  return aaiGet(apiKey, `/transcript/${encodeURIComponent(id)}`);
}

export async function assemblyaiListTranscripts(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  requireAssemblyAiSpendAllowed("transcript-list", "AssemblyAI transcript list", apiKey);
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
  requireAssemblyAiSpendAllowed("sentences", "AssemblyAI transcript sentences", apiKey);
  const data = await aaiGet<{ sentences: unknown[] }>(apiKey, `/transcript/${encodeURIComponent(id)}/sentences`);
  return { transcript_id: id, count: data.sentences?.length ?? 0, sentences: data.sentences ?? [] };
}

export async function assemblyaiGetParagraphs(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const id = String(args.transcript_id ?? "").trim();
  if (!id) throw new Error("transcript_id is required.");
  requireAssemblyAiSpendAllowed("paragraphs", "AssemblyAI transcript paragraphs", apiKey);
  const data = await aaiGet<{ paragraphs: unknown[] }>(apiKey, `/transcript/${encodeURIComponent(id)}/paragraphs`);
  return { transcript_id: id, count: data.paragraphs?.length ?? 0, paragraphs: data.paragraphs ?? [] };
}

export async function assemblyaiSummarize(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const id = String(args.transcript_id ?? "").trim();
  if (!id) throw new Error("transcript_id is required (transcript must already be completed with summarization enabled).");
  requireAssemblyAiSpendAllowed("summary", "AssemblyAI transcript summary", apiKey);
  const data = await aaiGet<{ summary?: string; status: string; error?: string }>(apiKey, `/transcript/${encodeURIComponent(id)}`);
  if (data.error) throw new Error(`Transcript error: ${data.error}`);
  if (data.status !== "completed") return { transcript_id: id, status: data.status, note: "Transcript not yet completed. Poll get_transcript until status is completed." };
  return { transcript_id: id, status: data.status, summary: data.summary ?? null };
}
