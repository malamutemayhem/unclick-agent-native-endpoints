// ── Raindrop.io API tool ───────────────────────────────────────────────────────
// Wraps the Raindrop.io REST API (https://api.raindrop.io/rest/v1/) via fetch.
// Auth: Bearer token (RAINDROP_TOKEN). Create a test token at app.raindrop.io/settings/integrations.
//
// Credentials are auto-resolved via vault-bridge:
//   1. Inline args   (token passed directly)
//   2. Env var       UNCLICK_RAINDROP_TOKEN
//   3. Local vault   key "raindrop/token"
//   4. Supabase      via UNCLICK_API_KEY + unclick.world/api/credentials
//
// No external dependencies.

import { resolveCredentials } from "./vault-bridge.js";

const RAINDROP_BASE = "https://api.raindrop.io/rest/v1";

// ── Shared fetch helper ────────────────────────────────────────────────────────

async function raindropFetch(
  token: string,
  method: "GET" | "POST" | "DELETE",
  path: string,
  query?: Record<string, string | number | undefined>,
  body?: unknown
): Promise<unknown> {
  const url = new URL(`${RAINDROP_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept:        "application/json",
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
    return { error: `Network error reaching Raindrop API: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (response.status === 401) return { error: "Raindrop token is invalid or expired. Check your RAINDROP_TOKEN.", status: 401 };
  if (response.status === 404) return { error: "Resource not found. Check the ID.", status: 404 };
  if (response.status === 429) return { error: "Raindrop rate limit exceeded. Please wait and retry.", status: 429 };

  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!response.ok) {
    const detail = (data as Record<string, unknown>)?.errorMessage ?? text;
    return { error: `Raindrop API error ${response.status}: ${detail}`, status: response.status };
  }

  return data;
}

// ── Action implementations ─────────────────────────────────────────────────────

async function searchRaindrops(token: string, args: Record<string, unknown>): Promise<unknown> {
  const query = String(args.query ?? "").trim();
  if (!query) return { error: "query is required." };
  return raindropFetch(token, "GET", "/raindrops/0", {
    search:   query,
    perpage:  args.perpage ? Number(args.perpage) : 25,
    page:     args.page ? Number(args.page) : 0,
    sort:     args.sort ? String(args.sort) : undefined,
  });
}

async function getCollectionRaindrops(token: string, args: Record<string, unknown>): Promise<unknown> {
  const collection_id = String(args.collection_id ?? "0").trim();
  return raindropFetch(token, "GET", `/raindrops/${encodeURIComponent(collection_id)}`, {
    perpage: args.perpage ? Number(args.perpage) : 25,
    page:    args.page ? Number(args.page) : 0,
    sort:    args.sort ? String(args.sort) : undefined,
    search:  args.search ? String(args.search) : undefined,
  });
}

async function getCollections(token: string, _args: Record<string, unknown>): Promise<unknown> {
  return raindropFetch(token, "GET", "/collections");
}

async function createRaindrop(token: string, args: Record<string, unknown>): Promise<unknown> {
  const link = String(args.url ?? "").trim();
  if (!link) return { error: "url is required." };

  const body: Record<string, unknown> = { link };
  if (args.title)         body.title      = String(args.title);
  if (args.tags)          body.tags       = args.tags;
  if (args.collection_id) body.collection = { $id: Number(args.collection_id) };
  if (args.excerpt)       body.excerpt    = String(args.excerpt);

  return raindropFetch(token, "POST", "/raindrop", undefined, body);
}

async function getRaindrop(token: string, args: Record<string, unknown>): Promise<unknown> {
  const id = String(args.id ?? "").trim();
  if (!id) return { error: "id is required." };
  return raindropFetch(token, "GET", `/raindrop/${encodeURIComponent(id)}`);
}

async function deleteRaindrop(token: string, args: Record<string, unknown>): Promise<unknown> {
  const id = String(args.id ?? "").trim();
  if (!id) return { error: "id is required." };
  return raindropFetch(token, "DELETE", `/raindrop/${encodeURIComponent(id)}`);
}

// ── Public dispatcher ──────────────────────────────────────────────────────────

export async function raindropAction(
  action: string,
  args:   Record<string, unknown>
): Promise<unknown> {
  const resolved = await resolveCredentials("raindrop", args);
  if ("error" in resolved) return resolved;

  const token = String(resolved.token ?? "").trim();
  if (!token) return { error: "Raindrop token could not be resolved." };

  try {
    switch (action) {
      case "search_raindrops":          return searchRaindrops(token, args);
      case "get_collection_raindrops":  return getCollectionRaindrops(token, args);
      case "get_raindrop_collections":  return getCollections(token, args);
      case "create_raindrop":           return createRaindrop(token, args);
      case "get_raindrop":              return getRaindrop(token, args);
      case "delete_raindrop":           return deleteRaindrop(token, args);
      default:
        return {
          error: `Unknown Raindrop action: "${action}". Valid actions: search_raindrops, get_collection_raindrops, get_raindrop_collections, create_raindrop, get_raindrop, delete_raindrop.`,
        };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
