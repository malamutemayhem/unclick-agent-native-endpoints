// Asana task management API.
// Docs: https://developers.asana.com/reference/rest-api-reference
// Auth: ASANA_API_KEY (Personal Access Token, Bearer)
// Base: https://app.asana.com/api/1.0

const ASANA_BASE = "https://app.asana.com/api/1.0";

function getApiKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.ASANA_API_KEY ?? "").trim();
  if (!key) throw new Error("api_key is required (or set ASANA_API_KEY env var).");
  return key;
}

async function asanaGet(
  apiKey: string,
  path: string,
  params?: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${ASANA_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  if (res.status === 401) throw new Error("Invalid Asana API key.");
  if (res.status === 403) throw new Error("Asana: access forbidden.");
  if (res.status === 404) throw new Error(`Asana: resource not found at ${path}.`);
  if (res.status === 429) throw new Error("Asana rate limit exceeded.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Asana HTTP ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<unknown>;
}

async function asanaPost(
  apiKey: string,
  path: string,
  body: Record<string, unknown>,
  method: "POST" | "PUT" = "POST"
): Promise<unknown> {
  const res = await fetch(`${ASANA_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ data: body }),
  });
  if (res.status === 401) throw new Error("Invalid Asana API key.");
  if (res.status === 403) throw new Error("Asana: access forbidden.");
  if (res.status === 404) throw new Error(`Asana: resource not found at ${path}.`);
  if (res.status === 429) throw new Error("Asana rate limit exceeded.");
  if (!res.ok) {
    const b = await res.text().catch(() => "");
    throw new Error(`Asana HTTP ${res.status}: ${b || res.statusText}`);
  }
  return res.json() as Promise<unknown>;
}

// list_asana_workspaces
export async function listAsanaWorkspaces(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const json = await asanaGet(apiKey, "/workspaces") as Record<string, unknown>;
    const data = (json.data ?? []) as Array<Record<string, unknown>>;
    return {
      count: data.length,
      workspaces: data.map((w) => ({ gid: w.gid, name: w.name })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// list_asana_projects
export async function listAsanaProjects(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const workspaceGid = String(args.workspace_gid ?? "").trim();
    if (!workspaceGid) return { error: "workspace_gid is required." };
    const params: Record<string, string> = {
      workspace: workspaceGid,
      opt_fields: "gid,name,color,archived,notes,created_at,modified_at",
    };
    if (args.archived !== undefined) params.archived = String(args.archived);
    if (args.limit) params.limit = String(args.limit);
    const json = await asanaGet(apiKey, "/projects", params) as Record<string, unknown>;
    const data = (json.data ?? []) as Array<Record<string, unknown>>;
    return { count: data.length, projects: data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// list_asana_tasks
export async function listAsanaTasks(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const projectGid = String(args.project_gid ?? "").trim();
    if (!projectGid) return { error: "project_gid is required." };
    const params: Record<string, string> = {
      project: projectGid,
      opt_fields: "gid,name,completed,due_on,notes,assignee.name,created_at,modified_at",
    };
    if (args.completed !== undefined) params.completed_since = args.completed ? "now" : "1970-01-01T00:00:00.000Z";
    if (args.limit) params.limit = String(args.limit);
    const json = await asanaGet(apiKey, "/tasks", params) as Record<string, unknown>;
    const data = (json.data ?? []) as Array<Record<string, unknown>>;
    return { count: data.length, tasks: data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// create_asana_task
export async function createAsanaTask(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const name = String(args.name ?? "").trim();
    if (!name) return { error: "name is required." };
    const workspaceGid = String(args.workspace_gid ?? "").trim();
    if (!workspaceGid) return { error: "workspace_gid is required." };

    const body: Record<string, unknown> = { name, workspace: workspaceGid };
    if (args.notes) body.notes = String(args.notes);
    if (args.due_on) body.due_on = String(args.due_on);
    if (args.assignee) body.assignee = String(args.assignee);
    if (args.projects) body.projects = args.projects;

    const json = await asanaPost(apiKey, "/tasks", body) as Record<string, unknown>;
    return json.data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// update_asana_task
export async function updateAsanaTask(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const taskGid = String(args.task_gid ?? "").trim();
    if (!taskGid) return { error: "task_gid is required." };

    const body: Record<string, unknown> = {};
    if (args.name) body.name = String(args.name);
    if (args.notes !== undefined) body.notes = String(args.notes);
    if (args.completed !== undefined) body.completed = Boolean(args.completed);
    if (args.due_on !== undefined) body.due_on = args.due_on ? String(args.due_on) : null;
    if (args.assignee !== undefined) body.assignee = args.assignee ? String(args.assignee) : null;

    const json = await asanaPost(apiKey, `/tasks/${taskGid}`, body, "PUT") as Record<string, unknown>;
    return json.data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// get_asana_task
export async function getAsanaTask(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const taskGid = String(args.task_gid ?? "").trim();
    if (!taskGid) return { error: "task_gid is required." };
    const json = await asanaGet(apiKey, `/tasks/${taskGid}`, {
      opt_fields: "gid,name,completed,due_on,notes,assignee.name,projects.name,workspace.name,created_at,modified_at",
    }) as Record<string, unknown>;
    return json.data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// search_asana_tasks
export async function searchAsanaTasks(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const workspaceGid = String(args.workspace_gid ?? "").trim();
    if (!workspaceGid) return { error: "workspace_gid is required." };
    const text = String(args.text ?? "").trim();
    if (!text) return { error: "text is required." };

    const params: Record<string, string> = {
      text,
      opt_fields: "gid,name,completed,due_on,notes,assignee.name",
    };
    if (args.completed !== undefined) params.completed = String(args.completed);
    if (args.limit) params.limit = String(args.limit);

    const json = await asanaGet(apiKey, `/workspaces/${workspaceGid}/tasks/search`, params) as Record<string, unknown>;
    const data = (json.data ?? []) as Array<Record<string, unknown>>;
    return { count: data.length, tasks: data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
