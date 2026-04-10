// Mixpanel API integration for the UnClick MCP server.
// Uses the Mixpanel REST API via fetch - no external dependencies.
// Users must supply a Service Account username and secret from mixpanel.com/settings/service-accounts.

const MP_INGEST = "https://api.mixpanel.com";
const MP_QUERY  = "https://data.mixpanel.com/api/2.0";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireCreds(args: Record<string, unknown>): { username: string; secret: string; projectId: string } {
  const username  = String(args.service_account_username ?? "").trim();
  const secret    = String(args.service_account_secret ?? "").trim();
  const projectId = String(args.project_id ?? "").trim();
  if (!username) throw new Error("service_account_username is required (from mixpanel.com/settings/service-accounts).");
  if (!secret)   throw new Error("service_account_secret is required.");
  if (!projectId) throw new Error("project_id is required (numeric Mixpanel project ID).");
  return { username, secret, projectId };
}

function basicAuth(username: string, secret: string): string {
  return `Basic ${Buffer.from(`${username}:${secret}`).toString("base64")}`;
}

async function mpGet<T>(username: string, secret: string, baseUrl: string, path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${baseUrl}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: basicAuth(username, secret) },
  });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    const msg = typeof data === "object" && data !== null ? ((data as Record<string, unknown>).error as string ?? JSON.stringify(data)) : String(data);
    throw new Error(`Mixpanel error (${res.status}): ${msg}`);
  }
  return data as T;
}

async function mpPost<T>(username: string, secret: string, baseUrl: string, path: string, body: Record<string, string>): Promise<T> {
  const form = new URLSearchParams(body);
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(username, secret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    const msg = typeof data === "object" && data !== null ? ((data as Record<string, unknown>).error as string ?? JSON.stringify(data)) : String(data);
    throw new Error(`Mixpanel error (${res.status}): ${msg}`);
  }
  return data as T;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function mixpanelTrackEvent(args: Record<string, unknown>): Promise<unknown> {
  const { username, secret } = requireCreds(args);
  const event = String(args.event ?? "").trim();
  if (!event) throw new Error("event is required (event name to track).");

  const properties: Record<string, unknown> = {
    token: String(args.token ?? ""),
    distinct_id: String(args.distinct_id ?? "anonymous"),
    time: Math.floor(Date.now() / 1000),
    ...(args.properties as Record<string, unknown> ?? {}),
  };

  const data = JSON.stringify([{ event, properties }]);
  const encoded = Buffer.from(data).toString("base64");
  return mpPost(username, secret, MP_INGEST, "/track", { data: encoded });
}

export async function mixpanelGetEvents(args: Record<string, unknown>): Promise<unknown> {
  const { username, secret, projectId } = requireCreds(args);
  const fromDate = String(args.from_date ?? new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]);
  const toDate   = String(args.to_date ?? new Date().toISOString().split("T")[0]);

  const params: Record<string, string> = {
    project_id: projectId,
    from_date: fromDate,
    to_date: toDate,
    unit: String(args.unit ?? "day"),
    type: String(args.type ?? "general"),
  };
  if (args.event) params.event = JSON.stringify(Array.isArray(args.event) ? args.event : [String(args.event)]);

  return mpGet(username, secret, MP_QUERY, "/events", params);
}

export async function mixpanelGetFunnels(args: Record<string, unknown>): Promise<unknown> {
  const { username, secret, projectId } = requireCreds(args);
  const funnelId = String(args.funnel_id ?? "").trim();
  if (!funnelId) throw new Error("funnel_id is required.");
  const fromDate = String(args.from_date ?? new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]);
  const toDate   = String(args.to_date ?? new Date().toISOString().split("T")[0]);

  return mpGet(username, secret, MP_QUERY, "/funnels", {
    project_id: projectId,
    funnel_id: funnelId,
    from_date: fromDate,
    to_date: toDate,
    unit: String(args.unit ?? "day"),
  });
}

export async function mixpanelGetRetention(args: Record<string, unknown>): Promise<unknown> {
  const { username, secret, projectId } = requireCreds(args);
  const fromDate = String(args.from_date ?? new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]);
  const toDate   = String(args.to_date ?? new Date().toISOString().split("T")[0]);

  const params: Record<string, string> = {
    project_id: projectId,
    from_date: fromDate,
    to_date: toDate,
    retention_type: String(args.retention_type ?? "birth"),
    unit: String(args.unit ?? "day"),
  };
  if (args.born_event) params.born_event = String(args.born_event);
  if (args.event) params.event = String(args.event);

  return mpGet(username, secret, MP_QUERY, "/retention", params);
}

export async function mixpanelExportData(args: Record<string, unknown>): Promise<unknown> {
  const { username, secret, projectId } = requireCreds(args);
  const fromDate = String(args.from_date ?? new Date(Date.now() - 1 * 86400000).toISOString().split("T")[0]);
  const toDate   = String(args.to_date ?? new Date().toISOString().split("T")[0]);

  const params: Record<string, string> = {
    project_id: projectId,
    from_date: fromDate,
    to_date: toDate,
  };
  if (args.event) params.event = JSON.stringify(Array.isArray(args.event) ? args.event : [String(args.event)]);
  if (args.where) params.where = String(args.where);
  if (args.limit) params.limit = String(args.limit);

  // Export returns NDJSON - return as raw text
  const url = new URL(`${MP_QUERY}/export`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: basicAuth(username, secret) },
  });
  if (!res.ok) throw new Error(`Mixpanel export error (${res.status})`);
  const text = await res.text();
  const lines = text.trim().split("\n").filter(Boolean);
  const events = lines.map((l) => { try { return JSON.parse(l); } catch { return l; } });
  return { count: events.length, from_date: fromDate, to_date: toDate, events };
}
