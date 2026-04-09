// ── GitHub REST API tool ────────────────────────────────────────────────────
// Wraps the GitHub REST API (https://api.github.com) via fetch.
// Auth: personal access token (PAT) passed as access_token.
// No external dependencies.

const GITHUB_API = "https://api.github.com";

// ── Fetch helper ───────────────────────────────────────────────────────────────

async function githubFetch(
  token: string,
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
  query?: Record<string, string | number | undefined>
): Promise<unknown> {
  const url = new URL(`${GITHUB_API}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Accept:        "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent":  "UnClick-MCP/1.0",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    return { error: `Network error reaching GitHub API: ${err instanceof Error ? err.message : String(err)}` };
  }

  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (response.status === 401) return { error: "GitHub access token is invalid or expired. Check your access_token.", status: 401 };
  if (response.status === 403) return { error: "GitHub rate limit exceeded or insufficient permissions.", status: 403 };
  if (response.status === 404) return { error: "Resource not found. Check the owner, repo, or resource ID.", status: 404 };
  if (response.status === 422) return { error: `GitHub validation error: ${(data as Record<string, unknown>)?.message ?? text}`, status: 422 };

  if (!response.ok) {
    const detail = (data as Record<string, unknown>)?.message ?? text;
    return { error: `GitHub API error ${response.status}: ${detail}`, status: response.status };
  }

  return data;
}

// ── Action implementations ─────────────────────────────────────────────────────

async function searchRepos(token: string, args: Record<string, unknown>): Promise<unknown> {
  const q = String(args.query ?? "").trim();
  if (!q) return { error: "query is required." };
  return githubFetch(token, "GET", "/search/repositories", undefined, {
    q,
    sort:     args.sort     ? String(args.sort)     : undefined,
    order:    args.order    ? String(args.order)    : undefined,
    per_page: args.per_page ? Number(args.per_page) : 10,
    page:     args.page     ? Number(args.page)     : undefined,
  });
}

async function getRepo(token: string, args: Record<string, unknown>): Promise<unknown> {
  const owner = String(args.owner ?? "").trim();
  const repo  = String(args.repo  ?? "").trim();
  if (!owner || !repo) return { error: "owner and repo are required." };
  return githubFetch(token, "GET", `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
}

async function listIssues(token: string, args: Record<string, unknown>): Promise<unknown> {
  const owner = String(args.owner ?? "").trim();
  const repo  = String(args.repo  ?? "").trim();
  if (!owner || !repo) return { error: "owner and repo are required." };
  return githubFetch(token, "GET", `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`, undefined, {
    state:    args.state    ? String(args.state)    : "open",
    labels:   args.labels   ? String(args.labels)   : undefined,
    per_page: args.per_page ? Number(args.per_page) : 30,
    page:     args.page     ? Number(args.page)     : undefined,
  });
}

async function createIssue(token: string, args: Record<string, unknown>): Promise<unknown> {
  const owner = String(args.owner ?? "").trim();
  const repo  = String(args.repo  ?? "").trim();
  const title = String(args.title ?? "").trim();
  if (!owner || !repo) return { error: "owner and repo are required." };
  if (!title)          return { error: "title is required." };

  const body: Record<string, unknown> = { title };
  if (args.body)      body.body      = String(args.body);
  if (args.assignees) body.assignees = args.assignees;
  if (args.labels)    body.labels    = args.labels;
  if (args.milestone) body.milestone = Number(args.milestone);

  return githubFetch(token, "POST", `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`, body);
}

async function listPRs(token: string, args: Record<string, unknown>): Promise<unknown> {
  const owner = String(args.owner ?? "").trim();
  const repo  = String(args.repo  ?? "").trim();
  if (!owner || !repo) return { error: "owner and repo are required." };
  return githubFetch(token, "GET", `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`, undefined, {
    state:    args.state    ? String(args.state)    : "open",
    per_page: args.per_page ? Number(args.per_page) : 30,
    page:     args.page     ? Number(args.page)     : undefined,
  });
}

async function getUser(token: string, args: Record<string, unknown>): Promise<unknown> {
  const username = String(args.username ?? "").trim();
  if (username) return githubFetch(token, "GET", `/users/${encodeURIComponent(username)}`);
  return githubFetch(token, "GET", "/user");
}

async function listGists(token: string, args: Record<string, unknown>): Promise<unknown> {
  const username = String(args.username ?? "").trim();
  const path = username ? `/users/${encodeURIComponent(username)}/gists` : "/gists";
  return githubFetch(token, "GET", path, undefined, {
    per_page: args.per_page ? Number(args.per_page) : 30,
  });
}

async function searchCode(token: string, args: Record<string, unknown>): Promise<unknown> {
  const q = String(args.query ?? "").trim();
  if (!q) return { error: "query is required." };
  return githubFetch(token, "GET", "/search/code", undefined, {
    q,
    per_page: args.per_page ? Number(args.per_page) : 10,
    page:     args.page     ? Number(args.page)     : undefined,
  });
}

// ── Public dispatcher ──────────────────────────────────────────────────────────

export async function githubAction(
  action: string,
  args:   Record<string, unknown>
): Promise<unknown> {
  const token = String(args.access_token ?? "").trim();

  try {
    switch (action) {
      case "search_repos":  return searchRepos(token, args);
      case "get_repo":      return getRepo(token, args);
      case "list_issues":   return listIssues(token, args);
      case "create_issue":  return createIssue(token, args);
      case "list_prs":      return listPRs(token, args);
      case "get_user":      return getUser(token, args);
      case "list_gists":    return listGists(token, args);
      case "search_code":   return searchCode(token, args);
      default:
        return {
          error: `Unknown GitHub action: "${action}". Valid actions: search_repos, get_repo, list_issues, create_issue, list_prs, get_user, list_gists, search_code.`,
        };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
