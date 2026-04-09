// ── GitLab REST API tool ────────────────────────────────────────────────────
// Wraps the GitLab REST API (https://gitlab.com/api/v4) via fetch.
// Auth: personal access token (PAT) passed as access_token.
// Supports self-hosted instances via the base_url parameter.
// No external dependencies.

const DEFAULT_GITLAB_BASE = "https://gitlab.com/api/v4";

// ── Fetch helper ───────────────────────────────────────────────────────────────

async function gitlabFetch(
  token: string,
  baseUrl: string,
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
  query?: Record<string, string | number | undefined>
): Promise<unknown> {
  const url = new URL(`${baseUrl}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    "User-Agent":  "UnClick-MCP/1.0",
  };
  if (token) headers["PRIVATE-TOKEN"] = token;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    return { error: `Network error reaching GitLab API: ${err instanceof Error ? err.message : String(err)}` };
  }

  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (response.status === 401) return { error: "GitLab access token is invalid or expired. Check your access_token.", status: 401 };
  if (response.status === 403) return { error: "Insufficient permissions for this GitLab resource.", status: 403 };
  if (response.status === 404) return { error: "Resource not found. Check the project ID or namespace.", status: 404 };
  if (response.status === 429) return { error: "GitLab rate limit exceeded. Please wait and retry.", status: 429 };

  if (!response.ok) {
    const detail = (data as Record<string, unknown>)?.message ?? text;
    return { error: `GitLab API error ${response.status}: ${detail}`, status: response.status };
  }

  return data;
}

// ── Action implementations ─────────────────────────────────────────────────────

async function searchProjects(token: string, base: string, args: Record<string, unknown>): Promise<unknown> {
  const search = String(args.query ?? "").trim();
  if (!search) return { error: "query is required." };
  return gitlabFetch(token, base, "GET", "/projects", undefined, {
    search,
    order_by:   args.order_by   ? String(args.order_by)   : "last_activity_at",
    visibility: args.visibility ? String(args.visibility) : undefined,
    per_page:   args.per_page   ? Number(args.per_page)   : 20,
    page:       args.page       ? Number(args.page)       : undefined,
  });
}

async function getProject(token: string, base: string, args: Record<string, unknown>): Promise<unknown> {
  const id = String(args.project_id ?? "").trim();
  if (!id) return { error: "project_id is required." };
  return gitlabFetch(token, base, "GET", `/projects/${encodeURIComponent(id)}`);
}

async function listGitlabIssues(token: string, base: string, args: Record<string, unknown>): Promise<unknown> {
  const id = String(args.project_id ?? "").trim();
  if (!id) return { error: "project_id is required." };
  return gitlabFetch(token, base, "GET", `/projects/${encodeURIComponent(id)}/issues`, undefined, {
    state:    args.state    ? String(args.state)    : "opened",
    labels:   args.labels   ? String(args.labels)   : undefined,
    per_page: args.per_page ? Number(args.per_page) : 20,
    page:     args.page     ? Number(args.page)     : undefined,
  });
}

async function listMRs(token: string, base: string, args: Record<string, unknown>): Promise<unknown> {
  const id = String(args.project_id ?? "").trim();
  if (!id) return { error: "project_id is required." };
  return gitlabFetch(token, base, "GET", `/projects/${encodeURIComponent(id)}/merge_requests`, undefined, {
    state:    args.state    ? String(args.state)    : "opened",
    per_page: args.per_page ? Number(args.per_page) : 20,
    page:     args.page     ? Number(args.page)     : undefined,
  });
}

async function getGitlabUser(token: string, base: string, args: Record<string, unknown>): Promise<unknown> {
  const username = String(args.username ?? "").trim();
  if (username) {
    const results = await gitlabFetch(token, base, "GET", "/users", undefined, { username });
    if (Array.isArray(results) && results.length > 0) return results[0];
    return results;
  }
  return gitlabFetch(token, base, "GET", "/user");
}

// ── Public dispatcher ──────────────────────────────────────────────────────────

export async function gitlabAction(
  action: string,
  args:   Record<string, unknown>
): Promise<unknown> {
  const token   = String(args.access_token ?? "").trim();
  const baseUrl = String(args.base_url ?? DEFAULT_GITLAB_BASE).replace(/\/$/, "");

  try {
    switch (action) {
      case "search_projects": return searchProjects(token, baseUrl, args);
      case "get_project":     return getProject(token, baseUrl, args);
      case "list_issues":     return listGitlabIssues(token, baseUrl, args);
      case "list_mrs":        return listMRs(token, baseUrl, args);
      case "get_user":        return getGitlabUser(token, baseUrl, args);
      default:
        return {
          error: `Unknown GitLab action: "${action}". Valid actions: search_projects, get_project, list_issues, list_mrs, get_user.`,
        };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
