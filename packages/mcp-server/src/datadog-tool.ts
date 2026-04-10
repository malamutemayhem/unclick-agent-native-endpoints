// Datadog API integration for the UnClick MCP server.
// Uses the Datadog REST API via fetch - no external dependencies.
// Users must supply DD-API-KEY and DD-APPLICATION-KEY from app.datadoghq.com.

const DD_BASE = "https://api.datadoghq.com/api/v1";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireKeys(args: Record<string, unknown>): { apiKey: string; appKey: string } {
  const apiKey = String(args.api_key ?? "").trim();
  const appKey = String(args.app_key ?? "").trim();
  if (!apiKey) throw new Error("api_key is required (DD-API-KEY from app.datadoghq.com/organization-settings/api-keys).");
  if (!appKey) throw new Error("app_key is required (DD-APPLICATION-KEY from app.datadoghq.com/organization-settings/application-keys).");
  return { apiKey, appKey };
}

async function ddGet<T>(apiKey: string, appKey: string, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${DD_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { "DD-API-KEY": apiKey, "DD-APPLICATION-KEY": appKey },
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.errors as string[])?.join(", ") ?? (data.error as string) ?? `HTTP ${res.status}`;
    throw new Error(`Datadog error (${res.status}): ${msg}`);
  }
  return data as T;
}

async function ddPost<T>(apiKey: string, appKey: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${DD_BASE}${path}`, {
    method: "POST",
    headers: {
      "DD-API-KEY": apiKey,
      "DD-APPLICATION-KEY": appKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.errors as string[])?.join(", ") ?? (data.error as string) ?? `HTTP ${res.status}`;
    throw new Error(`Datadog error (${res.status}): ${msg}`);
  }
  return data as T;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function datadogListMonitors(args: Record<string, unknown>): Promise<unknown> {
  const { apiKey, appKey } = requireKeys(args);
  const params: Record<string, string> = {};
  if (args.name) params.name = String(args.name);
  if (args.tags) params.monitor_tags = String(args.tags);
  if (args.page) params.page = String(args.page);
  if (args.page_size) params.page_size = String(Math.min(1000, Number(args.page_size)));
  const data = await ddGet<unknown[]>(apiKey, appKey, "/monitor", params);
  return { count: Array.isArray(data) ? data.length : 0, monitors: data };
}

export async function datadogGetMonitor(args: Record<string, unknown>): Promise<unknown> {
  const { apiKey, appKey } = requireKeys(args);
  const id = String(args.monitor_id ?? "").trim();
  if (!id) throw new Error("monitor_id is required.");
  return ddGet(apiKey, appKey, `/monitor/${encodeURIComponent(id)}`);
}

export async function datadogCreateMonitor(args: Record<string, unknown>): Promise<unknown> {
  const { apiKey, appKey } = requireKeys(args);
  const type = String(args.type ?? "metric alert");
  const query = String(args.query ?? "").trim();
  const name  = String(args.name ?? "").trim();
  if (!query) throw new Error("query is required (monitor query expression).");
  if (!name)  throw new Error("name is required.");

  const body: Record<string, unknown> = { type, query, name };
  if (args.message)  body.message  = String(args.message);
  if (args.tags)     body.tags     = Array.isArray(args.tags) ? args.tags : [String(args.tags)];
  if (args.priority) body.priority = Number(args.priority);
  if (args.options)  body.options  = args.options;

  return ddPost(apiKey, appKey, "/monitor", body);
}

export async function datadogListDashboards(args: Record<string, unknown>): Promise<unknown> {
  const { apiKey, appKey } = requireKeys(args);
  const params: Record<string, string> = {};
  if (args.filter_shared !== undefined) params.filter_shared = String(args.filter_shared);
  const data = await ddGet<{ dashboards: unknown[] }>(apiKey, appKey, "/dashboard", params);
  return { count: data.dashboards?.length ?? 0, dashboards: data.dashboards ?? [] };
}

export async function datadogQueryMetrics(args: Record<string, unknown>): Promise<unknown> {
  const { apiKey, appKey } = requireKeys(args);
  const query = String(args.query ?? "").trim();
  if (!query) throw new Error("query is required (Datadog metric query e.g. avg:system.cpu.user{*}).");

  const now  = Math.floor(Date.now() / 1000);
  const from = Number(args.from ?? (now - 3600));
  const to   = Number(args.to ?? now);

  return ddGet(apiKey, appKey, "/query", { query, from: String(from), to: String(to) });
}

export async function datadogListEvents(args: Record<string, unknown>): Promise<unknown> {
  const { apiKey, appKey } = requireKeys(args);
  const now   = Math.floor(Date.now() / 1000);
  const start = Number(args.start ?? (now - 3600));
  const end   = Number(args.end ?? now);

  const params: Record<string, string> = { start: String(start), end: String(end) };
  if (args.priority) params.priority = String(args.priority);
  if (args.sources)  params.sources  = String(args.sources);
  if (args.tags)     params.tags     = String(args.tags);

  const data = await ddGet<{ events: unknown[] }>(apiKey, appKey, "/events", params);
  return { count: data.events?.length ?? 0, events: data.events ?? [] };
}
