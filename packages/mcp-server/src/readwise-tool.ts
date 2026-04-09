// ── Readwise API tool ──────────────────────────────────────────────────────────
// Wraps Readwise API v2 (https://readwise.io/api/v2/) and v3 (https://readwise.io/api/v3/)
// for highlights, books, and daily review.
// Auth: Token header with READWISE_TOKEN.
//
// Credentials are auto-resolved via vault-bridge:
//   1. Inline args   (token passed directly)
//   2. Env var       UNCLICK_READWISE_TOKEN
//   3. Local vault   key "readwise/token"
//   4. Supabase      via UNCLICK_API_KEY + unclick.world/api/credentials
//
// No external dependencies.

import { resolveCredentials } from "./vault-bridge.js";

const READWISE_V2 = "https://readwise.io/api/v2";
const READWISE_V3 = "https://readwise.io/api/v3";

// ── Shared fetch helper ────────────────────────────────────────────────────────

async function readwiseFetch(
  token: string,
  base: string,
  method: "GET" | "POST",
  path: string,
  query?: Record<string, string | number | undefined>,
  body?: unknown
): Promise<unknown> {
  const url = new URL(`${base}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Token ${token}`,
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
    return { error: `Network error reaching Readwise API: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (response.status === 401) return { error: "Readwise token is invalid or expired. Check your READWISE_TOKEN.", status: 401 };
  if (response.status === 429) return { error: "Readwise rate limit exceeded. Please wait and retry.", status: 429 };

  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!response.ok) {
    const detail = (data as Record<string, unknown>)?.detail ?? text;
    return { error: `Readwise API error ${response.status}: ${detail}`, status: response.status };
  }

  return data;
}

// ── Action implementations ─────────────────────────────────────────────────────

async function getHighlights(token: string, args: Record<string, unknown>): Promise<unknown> {
  return readwiseFetch(token, READWISE_V2, "GET", "/highlights/", {
    page_size: args.page_size ? Number(args.page_size) : 20,
    page:      args.page ? Number(args.page) : undefined,
    book_id:   args.book_id ? String(args.book_id) : undefined,
  });
}

async function getBooks(token: string, args: Record<string, unknown>): Promise<unknown> {
  return readwiseFetch(token, READWISE_V2, "GET", "/books/", {
    page_size: args.page_size ? Number(args.page_size) : 20,
    page:      args.page ? Number(args.page) : undefined,
    category:  args.category ? String(args.category) : undefined,
  });
}

async function getDailyReview(token: string, _args: Record<string, unknown>): Promise<unknown> {
  return readwiseFetch(token, READWISE_V2, "GET", "/review/next/");
}

async function searchHighlights(token: string, args: Record<string, unknown>): Promise<unknown> {
  const query = String(args.query ?? "").trim();
  if (!query) return { error: "query is required." };
  return readwiseFetch(token, READWISE_V2, "GET", "/highlights/", {
    page_size: args.page_size ? Number(args.page_size) : 20,
    search:    query,
  });
}

async function createHighlight(token: string, args: Record<string, unknown>): Promise<unknown> {
  const text = String(args.text ?? "").trim();
  if (!text) return { error: "text is required." };

  const highlight: Record<string, unknown> = { text };
  if (args.title)           highlight.title           = String(args.title);
  if (args.author)          highlight.author          = String(args.author);
  if (args.source_url)      highlight.source_url      = String(args.source_url);
  if (args.source_type)     highlight.source_type     = String(args.source_type);
  if (args.note)            highlight.note            = String(args.note);
  if (args.highlighted_at)  highlight.highlighted_at  = String(args.highlighted_at);

  return readwiseFetch(token, READWISE_V2, "POST", "/highlights/", undefined, {
    highlights: [highlight],
  });
}

// ── Public dispatcher ──────────────────────────────────────────────────────────

export async function readwiseAction(
  action: string,
  args:   Record<string, unknown>
): Promise<unknown> {
  const resolved = await resolveCredentials("readwise", args);
  if ("error" in resolved) return resolved;

  const token = String(resolved.token ?? "").trim();
  if (!token) return { error: "Readwise token could not be resolved." };

  try {
    switch (action) {
      case "get_readwise_highlights": return getHighlights(token, args);
      case "get_readwise_books":      return getBooks(token, args);
      case "get_daily_review":        return getDailyReview(token, args);
      case "search_highlights":       return searchHighlights(token, args);
      case "create_highlight":        return createHighlight(token, args);
      default:
        return {
          error: `Unknown Readwise action: "${action}". Valid actions: get_readwise_highlights, get_readwise_books, get_daily_review, search_highlights, create_highlight.`,
        };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
