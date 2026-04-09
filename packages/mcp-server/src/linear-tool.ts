// ── Linear GraphQL API tool ────────────────────────────────────────────────
// Wraps the Linear GraphQL API (https://api.linear.app/graphql) via fetch.
// Auth: API key passed as api_key.
// No external dependencies.

const LINEAR_API = "https://api.linear.app/graphql";

// ── GraphQL helper ─────────────────────────────────────────────────────────────

async function linearQuery(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(LINEAR_API, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        "User-Agent":   "UnClick-MCP/1.0",
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (err) {
    return { error: `Network error reaching Linear API: ${err instanceof Error ? err.message : String(err)}` };
  }

  const text = await response.text();
  let data: Record<string, unknown>;
  try { data = JSON.parse(text) as Record<string, unknown>; } catch { return { error: `Invalid JSON from Linear: ${text}` }; }

  if (response.status === 401) return { error: "Linear API key is invalid. Check your api_key.", status: 401 };
  if (response.status === 429) return { error: "Linear rate limit exceeded. Please wait and retry.", status: 429 };

  if (!response.ok) {
    return { error: `Linear API error ${response.status}: ${text}`, status: response.status };
  }

  if (data.errors) {
    const errs = (data.errors as Array<{ message: string }>).map((e) => e.message).join("; ");
    return { error: `Linear GraphQL error: ${errs}` };
  }

  return data.data;
}

// ── Action implementations ─────────────────────────────────────────────────────

async function listIssues(apiKey: string, args: Record<string, unknown>): Promise<unknown> {
  const first    = args.first    ? Number(args.first)    : 25;
  const teamId   = args.team_id  ? String(args.team_id)  : undefined;
  const stateId  = args.state_id ? String(args.state_id) : undefined;

  const filter: Record<string, unknown> = {};
  if (teamId)  filter.team  = { id: { eq: teamId } };
  if (stateId) filter.state = { id: { eq: stateId } };

  const hasFilter = Object.keys(filter).length > 0;

  return linearQuery(apiKey, `
    query ListIssues($first: Int, $filter: IssueFilter) {
      issues(first: $first, filter: $filter) {
        nodes {
          id
          identifier
          title
          description
          priority
          state { name }
          assignee { name email }
          team { name }
          createdAt
          updatedAt
          url
        }
      }
    }
  `, { first, filter: hasFilter ? filter : undefined });
}

async function createIssue(apiKey: string, args: Record<string, unknown>): Promise<unknown> {
  const title  = String(args.title   ?? "").trim();
  const teamId = String(args.team_id ?? "").trim();
  if (!title)  return { error: "title is required." };
  if (!teamId) return { error: "team_id is required." };

  const input: Record<string, unknown> = { title, teamId };
  if (args.description) input.description = String(args.description);
  if (args.priority)    input.priority    = Number(args.priority);
  if (args.assignee_id) input.assigneeId  = String(args.assignee_id);
  if (args.state_id)    input.stateId     = String(args.state_id);

  return linearQuery(apiKey, `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          title
          url
          state { name }
        }
      }
    }
  `, { input });
}

async function getProject(apiKey: string, args: Record<string, unknown>): Promise<unknown> {
  const id = String(args.project_id ?? "").trim();
  if (!id) return { error: "project_id is required." };
  return linearQuery(apiKey, `
    query GetProject($id: String!) {
      project(id: $id) {
        id
        name
        description
        state
        progress
        startDate
        targetDate
        url
        teams { nodes { id name } }
      }
    }
  `, { id });
}

async function listTeams(apiKey: string): Promise<unknown> {
  return linearQuery(apiKey, `
    query ListTeams {
      teams {
        nodes {
          id
          name
          description
          key
          timezone
        }
      }
    }
  `);
}

async function searchIssues(apiKey: string, args: Record<string, unknown>): Promise<unknown> {
  const term  = String(args.query ?? "").trim();
  const first = args.first ? Number(args.first) : 25;
  if (!term) return { error: "query is required." };

  return linearQuery(apiKey, `
    query SearchIssues($term: String!, $first: Int) {
      issueSearch(term: $term, first: $first) {
        nodes {
          id
          identifier
          title
          description
          priority
          state { name }
          assignee { name }
          team { name }
          url
        }
      }
    }
  `, { term, first });
}

// ── Public dispatcher ──────────────────────────────────────────────────────────

export async function linearAction(
  action: string,
  args:   Record<string, unknown>
): Promise<unknown> {
  const apiKey = String(args.api_key ?? "").trim();
  if (!apiKey) return { error: "api_key is required." };

  try {
    switch (action) {
      case "list_issues":   return listIssues(apiKey, args);
      case "create_issue":  return createIssue(apiKey, args);
      case "get_project":   return getProject(apiKey, args);
      case "list_teams":    return listTeams(apiKey);
      case "search_issues": return searchIssues(apiKey, args);
      default:
        return {
          error: `Unknown Linear action: "${action}". Valid actions: list_issues, create_issue, get_project, list_teams, search_issues.`,
        };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
