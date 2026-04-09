// ── Feedly API tool ────────────────────────────────────────────────────────────
// Wraps the Feedly Cloud API (https://cloud.feedly.com/v3/) via fetch.
// Auth: OAuth Bearer token (FEEDLY_ACCESS_TOKEN).
//   Get a developer token at feedly.com/v3/auth/dev.
//
// Credentials are auto-resolved via vault-bridge:
//   1. Inline args   (access_token passed directly)
//   2. Env var       UNCLICK_FEEDLY_ACCESS_TOKEN
//   3. Local vault   key "feedly/access_token"
//   4. Supabase      via UNCLICK_API_KEY + unclick.world/api/credentials
//
// No external dependencies.

import { resolveCredentials } from "./vault-bridge.js";

const FEEDLY_BASE = "https://cloud.feedly.com/v3";

// ── Shared fetch helper ────────────────────────────────────────────────────────

async function feedlyFetch(
  token: string,
  method: "GET" | "POST",
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
  body?: unknown
): Promise<unknown> {
  const url = new URL(`${FEEDLY_BASE}${path}`);
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
    return { error: `Network error reaching Feedly API: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (response.status === 401) return { error: "Feedly access token is invalid or expired. Get a new one at feedly.com/v3/auth/dev.", status: 401 };
  if (response.status === 404) return { error: "Resource not found. Check the stream or feed ID.", status: 404 };
  if (response.status === 429) return { error: "Feedly rate limit exceeded. Please wait and retry.", status: 429 };

  const text = await response.text();
  if (!text) return { ok: true };

  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!response.ok) {
    const detail = (data as Record<string, unknown>)?.errorMessage ?? text;
    return { error: `Feedly API error ${response.status}: ${detail}`, status: response.status };
  }

  return data;
}

// ── Profile helper ─────────────────────────────────────────────────────────────
// Some Feedly endpoints require the user ID. We fetch it lazily.

async function getUserId(token: string): Promise<string | { error: string }> {
  const profile = await feedlyFetch(token, "GET", "/profile") as Record<string, unknown>;
  if ("error" in profile) return profile as { error: string };
  const id = String(profile.id ?? "").trim();
  if (!id) return { error: "Could not determine Feedly user ID from profile." };
  return id;
}

// ── Action implementations ─────────────────────────────────────────────────────

async function getFeeds(token: string, _args: Record<string, unknown>): Promise<unknown> {
  return feedlyFetch(token, "GET", "/subscriptions");
}

async function getStreams(token: string, args: Record<string, unknown>): Promise<unknown> {
  // Allow caller to pass stream_id directly; otherwise default to global.all for the user.
  let streamId = String(args.stream_id ?? "").trim();

  if (!streamId) {
    const userId = await getUserId(token);
    if (typeof userId !== "string") return userId;
    streamId = `user/${userId}/category/global.all`;
  }

  return feedlyFetch(token, "GET", "/streams/contents", {
    streamId,
    count:       args.count ? Number(args.count) : 20,
    ranked:      args.ranked ? String(args.ranked) : undefined,
    unreadOnly:  args.unread_only !== undefined ? Boolean(args.unread_only) : undefined,
    newerThan:   args.newer_than ? Number(args.newer_than) : undefined,
    continuation: args.continuation ? String(args.continuation) : undefined,
  });
}

async function searchFeeds(token: string, args: Record<string, unknown>): Promise<unknown> {
  const query = String(args.query ?? "").trim();
  if (!query) return { error: "query is required." };
  return feedlyFetch(token, "GET", "/search/feeds", {
    query,
    count:  args.count ? Number(args.count) : 20,
    locale: args.locale ? String(args.locale) : undefined,
  });
}

async function getCategories(token: string, _args: Record<string, unknown>): Promise<unknown> {
  return feedlyFetch(token, "GET", "/categories");
}

async function markAsRead(token: string, args: Record<string, unknown>): Promise<unknown> {
  if (!args.entry_ids && !args.feed_ids && !args.category_ids) {
    return { error: "At least one of entry_ids, feed_ids, or category_ids is required." };
  }

  const marker: Record<string, unknown> = {
    action: "markAsRead",
    type:   args.type ?? (args.entry_ids ? "entries" : args.feed_ids ? "feeds" : "categories"),
  };
  if (args.entry_ids)    marker.entryIds    = args.entry_ids;
  if (args.feed_ids)     marker.feedIds     = args.feed_ids;
  if (args.category_ids) marker.categoryIds = args.category_ids;
  if (args.last_read_entry_id) marker.lastReadEntryId = String(args.last_read_entry_id);

  return feedlyFetch(token, "POST", "/markers", undefined, { markers: [marker] });
}

// ── Public dispatcher ──────────────────────────────────────────────────────────

export async function feedlyAction(
  action: string,
  args:   Record<string, unknown>
): Promise<unknown> {
  const resolved = await resolveCredentials("feedly", args);
  if ("error" in resolved) return resolved;

  const token = String(resolved.access_token ?? "").trim();
  if (!token) return { error: "Feedly access_token could not be resolved." };

  try {
    switch (action) {
      case "get_feedly_feeds":       return getFeeds(token, args);
      case "get_feedly_streams":     return getStreams(token, args);
      case "search_feedly":          return searchFeeds(token, args);
      case "get_feedly_categories":  return getCategories(token, args);
      case "mark_as_read":           return markAsRead(token, args);
      default:
        return {
          error: `Unknown Feedly action: "${action}". Valid actions: get_feedly_feeds, get_feedly_streams, search_feedly, get_feedly_categories, mark_as_read.`,
        };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
