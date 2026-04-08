// ── NewsAPI tool ────────────────────────────────────────────────────────────────
// 80k+ sources, free developer tier.
// Docs: https://newsapi.org/docs
// Env var: NEWS_API_KEY

const NEWSAPI_BASE = "https://newsapi.org/v2";

async function newsGet(
  apiKey: string,
  path: string,
  params: Record<string, string | number | boolean>
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const url = `${NEWSAPI_BASE}${path}${qs.toString() ? "?" + qs.toString() : ""}`;
  const res = await fetch(url, {
    headers: { "X-Api-Key": apiKey },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`NewsAPI HTTP ${res.status}: ${body || res.statusText}`);
  }
  const json = await res.json() as Record<string, unknown>;
  if (json.status === "error") throw new Error(`NewsAPI error: ${json.message ?? json.code}`);
  return json;
}

function getApiKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.NEWS_API_KEY ?? "").trim();
  if (!key) throw new Error("api_key is required (or set NEWS_API_KEY env var).");
  return key;
}

// ── Tool functions ─────────────────────────────────────────────────────────────

export async function newsGetTopHeadlines(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const params: Record<string, string | number> = {};
    if (args.country)  params.country  = String(args.country);
    if (args.category) params.category = String(args.category);
    if (args.sources)  params.sources  = String(args.sources);
    if (args.query)    params.q        = String(args.query);
    if (args.page_size) params.pageSize = Number(args.page_size);
    if (args.page)     params.page     = Number(args.page);
    const data = await newsGet(apiKey, "/top-headlines", params);
    return {
      total_results: data.totalResults,
      articles: data.articles,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function newsSearchNews(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const query = String(args.query ?? "").trim();
    if (!query) return { error: "query is required." };
    const params: Record<string, string | number> = { q: query };
    if (args.from_date)   params.from       = String(args.from_date);
    if (args.to_date)     params.to         = String(args.to_date);
    if (args.language)    params.language   = String(args.language);
    if (args.sort_by)     params.sortBy     = String(args.sort_by);
    if (args.sources)     params.sources    = String(args.sources);
    if (args.domains)     params.domains    = String(args.domains);
    if (args.page_size)   params.pageSize   = Number(args.page_size);
    if (args.page)        params.page       = Number(args.page);
    const data = await newsGet(apiKey, "/everything", params);
    return {
      total_results: data.totalResults,
      articles: data.articles,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function newsGetSources(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const params: Record<string, string> = {};
    if (args.category) params.category = String(args.category);
    if (args.language) params.language = String(args.language);
    if (args.country)  params.country  = String(args.country);
    const data = await newsGet(apiKey, "/top-headlines/sources", params);
    return { sources: data.sources };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
