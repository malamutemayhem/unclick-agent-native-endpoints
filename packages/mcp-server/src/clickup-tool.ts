// ── ClickUp API v2 tool ────────────────────────────────────────────────────
// Wraps the ClickUp API v2 (https://api.clickup.com/api/v2) via fetch.
// Auth: API key passed as api_key.
// No external dependencies.

const CLICKUP_API = "https://api.clickup.com/api/v2";

// ── Fetch helper ───────────────────────────────────────────────────────────────

async function clickupFetch(
  apiKey: string,
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
  query?: Record<string, string | number | boolean | undefined>
): Promise<unknown> {
  const url = new URL(`${CLICKUP_API}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization: apiKey,
    "User-Agent":  "UnClick-MCP/1.0",
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
    return { error: `Network error reaching ClickUp API: ${err instanceof Error ? err.message : String(err)}` };
  }

  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (response.status === 401) return { error: "ClickUp API key is invalid. Check your api_key.", status: 401 };
  if (response.status === 403) return { error: "Insufficient permissions for this ClickUp resource.", status: 403 };
  if (response.status === 404) return { error: "Resource not found. Check the ID provided.", status: 404 };
  if (response.status === 429) return { error: "ClickUp rate limit exceeded. Please wait and retry.", status: 429 };

  if (!response.ok) {
    const detail = (data as Record<string, unknown>)?.err ?? text;
    return { error: `ClickUp API error ${response.status}: ${detail}`, status: response.status };
  }

  return data;
}

// ── Action implementations ─────────────────────────────────────────────────────

async function getWorkspaces(apiKey: string): Promise<unknown> {
  return clickupFetch(apiKey, "GET", "/team");
}

async function getSpaces(apiKey: string, args: Record<string, unknown>): Promise<unknown> {
  const teamId = String(args.team_id ?? "").trim();
  if (!teamId) return { error: "team_id is required." };
  return clickupFetch(apiKey, "GET", `/team/${encodeURIComponent(teamId)}/space`, undefined, {
    archived: args.archived ? String(args.archived) : "false",
  });
}

async function getLists(apiKey: string, args: Record<string, unknown>): Promise<unknown> {
  const folderId = String(args.folder_id ?? "").trim();
  const spaceId  = String(args.space_id  ?? "").trim();
  if (folderId) {
    return clickupFetch(apiKey, "GET", `/folder/${encodeURIComponent(folderId)}/list`);
  }
  if (spaceId) {
    return clickupFetch(apiKey, "GET", `/space/${encodeURIComponent(spaceId)}/list`);
  }
  return { error: "folder_id or space_id is required." };
}

async function getTasks(apiKey: string, args: Record<string, unknown>): Promise<unknown> {
  const listId = String(args.list_id ?? "").trim();
  if (!listId) return { error: "list_id is required." };
  return clickupFetch(apiKey, "GET", `/list/${encodeURIComponent(listId)}/task`, undefined, {
    archived:        args.archived        ? "true" : undefined,
    include_closed:  args.include_closed  ? "true" : undefined,
    assignees:       args.assignees       ? String(args.assignees) : undefined,
    statuses:        args.statuses        ? String(args.statuses)  : undefined,
    page:            args.page            ? Number(args.page)      : undefined,
  });
}

async function createTask(apiKey: string, args: Record<string, unknown>): Promise<unknown> {
  const listId = String(args.list_id ?? "").trim();
  const name   = String(args.name    ?? "").trim();
  if (!listId) return { error: "list_id is required." };
  if (!name)   return { error: "name is required." };

  const body: Record<string, unknown> = { name };
  if (args.description) body.description = String(args.description);
  if (args.assignees)   body.assignees   = args.assignees;
  if (args.tags)        body.tags        = args.tags;
  if (args.status)      body.status      = String(args.status);
  if (args.priority)    body.priority    = Number(args.priority);
  if (args.due_date)    body.due_date    = Number(args.due_date);

  return clickupFetch(apiKey, "POST", `/list/${encodeURIComponent(listId)}/task`, body);
}

async function updateTask(apiKey: string, args: Record<string, unknown>): Promise<unknown> {
  const taskId = String(args.task_id ?? "").trim();
  if (!taskId) return { error: "task_id is required." };

  const body: Record<string, unknown> = {};
  if (args.name)        body.name        = String(args.name);
  if (args.description) body.description = String(args.description);
  if (args.status)      body.status      = String(args.status);
  if (args.priority)    body.priority    = Number(args.priority);
  if (args.due_date)    body.due_date    = Number(args.due_date);
  if (args.assignees)   body.assignees   = args.assignees;

  return clickupFetch(apiKey, "PUT", `/task/${encodeURIComponent(taskId)}`, body);
}

// ── Public dispatcher ──────────────────────────────────────────────────────────

export async function clickupAction(
  action: string,
  args:   Record<string, unknown>
): Promise<unknown> {
  const apiKey = String(args.api_key ?? "").trim();
  if (!apiKey) return { error: "api_key is required." };

  try {
    switch (action) {
      case "get_workspaces": return getWorkspaces(apiKey);
      case "get_spaces":     return getSpaces(apiKey, args);
      case "get_lists":      return getLists(apiKey, args);
      case "get_tasks":      return getTasks(apiKey, args);
      case "create_task":    return createTask(apiKey, args);
      case "update_task":    return updateTask(apiKey, args);
      default:
        return {
          error: `Unknown ClickUp action: "${action}". Valid actions: get_workspaces, get_spaces, get_lists, get_tasks, create_task, update_task.`,
        };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
