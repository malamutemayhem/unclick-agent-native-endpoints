// ── Clockify API tool ──────────────────────────────────────────────────────────
// Wraps the Clockify REST API (https://api.clockify.me/api/v1/) via fetch.
// Auth: X-Api-Key header with CLOCKIFY_API_KEY.
//
// Credentials are auto-resolved via vault-bridge:
//   1. Inline args   (api_key passed directly)
//   2. Env var       UNCLICK_CLOCKIFY_API_KEY
//   3. Local vault   key "clockify/api_key"
//   4. Supabase      via UNCLICK_API_KEY + unclick.world/api/credentials
//
// No external dependencies.

import { resolveCredentials } from "./vault-bridge.js";

const CLOCKIFY_BASE = "https://api.clockify.me/api/v1";

// ── Shared fetch helper ────────────────────────────────────────────────────────

async function clockifyFetch(
  apiKey: string,
  method: "GET" | "POST",
  path: string,
  query?: Record<string, string | number | undefined>,
  body?: unknown
): Promise<unknown> {
  const url = new URL(`${CLOCKIFY_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    "X-Api-Key": apiKey,
    Accept:      "application/json",
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
    return { error: `Network error reaching Clockify API: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (response.status === 401) return { error: "Clockify API key is invalid. Check your CLOCKIFY_API_KEY.", status: 401 };
  if (response.status === 404) return { error: "Resource not found. Check the workspace or project ID.", status: 404 };
  if (response.status === 429) return { error: "Clockify rate limit exceeded. Please wait and retry.", status: 429 };

  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!response.ok) {
    const detail = (data as Record<string, unknown>)?.message ?? text;
    return { error: `Clockify API error ${response.status}: ${detail}`, status: response.status };
  }

  return data;
}

// ── Action implementations ─────────────────────────────────────────────────────

async function getWorkspaces(key: string, _args: Record<string, unknown>): Promise<unknown> {
  return clockifyFetch(key, "GET", "/workspaces");
}

async function getTimeEntries(key: string, args: Record<string, unknown>): Promise<unknown> {
  const workspace_id = String(args.workspace_id ?? "").trim();
  const user_id      = String(args.user_id ?? "").trim();
  if (!workspace_id) return { error: "workspace_id is required." };
  if (!user_id)      return { error: "user_id is required." };

  return clockifyFetch(key, "GET", `/workspaces/${encodeURIComponent(workspace_id)}/user/${encodeURIComponent(user_id)}/time-entries`, {
    start:       args.start ? String(args.start) : undefined,
    end:         args.end ? String(args.end) : undefined,
    project:     args.project_id ? String(args.project_id) : undefined,
    page:        args.page ? Number(args.page) : 1,
    "page-size": args.page_size ? Number(args.page_size) : 50,
  });
}

async function createTimeEntry(key: string, args: Record<string, unknown>): Promise<unknown> {
  const workspace_id = String(args.workspace_id ?? "").trim();
  if (!workspace_id) return { error: "workspace_id is required." };

  const start = String(args.start ?? "").trim();
  if (!start) return { error: "start (ISO 8601 datetime) is required." };

  const body: Record<string, unknown> = { start };
  if (args.end)         body.end         = String(args.end);
  if (args.description) body.description = String(args.description);
  if (args.project_id)  body.projectId   = String(args.project_id);
  if (args.tag_ids)     body.tagIds      = args.tag_ids;
  if (args.billable !== undefined) body.billable = Boolean(args.billable);

  return clockifyFetch(key, "POST", `/workspaces/${encodeURIComponent(workspace_id)}/time-entries`, undefined, body);
}

async function getProjects(key: string, args: Record<string, unknown>): Promise<unknown> {
  const workspace_id = String(args.workspace_id ?? "").trim();
  if (!workspace_id) return { error: "workspace_id is required." };

  return clockifyFetch(key, "GET", `/workspaces/${encodeURIComponent(workspace_id)}/projects`, {
    archived:    args.archived !== undefined ? String(args.archived) : undefined,
    "page-size": args.page_size ? Number(args.page_size) : 50,
    page:        args.page ? Number(args.page) : 1,
    name:        args.name ? String(args.name) : undefined,
  });
}

async function getSummary(key: string, args: Record<string, unknown>): Promise<unknown> {
  const workspace_id = String(args.workspace_id ?? "").trim();
  if (!workspace_id) return { error: "workspace_id is required." };

  const date_range_start = String(args.date_range_start ?? "").trim();
  const date_range_end   = String(args.date_range_end   ?? "").trim();
  if (!date_range_start) return { error: "date_range_start (ISO 8601) is required." };
  if (!date_range_end)   return { error: "date_range_end (ISO 8601) is required."   };

  const body: Record<string, unknown> = {
    dateRangeStart: date_range_start,
    dateRangeEnd:   date_range_end,
    summaryFilter: {
      groups: args.groups ?? ["PROJECT"],
    },
    exportType: "JSON",
  };

  return clockifyFetch(key, "POST", `/workspaces/${encodeURIComponent(workspace_id)}/reports/summary`, undefined, body);
}

// ── Public dispatcher ──────────────────────────────────────────────────────────

export async function clockifyAction(
  action: string,
  args:   Record<string, unknown>
): Promise<unknown> {
  const resolved = await resolveCredentials("clockify", args);
  if ("error" in resolved) return resolved;

  const key = String(resolved.api_key ?? "").trim();
  if (!key) return { error: "Clockify api_key could not be resolved." };

  try {
    switch (action) {
      case "get_clockify_workspaces": return getWorkspaces(key, args);
      case "get_time_entries":        return getTimeEntries(key, args);
      case "create_time_entry":       return createTimeEntry(key, args);
      case "get_clockify_projects":   return getProjects(key, args);
      case "get_clockify_summary":    return getSummary(key, args);
      default:
        return {
          error: `Unknown Clockify action: "${action}". Valid actions: get_clockify_workspaces, get_time_entries, create_time_entry, get_clockify_projects, get_clockify_summary.`,
        };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
