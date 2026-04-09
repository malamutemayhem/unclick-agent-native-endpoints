// ── Sentry REST API tool ───────────────────────────────────────────────────
// Wraps the Sentry REST API (https://sentry.io/api/0/) via fetch.
// Auth: auth token passed as auth_token.
// No external dependencies.

const SENTRY_API = "https://sentry.io/api/0";

// ── Fetch helper ───────────────────────────────────────────────────────────────

async function sentryFetch(
  token: string,
  method: "GET" | "PUT",
  path: string,
  body?: unknown,
  query?: Record<string, string | number | undefined>
): Promise<unknown> {
  const url = new URL(`${SENTRY_API}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
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
    return { error: `Network error reaching Sentry API: ${err instanceof Error ? err.message : String(err)}` };
  }

  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (response.status === 401) return { error: "Sentry auth token is invalid or expired. Check your auth_token.", status: 401 };
  if (response.status === 403) return { error: "Insufficient permissions for this Sentry resource.", status: 403 };
  if (response.status === 404) return { error: "Project, issue, or event not found. Check the organization_slug and project_slug.", status: 404 };
  if (response.status === 429) return { error: "Sentry rate limit exceeded. Please wait and retry.", status: 429 };

  if (!response.ok) {
    const detail = (data as Record<string, unknown>)?.detail ?? text;
    return { error: `Sentry API error ${response.status}: ${detail}`, status: response.status };
  }

  return data;
}

// ── Action implementations ─────────────────────────────────────────────────────

async function listProjects(token: string, args: Record<string, unknown>): Promise<unknown> {
  const orgSlug = String(args.organization_slug ?? "").trim();
  if (!orgSlug) return { error: "organization_slug is required." };
  return sentryFetch(token, "GET", `/organizations/${encodeURIComponent(orgSlug)}/projects/`, undefined, {
    cursor: args.cursor ? String(args.cursor) : undefined,
  });
}

async function listIssues(token: string, args: Record<string, unknown>): Promise<unknown> {
  const orgSlug  = String(args.organization_slug ?? "").trim();
  const projSlug = String(args.project_slug      ?? "").trim();
  if (!orgSlug)  return { error: "organization_slug is required." };
  if (!projSlug) return { error: "project_slug is required." };

  return sentryFetch(token, "GET", `/projects/${encodeURIComponent(orgSlug)}/${encodeURIComponent(projSlug)}/issues/`, undefined, {
    query:   args.query   ? String(args.query)   : undefined,
    limit:   args.limit   ? Number(args.limit)   : 25,
    cursor:  args.cursor  ? String(args.cursor)  : undefined,
    statsPeriod: args.stats_period ? String(args.stats_period) : undefined,
  });
}

async function getIssue(token: string, args: Record<string, unknown>): Promise<unknown> {
  const issueId = String(args.issue_id ?? "").trim();
  if (!issueId) return { error: "issue_id is required." };
  return sentryFetch(token, "GET", `/issues/${encodeURIComponent(issueId)}/`);
}

async function listEvents(token: string, args: Record<string, unknown>): Promise<unknown> {
  const orgSlug  = String(args.organization_slug ?? "").trim();
  const projSlug = String(args.project_slug      ?? "").trim();
  const issueId  = String(args.issue_id          ?? "").trim();
  if (!orgSlug)  return { error: "organization_slug is required." };
  if (!projSlug) return { error: "project_slug is required." };
  if (!issueId)  return { error: "issue_id is required." };

  return sentryFetch(token, "GET",
    `/projects/${encodeURIComponent(orgSlug)}/${encodeURIComponent(projSlug)}/issues/${encodeURIComponent(issueId)}/events/`,
    undefined,
    { limit: args.limit ? Number(args.limit) : 10 }
  );
}

async function resolveIssue(token: string, args: Record<string, unknown>): Promise<unknown> {
  const issueId = String(args.issue_id ?? "").trim();
  if (!issueId) return { error: "issue_id is required." };
  return sentryFetch(token, "PUT", `/issues/${encodeURIComponent(issueId)}/`, { status: "resolved" });
}

// ── Public dispatcher ──────────────────────────────────────────────────────────

export async function sentryAction(
  action: string,
  args:   Record<string, unknown>
): Promise<unknown> {
  const token = String(args.auth_token ?? "").trim();
  if (!token) return { error: "auth_token is required." };

  try {
    switch (action) {
      case "list_projects": return listProjects(token, args);
      case "list_issues":   return listIssues(token, args);
      case "get_issue":     return getIssue(token, args);
      case "list_events":   return listEvents(token, args);
      case "resolve_issue": return resolveIssue(token, args);
      default:
        return {
          error: `Unknown Sentry action: "${action}". Valid actions: list_projects, list_issues, get_issue, list_events, resolve_issue.`,
        };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
