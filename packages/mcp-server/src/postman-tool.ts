// ── Postman API tool ───────────────────────────────────────────────────────
// Wraps the Postman API (https://api.getpostman.com) via fetch.
// Auth: API key passed as api_key (X-Api-Key header).
// No external dependencies.

const POSTMAN_API = "https://api.getpostman.com";

// ── Fetch helper ───────────────────────────────────────────────────────────────

async function postmanFetch(
  apiKey: string,
  path: string,
  query?: Record<string, string | number | undefined>
): Promise<unknown> {
  const url = new URL(`${POSTMAN_API}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        "X-Api-Key":  apiKey,
        "User-Agent": "UnClick-MCP/1.0",
      },
    });
  } catch (err) {
    return { error: `Network error reaching Postman API: ${err instanceof Error ? err.message : String(err)}` };
  }

  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (response.status === 401) return { error: "Postman API key is invalid. Check your api_key.", status: 401 };
  if (response.status === 403) return { error: "Insufficient permissions for this Postman resource.", status: 403 };
  if (response.status === 404) return { error: "Collection, environment, or monitor not found.", status: 404 };
  if (response.status === 429) return { error: "Postman API rate limit exceeded. Please wait and retry.", status: 429 };

  if (!response.ok) {
    const detail = (data as Record<string, unknown>)?.error ?? text;
    return { error: `Postman API error ${response.status}: ${detail}`, status: response.status };
  }

  return data;
}

// ── Action implementations ─────────────────────────────────────────────────────

async function listCollections(apiKey: string, args: Record<string, unknown>): Promise<unknown> {
  return postmanFetch(apiKey, "/collections", {
    workspace: args.workspace_id ? String(args.workspace_id) : undefined,
  });
}

async function getCollection(apiKey: string, args: Record<string, unknown>): Promise<unknown> {
  const collectionId = String(args.collection_id ?? "").trim();
  if (!collectionId) return { error: "collection_id is required." };
  return postmanFetch(apiKey, `/collections/${encodeURIComponent(collectionId)}`);
}

async function listEnvironments(apiKey: string, args: Record<string, unknown>): Promise<unknown> {
  return postmanFetch(apiKey, "/environments", {
    workspace: args.workspace_id ? String(args.workspace_id) : undefined,
  });
}

async function listMonitors(apiKey: string, args: Record<string, unknown>): Promise<unknown> {
  return postmanFetch(apiKey, "/monitors", {
    workspace: args.workspace_id ? String(args.workspace_id) : undefined,
  });
}

// ── Public dispatcher ──────────────────────────────────────────────────────────

export async function postmanAction(
  action: string,
  args:   Record<string, unknown>
): Promise<unknown> {
  const apiKey = String(args.api_key ?? "").trim();
  if (!apiKey) return { error: "api_key is required." };

  try {
    switch (action) {
      case "list_collections":  return listCollections(apiKey, args);
      case "get_collection":    return getCollection(apiKey, args);
      case "list_environments": return listEnvironments(apiKey, args);
      case "list_monitors":     return listMonitors(apiKey, args);
      default:
        return {
          error: `Unknown Postman action: "${action}". Valid actions: list_collections, get_collection, list_environments, list_monitors.`,
        };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
