// Render hosting API integration for the UnClick MCP server.
// Uses the Render REST API via fetch - no external dependencies.
// Users must supply an API key from dashboard.render.com/u/{user}/account/api-keys.

const RENDER_API_BASE = "https://api.render.com/v1";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RenderService {
  id: string;
  name: string;
  type: string;
  status: string;
  serviceDetails: unknown;
  createdAt: string;
  updatedAt: string;
}

interface RenderDeploy {
  id: string;
  status: string;
  trigger: string;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function renderFetch(
  apiKey: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  query?: Record<string, string | number | boolean | undefined>
): Promise<unknown> {
  const url = new URL(`${RENDER_API_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    return { error: `Network error reaching Render API: ${err instanceof Error ? err.message : String(err)}` };
  }

  // 204 No Content
  if (response.status === 204) return { success: true };

  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (response.status === 401) return { error: "Render API key is invalid or expired. Check your api_key.", status: 401 };
  if (response.status === 403) return { error: "Render API: insufficient permissions.", status: 403 };
  if (response.status === 404) return { error: "Resource not found. Check the service_id.", status: 404 };

  if (!response.ok) {
    const errData = data as Record<string, unknown>;
    const detail = errData?.message ?? errData?.id ?? text;
    return { error: `Render API error ${response.status}: ${detail}`, status: response.status };
  }

  return data;
}

// ── Operations ────────────────────────────────────────────────────────────────

export async function renderListServices(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = String(args.api_key ?? process.env.RENDER_API_KEY ?? "").trim();
  if (!apiKey) return { error: "api_key is required. Get one at dashboard.render.com." };

  try {
    const query: Record<string, string | number | undefined> = {
      limit: args.limit ? Number(args.limit) : 20,
    };
    if (args.cursor) query.cursor = String(args.cursor);
    if (args.type) query.type = String(args.type);

    return renderFetch(apiKey, "GET", "/services", undefined, query);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function renderGetService(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = String(args.api_key ?? process.env.RENDER_API_KEY ?? "").trim();
  if (!apiKey) return { error: "api_key is required. Get one at dashboard.render.com." };
  const serviceId = String(args.service_id ?? "").trim();
  if (!serviceId) return { error: "service_id is required." };

  try {
    return renderFetch(apiKey, "GET", `/services/${encodeURIComponent(serviceId)}`);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function renderListDeploys(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = String(args.api_key ?? process.env.RENDER_API_KEY ?? "").trim();
  if (!apiKey) return { error: "api_key is required. Get one at dashboard.render.com." };
  const serviceId = String(args.service_id ?? "").trim();
  if (!serviceId) return { error: "service_id is required." };

  try {
    const query: Record<string, string | number | undefined> = {};
    if (args.limit) query.limit = Number(args.limit);

    return renderFetch(apiKey, "GET", `/services/${encodeURIComponent(serviceId)}/deploys`, undefined, query);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function renderTriggerDeploy(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = String(args.api_key ?? process.env.RENDER_API_KEY ?? "").trim();
  if (!apiKey) return { error: "api_key is required. Get one at dashboard.render.com." };
  const serviceId = String(args.service_id ?? "").trim();
  if (!serviceId) return { error: "service_id is required." };

  try {
    const body: Record<string, unknown> = {};
    if (args.clear_cache !== undefined) body.clearCache = Boolean(args.clear_cache);

    return renderFetch(apiKey, "POST", `/services/${encodeURIComponent(serviceId)}/deploys`, body);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function renderListEnvVars(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = String(args.api_key ?? process.env.RENDER_API_KEY ?? "").trim();
  if (!apiKey) return { error: "api_key is required. Get one at dashboard.render.com." };
  const serviceId = String(args.service_id ?? "").trim();
  if (!serviceId) return { error: "service_id is required." };

  try {
    return renderFetch(apiKey, "GET", `/services/${encodeURIComponent(serviceId)}/env-vars`);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function renderSetEnvVar(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = String(args.api_key ?? process.env.RENDER_API_KEY ?? "").trim();
  if (!apiKey) return { error: "api_key is required. Get one at dashboard.render.com." };
  const serviceId = String(args.service_id ?? "").trim();
  if (!serviceId) return { error: "service_id is required." };
  const key = String(args.key ?? "").trim();
  if (!key) return { error: "key is required (the environment variable name)." };
  if (args.value === undefined || args.value === null) return { error: "value is required." };
  const value = String(args.value);

  try {
    // Render PUT env-vars expects an array of {key, value} pairs
    const body = [{ key, value }];
    return renderFetch(apiKey, "PUT", `/services/${encodeURIComponent(serviceId)}/env-vars`, body);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
