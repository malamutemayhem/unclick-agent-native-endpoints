// Toggl Track time tracking API.
// Docs: https://engineering.toggl.com/docs/api
// Auth: TOGGL_API_KEY (HTTP Basic, key as username, "api_token" as password)
// Base: https://api.track.toggl.com/api/v9/

const TOGGL_BASE = "https://api.track.toggl.com/api/v9";
const TOGGL_REPORTS_BASE = "https://api.track.toggl.com/reports/api/v3";

function getApiKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.TOGGL_API_KEY ?? "").trim();
  if (!key) throw new Error("api_key is required (or set TOGGL_API_KEY env var).");
  return key;
}

function basicAuth(apiKey: string): string {
  return "Basic " + Buffer.from(`${apiKey}:api_token`).toString("base64");
}

async function togglGet(
  apiKey: string,
  path: string,
  params?: Record<string, string>,
  baseUrl: string = TOGGL_BASE
): Promise<unknown> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await fetch(`${baseUrl}${path}${qs}`, {
    headers: {
      Authorization: basicAuth(apiKey),
      "Content-Type": "application/json",
    },
  });
  if (res.status === 401) throw new Error("Invalid Toggl API key.");
  if (res.status === 403) throw new Error("Toggl: access forbidden.");
  if (res.status === 404) throw new Error(`Toggl: resource not found at ${path}.`);
  if (res.status === 429) throw new Error("Toggl rate limit exceeded.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Toggl HTTP ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<unknown>;
}

async function togglPost(
  apiKey: string,
  path: string,
  body: Record<string, unknown>,
  baseUrl: string = TOGGL_BASE
): Promise<unknown> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Invalid Toggl API key.");
  if (res.status === 403) throw new Error("Toggl: access forbidden.");
  if (res.status === 429) throw new Error("Toggl rate limit exceeded.");
  if (!res.ok) {
    const b = await res.text().catch(() => "");
    throw new Error(`Toggl HTTP ${res.status}: ${b || res.statusText}`);
  }
  return res.json() as Promise<unknown>;
}

// get_toggl_time_entries
export async function getTogglTimeEntries(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const params: Record<string, string> = {};
    if (args.start_date) params.start_date = String(args.start_date);
    if (args.end_date) params.end_date = String(args.end_date);
    if (args.meta) params.meta = "true";
    const entries = await togglGet(apiKey, "/me/time_entries", params) as Array<Record<string, unknown>>;
    return {
      count: entries.length,
      entries: entries.map((e) => ({
        id: e.id,
        workspace_id: e.workspace_id,
        project_id: e.project_id,
        description: e.description,
        start: e.start,
        stop: e.stop,
        duration: e.duration,
        billable: e.billable,
        tags: e.tags,
        at: e.at,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// create_time_entry_toggl
export async function createTimeEntryToggl(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const workspaceId = String(args.workspace_id ?? "").trim();
    if (!workspaceId) return { error: "workspace_id is required." };
    const start = String(args.start ?? "").trim();
    if (!start) return { error: "start is required (ISO 8601 datetime, e.g. 2024-01-15T09:00:00Z)." };

    const body: Record<string, unknown> = {
      start,
      created_with: "unclick-mcp",
      workspace_id: Number(workspaceId),
      // duration -1 means timer is running
      duration: args.duration !== undefined ? Number(args.duration) : -1,
    };
    if (args.description) body.description = String(args.description);
    if (args.project_id) body.project_id = Number(args.project_id);
    if (args.tags) body.tags = args.tags;
    if (args.billable !== undefined) body.billable = Boolean(args.billable);
    if (args.stop) body.stop = String(args.stop);

    const data = await togglPost(apiKey, `/workspaces/${workspaceId}/time_entries`, body) as Record<string, unknown>;
    return {
      id: data.id,
      workspace_id: data.workspace_id,
      project_id: data.project_id,
      description: data.description,
      start: data.start,
      stop: data.stop,
      duration: data.duration,
      billable: data.billable,
      tags: data.tags,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// get_toggl_projects
export async function getTogglProjects(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const workspaceId = String(args.workspace_id ?? "").trim();
    if (!workspaceId) return { error: "workspace_id is required." };
    const params: Record<string, string> = {};
    if (args.active !== undefined) params.active = String(args.active);
    if (args.page) params.page = String(args.page);
    if (args.per_page) params.per_page = String(args.per_page);
    const projects = await togglGet(apiKey, `/workspaces/${workspaceId}/projects`, params) as Array<Record<string, unknown>>;
    return {
      count: projects.length,
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        active: p.active,
        billable: p.billable,
        color: p.color,
        client_id: p.client_id,
        workspace_id: p.workspace_id,
        actual_hours: p.actual_hours,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// get_toggl_summary
export async function getTogglSummary(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const workspaceId = String(args.workspace_id ?? "").trim();
    if (!workspaceId) return { error: "workspace_id is required." };
    const startDate = String(args.start_date ?? "").trim();
    const endDate = String(args.end_date ?? "").trim();
    if (!startDate) return { error: "start_date is required (YYYY-MM-DD)." };
    if (!endDate) return { error: "end_date is required (YYYY-MM-DD)." };

    const body: Record<string, unknown> = {
      start_date: startDate,
      end_date: endDate,
    };
    if (args.group_ids) body.group_ids = args.group_ids;
    if (args.project_ids) body.project_ids = args.project_ids;
    if (args.client_ids) body.client_ids = args.client_ids;
    if (args.include_time_entries) body.include_time_entries = true;

    const data = await togglPost(
      apiKey,
      `/workspace/${workspaceId}/summary/time_entries`,
      body,
      TOGGL_REPORTS_BASE
    ) as Record<string, unknown>;

    return {
      total_seconds: data.seconds,
      groups: data.groups,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
