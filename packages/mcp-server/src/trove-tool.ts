// National Library of Australia - Trove integration.
// Search Australian newspapers, books, pictures, maps, and archives.
// Docs: https://trove.nla.gov.au/about/create-something/using-api
// Auth: TROVE_API_KEY env var (key query param).
// Base URL: https://api.trove.nla.gov.au/v3/

const TROVE_BASE = "https://api.trove.nla.gov.au/v3";

function getApiKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.TROVE_API_KEY ?? "").trim();
  if (!key) throw new Error("api_key is required (or set TROVE_API_KEY env var).");
  return key;
}

async function troveGet(
  apiKey: string,
  path: string,
  params: Record<string, string>
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({ ...params, key: apiKey, encoding: "json" });
  const res = await fetch(`${TROVE_BASE}${path}?${qs}`, {
    headers: { "User-Agent": "UnClickMCP/1.0 (https://unclick.io)" },
  });
  if (res.status === 403) throw new Error("Invalid Trove API key.");
  if (res.status === 404) throw new Error("Resource not found in Trove.");
  if (res.status === 429) throw new Error("Trove API rate limit exceeded.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Trove API HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

// ─── search_trove ─────────────────────────────────────────────────────────────

export async function searchTrove(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const query = String(args.query ?? args.q ?? "").trim();
    if (!query) return { error: "query is required." };

    const zone = String(args.zone ?? "newspaper").toLowerCase();
    const validZones = ["newspaper", "book", "picture", "map", "music", "collection", "all"];
    if (!validZones.includes(zone)) {
      return { error: `zone must be one of: ${validZones.join(", ")}` };
    }

    const params: Record<string, string> = {
      q: query,
      zone,
      n: String(Math.min(100, Number(args.limit ?? 20))),
      s: String(Number(args.offset ?? 0)),
    };
    if (args.date_from) params["l-year"] = String(args.date_from);
    if (args.date_to) params["l-decade"] = String(args.date_to);
    if (args.state) params["l-state"] = String(args.state);
    if (args.sort_by) params["sortby"] = String(args.sort_by);

    const data = await troveGet(apiKey, "/result", params);
    const response = data["response"] as Record<string, unknown> | undefined;
    const zoneData = (response?.["zone"] as Array<Record<string, unknown>>)?.[0];
    const records = zoneData?.["records"] as Record<string, unknown> | undefined;

    return {
      query,
      zone,
      total: records?.["total"] ?? 0,
      next_start: records?.["nextStart"] ?? null,
      results: records?.["article"] ?? records?.["work"] ?? records?.["item"] ?? [],
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── get_trove_work ───────────────────────────────────────────────────────────

export async function getTroveWork(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const id = String(args.id ?? "").trim();
    if (!id) return { error: "id is required." };

    const params: Record<string, string> = {
      include: "tags,comments,lists",
    };

    const data = await troveGet(apiKey, `/work/${id}`, params);
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── get_trove_newspaper_article ──────────────────────────────────────────────

export async function getTroveNewspaperArticle(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const id = String(args.id ?? "").trim();
    if (!id) return { error: "id is required (Trove newspaper article ID)." };

    const params: Record<string, string> = {
      include: "articleText",
    };

    const data = await troveGet(apiKey, `/newspaper/${id}`, params);
    const article = data as Record<string, unknown>;

    return {
      id: article["id"],
      heading: article["heading"],
      category: article["category"],
      newspaper: article["title"],
      date: article["date"],
      page: article["page"],
      url: article["troveUrl"],
      pdf_url: article["pdfUrl"],
      word_count: article["wordCount"],
      article_text: article["articleText"],
      corrections: article["correctionCount"],
      tags: article["tag"],
      comments: article["comment"],
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
