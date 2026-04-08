// ── The Guardian Open Platform API tool ────────────────────────────────────────
// Free tier supports full article text (show-fields=body).
// Docs: https://open-platform.theguardian.com/documentation/
// Env var: GUARDIAN_API_KEY

const GUARDIAN_BASE = "https://content.guardianapis.com";

async function guardianGet(
  apiKey: string,
  path: string,
  params: Record<string, string | number | boolean>
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({ "api-key": apiKey });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const res = await fetch(`${GUARDIAN_BASE}${path}?${qs}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Guardian API HTTP ${res.status}: ${body || res.statusText}`);
  }
  const json = (await res.json()) as { response: Record<string, unknown> };
  return json.response;
}

function getApiKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.GUARDIAN_API_KEY ?? "").trim();
  if (!key) throw new Error("api_key is required (or set GUARDIAN_API_KEY env var).");
  return key;
}

// ── Tool functions ─────────────────────────────────────────────────────────────

export async function guardianSearchArticles(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const query = String(args.query ?? "").trim();
    if (!query) return { error: "query is required." };
    const params: Record<string, string | number> = {
      q:           query,
      "show-fields": "headline,trailText,byline,wordcount,body",
    };
    if (args.section)   params.section   = String(args.section);
    if (args.from_date) params["from-date"] = String(args.from_date);
    if (args.to_date)   params["to-date"]   = String(args.to_date);
    if (args.order_by)  params["order-by"]  = String(args.order_by);
    if (args.page_size) params["page-size"] = Number(args.page_size);
    if (args.page)      params.page         = Number(args.page);
    const data = await guardianGet(apiKey, "/search", params);
    return {
      total:        data.total,
      page:         data.currentPage,
      pages:        data.pages,
      articles:     data.results,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function guardianGetArticle(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const id = String(args.id ?? "").trim();
    if (!id) return { error: "id is required (e.g. 'world/2024/jan/01/article-slug')." };
    const data = await guardianGet(apiKey, `/${id}`, { "show-fields": "all" });
    return data.content ?? data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function guardianGetSections(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const params: Record<string, string> = {};
    if (args.query) params.q = String(args.query);
    const data = await guardianGet(apiKey, "/sections", params);
    return { sections: data.results };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function guardianGetTags(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const query = String(args.query ?? "").trim();
    if (!query) return { error: "query is required." };
    const params: Record<string, string | number> = { q: query };
    if (args.section)   params.section   = String(args.section);
    if (args.type)      params.type      = String(args.type);
    if (args.page_size) params["page-size"] = Number(args.page_size);
    const data = await guardianGet(apiKey, "/tags", params);
    return { total: data.total, tags: data.results };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function guardianGetEdition(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const edition = String(args.edition ?? "uk").trim().toLowerCase();
    // Edition IDs: uk, us, au
    const data = await guardianGet(apiKey, "/editions", {});
    const editions = (data.results as Array<Record<string, unknown>>) ?? [];
    const found = editions.find(
      (e) =>
        String(e.id).toLowerCase() === edition ||
        String(e.code).toLowerCase() === edition
    );
    if (!found) return { available_editions: editions.map((e) => ({ id: e.id, code: e.code, webTitle: e.webTitle })) };
    return found;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
