// The Guardian Open Platform API integration for the UnClick MCP server.
// Uses the Guardian Content API via fetch - no external dependencies.
// Get a free API key at https://open-platform.theguardian.com/access/

const GUARDIAN_API_BASE = "https://content.guardianapis.com";

// ─── API helper ──────────────────────────────────────────────────────────────

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.GUARDIAN_API_KEY ?? "").trim();
  if (!key) {
    throw new Error(
      "api_key is required. Get a free key at https://open-platform.theguardian.com/access/"
    );
  }
  return key;
}

async function guardianFetch<T>(
  path: string,
  params: Record<string, string>
): Promise<T> {
  const url = new URL(`${GUARDIAN_API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Guardian API HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { response: T };
  return data.response;
}

// ─── Operations ──────────────────────────────────────────────────────────────

export async function guardianSearch(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const query = String(args.query ?? "").trim();
  if (!query) throw new Error("query is required.");

  const params: Record<string, string> = {
    q: query,
    "api-key": key,
    "show-fields": "headline,trailText,wordcount,thumbnail",
  };
  if (args.section) params.section = String(args.section);
  if (args.from_date) params["from-date"] = String(args.from_date);
  if (args.page_size) {
    params["page-size"] = String(Math.min(50, Math.max(1, Number(args.page_size))));
  }

  const data = (await guardianFetch<Record<string, unknown>>("/search", params)) as Record<string, unknown>;
  const results = (data.results as Record<string, unknown>[]) ?? [];

  return {
    total: data.total,
    pages: data.pages,
    current_page: data.currentPage,
    articles: results.map((r) => {
      const fields = (r.fields as Record<string, unknown>) ?? {};
      return {
        id: r.id,
        headline: fields.headline ?? r.webTitle,
        url: r.webUrl,
        date: r.webPublicationDate,
        section: r.sectionName,
        trail_text: fields.trailText ?? null,
        word_count: fields.wordcount ?? null,
      };
    }),
  };
}

export async function guardianSections(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const data = (await guardianFetch<Record<string, unknown>>("/sections", {
    "api-key": key,
  })) as Record<string, unknown>;
  const results = (data.results as Record<string, unknown>[]) ?? [];

  return {
    count: results.length,
    sections: results.map((s) => ({
      id: s.id,
      name: s.webTitle,
      url: s.webUrl,
    })),
  };
}

export async function guardianArticle(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const id = String(args.id ?? "").trim();
  if (!id) {
    throw new Error(
      "id is required (the article path, e.g. 'world/2024/jan/01/article-slug')."
    );
  }

  const data = (await guardianFetch<Record<string, unknown>>(`/${id}`, {
    "show-fields": "headline,body,trailText,byline,wordcount,thumbnail",
    "api-key": key,
  })) as Record<string, unknown>;

  const content = (data.content as Record<string, unknown>) ?? {};
  const fields = (content.fields as Record<string, unknown>) ?? {};

  return {
    id: content.id,
    headline: fields.headline ?? content.webTitle,
    byline: fields.byline ?? null,
    date: content.webPublicationDate,
    section: content.sectionName,
    url: content.webUrl,
    word_count: fields.wordcount ?? null,
    body_html: fields.body ?? null,
    trail_text: fields.trailText ?? null,
  };
}

export async function guardianTags(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const query = String(args.query ?? "").trim();
  if (!query) throw new Error("query is required.");

  const data = (await guardianFetch<Record<string, unknown>>("/tags", {
    q: query,
    "api-key": key,
  })) as Record<string, unknown>;
  const results = (data.results as Record<string, unknown>[]) ?? [];

  return {
    count: results.length,
    tags: results.map((t) => ({
      id: t.id,
      name: t.webTitle,
      type: t.type,
      url: t.webUrl,
    })),
  };
}
