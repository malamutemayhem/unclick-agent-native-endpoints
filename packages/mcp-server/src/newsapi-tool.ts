// NewsAPI integration for the UnClick MCP server.
// Uses the NewsAPI v2 REST API via fetch - no external dependencies.
// Get a free API key at https://newsapi.org/register

const NEWSAPI_BASE = "https://newsapi.org/v2";

// ─── API helper ──────────────────────────────────────────────────────────────

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.NEWS_API_KEY ?? "").trim();
  if (!key) {
    throw new Error(
      "api_key is required. Get a free key at https://newsapi.org/register"
    );
  }
  return key;
}

async function newsapiFetch<T>(
  path: string,
  params: Record<string, string>,
  key: string
): Promise<T> {
  const url = new URL(`${NEWSAPI_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { "X-Api-Key": key },
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok || body.status === "error") {
    throw new Error(
      `NewsAPI HTTP ${res.status}: ${String(body.message ?? "Unknown error")}`
    );
  }
  return body as T;
}

// ─── Article normalizer ───────────────────────────────────────────────────────

function normalizeArticle(a: Record<string, unknown>) {
  const source = (a.source as Record<string, unknown>) ?? {};
  return {
    title: a.title ?? null,
    source: source.name ?? null,
    author: a.author ?? null,
    description: a.description ?? null,
    url: a.url ?? null,
    published_at: a.publishedAt ?? null,
  };
}

// ─── Operations ──────────────────────────────────────────────────────────────

export async function newsTopHeadlines(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const params: Record<string, string> = {};
  if (args.country) params.country = String(args.country);
  if (args.category) params.category = String(args.category);
  if (args.query) params.q = String(args.query);
  if (args.page_size) {
    params.pageSize = String(Math.min(100, Math.max(1, Number(args.page_size))));
  }

  const data = await newsapiFetch<Record<string, unknown>>(
    "/top-headlines",
    params,
    key
  );
  const articles = (data.articles as Record<string, unknown>[]) ?? [];

  return {
    total: data.totalResults ?? 0,
    count: articles.length,
    articles: articles.map(normalizeArticle),
  };
}

export async function newsSearch(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const query = String(args.query ?? "").trim();
  if (!query) throw new Error("query is required.");

  const params: Record<string, string> = { q: query };
  if (args.from_date) params.from = String(args.from_date);
  if (args.language) params.language = String(args.language);
  if (args.sort_by) params.sortBy = String(args.sort_by);
  if (args.page_size) {
    params.pageSize = String(Math.min(100, Math.max(1, Number(args.page_size))));
  }

  const data = await newsapiFetch<Record<string, unknown>>(
    "/everything",
    params,
    key
  );
  const articles = (data.articles as Record<string, unknown>[]) ?? [];

  return {
    total: data.totalResults ?? 0,
    count: articles.length,
    articles: articles.map(normalizeArticle),
  };
}

export async function newsSources(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const params: Record<string, string> = {};
  if (args.category) params.category = String(args.category);
  if (args.country) params.country = String(args.country);
  if (args.language) params.language = String(args.language);

  const data = await newsapiFetch<Record<string, unknown>>(
    "/top-headlines/sources",
    params,
    key
  );
  const sources = (data.sources as Record<string, unknown>[]) ?? [];

  return {
    count: sources.length,
    sources: sources.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? null,
      url: s.url ?? null,
      category: s.category ?? null,
      language: s.language ?? null,
      country: s.country ?? null,
    })),
  };
}
