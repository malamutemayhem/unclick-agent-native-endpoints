// Replicate API integration for the UnClick MCP server.
// Uses the Replicate REST API via fetch - no external dependencies.
// Users must supply an API token from replicate.com/account/api-tokens.

const REPLICATE_API_BASE = "https://api.replicate.com/v1";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReplicateModel {
  url: string;
  owner: string;
  name: string;
  description: string;
  visibility: string;
  github_url: string | null;
  paper_url: string | null;
  license_url: string | null;
  latest_version?: ReplicateVersion;
}

interface ReplicateVersion {
  id: string;
  created_at: string;
  cog_version: string | null;
  openapi_schema: Record<string, unknown> | null;
}

interface ReplicatePrediction {
  id: string;
  version: string | null;
  model?: string;
  urls: { get: string; cancel: string };
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  input: Record<string, unknown>;
  output: unknown;
  error: string | null;
  logs: string | null;
  metrics?: { predict_time?: number };
}

// ─── Auth validation ──────────────────────────────────────────────────────────

function requireToken(args: Record<string, unknown>): string {
  const token = String(args.api_token ?? "").trim();
  if (!token) throw new Error("api_token is required. Get one at replicate.com/account/api-tokens.");
  return token;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function replicateGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${REPLICATE_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const detail = (data.detail as string) ?? `HTTP ${res.status}`;
    throw new Error(`Replicate error (${res.status}): ${detail}`);
  }
  return data as T;
}

async function replicatePost<T>(token: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${REPLICATE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const detail = (data.detail as string) ?? `HTTP ${res.status}`;
    throw new Error(`Replicate error (${res.status}): ${detail}`);
  }
  return data as T;
}

// ─── Prediction normalizer ────────────────────────────────────────────────────

function normalizePrediction(p: ReplicatePrediction) {
  return {
    id: p.id,
    version: p.version ?? null,
    model: p.model ?? null,
    status: p.status,
    created_at: p.created_at,
    started_at: p.started_at ?? null,
    completed_at: p.completed_at ?? null,
    input: p.input,
    output: p.output ?? null,
    error: p.error ?? null,
    logs: p.logs ?? null,
    predict_time_seconds: p.metrics?.predict_time ?? null,
    get_url: p.urls.get,
  };
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function replicateListModels(args: Record<string, unknown>): Promise<unknown> {
  const token = requireToken(args);
  const cursor = args.cursor ? `?cursor=${encodeURIComponent(String(args.cursor))}` : "";
  const data = await replicateGet<{ results: ReplicateModel[]; next?: string; previous?: string }>(
    token, `/models${cursor}`
  );

  return {
    count: data.results.length,
    next_cursor: data.next ?? null,
    models: data.results.map((m) => ({
      owner: m.owner,
      name: m.name,
      description: m.description,
      visibility: m.visibility,
      url: m.url,
      latest_version_id: m.latest_version?.id ?? null,
    })),
  };
}

export async function replicateGetModel(args: Record<string, unknown>): Promise<unknown> {
  const token = requireToken(args);
  const owner = String(args.owner ?? "").trim();
  const name = String(args.model_name ?? "").trim();
  if (!owner) throw new Error("owner is required (the model owner's username).");
  if (!name) throw new Error("model_name is required.");

  const model = await replicateGet<ReplicateModel>(token, `/models/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`);
  return {
    owner: model.owner,
    name: model.name,
    description: model.description,
    visibility: model.visibility,
    url: model.url,
    github_url: model.github_url,
    paper_url: model.paper_url,
    license_url: model.license_url,
    latest_version: model.latest_version ? {
      id: model.latest_version.id,
      created_at: model.latest_version.created_at,
    } : null,
  };
}

export async function replicateCreatePrediction(args: Record<string, unknown>): Promise<unknown> {
  const token = requireToken(args);

  let input: Record<string, unknown>;
  if (typeof args.input === "string") {
    try { input = JSON.parse(args.input); }
    catch { throw new Error("input must be valid JSON (an object of model-specific parameters)."); }
  } else if (args.input && typeof args.input === "object") {
    input = args.input as Record<string, unknown>;
  } else {
    throw new Error("input is required (object of model-specific parameters).");
  }

  const body: Record<string, unknown> = { input };

  const version = String(args.version ?? "").trim();
  const model = String(args.model ?? "").trim();

  if (version) {
    body.version = version;
  } else if (model) {
    // model format: owner/name or owner/name:version
    body.model = model;
  } else {
    throw new Error("Either version (version ID) or model (owner/name) is required.");
  }

  if (args.webhook) body.webhook = String(args.webhook);
  if (args.webhook_events_filter) body.webhook_events_filter = args.webhook_events_filter;
  if (args.stream === true) body.stream = true;

  const prediction = await replicatePost<ReplicatePrediction>(token, "/predictions", body);
  return normalizePrediction(prediction);
}

export async function replicateGetPrediction(args: Record<string, unknown>): Promise<unknown> {
  const token = requireToken(args);
  const predictionId = String(args.prediction_id ?? "").trim();
  if (!predictionId) throw new Error("prediction_id is required.");

  const prediction = await replicateGet<ReplicatePrediction>(token, `/predictions/${encodeURIComponent(predictionId)}`);
  return normalizePrediction(prediction);
}

export async function replicateListPredictions(args: Record<string, unknown>): Promise<unknown> {
  const token = requireToken(args);
  const cursor = args.cursor ? `?cursor=${encodeURIComponent(String(args.cursor))}` : "";
  const data = await replicateGet<{ results: ReplicatePrediction[]; next?: string; previous?: string }>(
    token, `/predictions${cursor}`
  );

  return {
    count: data.results.length,
    next_cursor: data.next ?? null,
    predictions: data.results.map(normalizePrediction),
  };
}

export async function replicateCancelPrediction(args: Record<string, unknown>): Promise<unknown> {
  const token = requireToken(args);
  const predictionId = String(args.prediction_id ?? "").trim();
  if (!predictionId) throw new Error("prediction_id is required.");

  const prediction = await replicatePost<ReplicatePrediction>(
    token, `/predictions/${encodeURIComponent(predictionId)}/cancel`, {}
  );
  return {
    success: true,
    prediction_id: prediction.id,
    status: prediction.status,
  };
}
