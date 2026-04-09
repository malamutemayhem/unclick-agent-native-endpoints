// ── Notion API tool ────────────────────────────────────────────────────────────
// Wraps the Notion REST API (https://api.notion.com/v1/) via fetch.
// Auth: NOTION_API_KEY (Bearer token, Internal Integration Secret).
// All requests require the "Notion-Version: 2022-06-28" header.
//
// Credentials are auto-resolved via vault-bridge:
//   1. Inline args   (api_key passed directly)
//   2. Env var       UNCLICK_NOTION_API_KEY
//   3. Local vault   key "notion/api_key"
//   4. Supabase      via UNCLICK_API_KEY + unclick.world/api/credentials
//
// No external dependencies.

import { resolveCredentials } from "./vault-bridge.js";

const NOTION_BASE    = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// ── Shared fetch helper ────────────────────────────────────────────────────────

async function notionFetch(
  apiKey: string,
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
  query?: Record<string, string | number | undefined>
): Promise<unknown> {
  const url = new URL(`${NOTION_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization:    `Bearer ${apiKey}`,
    "Notion-Version": NOTION_VERSION,
    Accept:           "application/json",
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
    return { error: `Network error reaching Notion API: ${err instanceof Error ? err.message : String(err)}` };
  }

  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (response.status === 401) return { error: "Notion API key is invalid or expired. Check your NOTION_API_KEY.", status: 401 };
  if (response.status === 404) return { error: "Resource not found. Check the ID and ensure the integration has access to this page/database.", status: 404 };
  if (response.status === 429) return { error: "Notion rate limit exceeded. Please wait and retry.", status: 429 };

  if (!response.ok) {
    const detail = (data as Record<string, unknown>)?.message ?? text;
    return { error: `Notion API error ${response.status}: ${detail}`, status: response.status };
  }

  return data;
}

// ── Action implementations ─────────────────────────────────────────────────────

async function searchNotion(key: string, args: Record<string, unknown>): Promise<unknown> {
  const query = String(args.query ?? "").trim();
  if (!query) return { error: "query is required." };

  const body: Record<string, unknown> = { query };
  if (args.filter)         body.filter         = args.filter;
  if (args.sort)           body.sort           = args.sort;
  if (args.page_size)      body.page_size      = Number(args.page_size);
  if (args.start_cursor)   body.start_cursor   = String(args.start_cursor);

  return notionFetch(key, "POST", "/search", body);
}

async function getNotionPage(key: string, args: Record<string, unknown>): Promise<unknown> {
  const id = String(args.page_id ?? "").trim();
  if (!id) return { error: "page_id is required." };
  return notionFetch(key, "GET", `/pages/${encodeURIComponent(id)}`);
}

async function getNotionDatabase(key: string, args: Record<string, unknown>): Promise<unknown> {
  const id = String(args.database_id ?? "").trim();
  if (!id) return { error: "database_id is required." };
  return notionFetch(key, "GET", `/databases/${encodeURIComponent(id)}`);
}

async function queryNotionDatabase(key: string, args: Record<string, unknown>): Promise<unknown> {
  const id = String(args.database_id ?? "").trim();
  if (!id) return { error: "database_id is required." };

  const body: Record<string, unknown> = {};
  if (args.filter)       body.filter       = args.filter;
  if (args.sorts)        body.sorts        = args.sorts;
  if (args.page_size)    body.page_size    = Number(args.page_size);
  if (args.start_cursor) body.start_cursor = String(args.start_cursor);

  return notionFetch(key, "POST", `/databases/${encodeURIComponent(id)}/query`, body);
}

async function createNotionPage(key: string, args: Record<string, unknown>): Promise<unknown> {
  const database_id = String(args.database_id ?? "").trim();
  if (!database_id) return { error: "database_id is required." };
  if (!args.properties || typeof args.properties !== "object") {
    return { error: "properties (object) is required." };
  }

  const body: Record<string, unknown> = {
    parent:     { database_id },
    properties: args.properties,
  };
  if (args.children) body.children = args.children;
  if (args.icon)     body.icon     = args.icon;
  if (args.cover)    body.cover    = args.cover;

  return notionFetch(key, "POST", "/pages", body);
}

async function updateNotionPage(key: string, args: Record<string, unknown>): Promise<unknown> {
  const id = String(args.page_id ?? "").trim();
  if (!id) return { error: "page_id is required." };
  if (!args.properties || typeof args.properties !== "object") {
    return { error: "properties (object) is required." };
  }

  const body: Record<string, unknown> = { properties: args.properties };
  if (args.archived !== undefined) body.archived = Boolean(args.archived);
  if (args.icon)  body.icon  = args.icon;
  if (args.cover) body.cover = args.cover;

  return notionFetch(key, "PATCH", `/pages/${encodeURIComponent(id)}`, body);
}

// ── Public dispatcher ──────────────────────────────────────────────────────────

export async function notionAction(
  action: string,
  args:   Record<string, unknown>
): Promise<unknown> {
  const resolved = await resolveCredentials("notion", args);
  if ("error" in resolved) return resolved;

  const key = String(resolved.api_key ?? "").trim();
  if (!key) return { error: "Notion api_key could not be resolved." };

  try {
    switch (action) {
      case "search_notion":         return searchNotion(key, args);
      case "get_notion_page":       return getNotionPage(key, args);
      case "get_notion_database":   return getNotionDatabase(key, args);
      case "query_notion_database": return queryNotionDatabase(key, args);
      case "create_notion_page":    return createNotionPage(key, args);
      case "update_notion_page":    return updateNotionPage(key, args);
      default:
        return {
          error: `Unknown Notion action: "${action}". Valid actions: search_notion, get_notion_page, get_notion_database, query_notion_database, create_notion_page, update_notion_page.`,
        };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
