// ── Yelp Fusion API tool ────────────────────────────────────────────────────────
// Yelp Fusion API for business search, reviews, and events.
// Docs: https://docs.developer.yelp.com/docs/fusion-intro
// Env var: YELP_API_KEY

const YELP_BASE = "https://api.yelp.com/v3";

async function yelpGet(
  apiKey: string,
  path: string,
  params: Record<string, string | number | boolean> = {}
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const url = `${YELP_BASE}${path}${qs.toString() ? "?" + qs.toString() : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Yelp API HTTP ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

function getApiKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.YELP_API_KEY ?? "").trim();
  if (!key) throw new Error("api_key is required (or set YELP_API_KEY env var).");
  return key;
}

// ── Tool functions ─────────────────────────────────────────────────────────────

export async function yelpSearchBusinesses(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const location = String(args.location ?? "").trim();
    if (!location) return { error: "location is required (e.g. 'San Francisco, CA')." };
    const params: Record<string, string | number> = { location };
    if (args.term)       params.term       = String(args.term);
    if (args.categories) params.categories = String(args.categories);
    if (args.price)      params.price      = String(args.price);
    if (args.radius)     params.radius     = Number(args.radius);
    if (args.sort_by)    params.sort_by    = String(args.sort_by);
    if (args.limit)      params.limit      = Number(args.limit);
    if (args.offset)     params.offset     = Number(args.offset);
    if (args.open_now !== undefined) params.open_now = args.open_now ? "true" : "false";
    const data = await yelpGet(apiKey, "/businesses/search", params);
    return {
      total:      data.total,
      businesses: data.businesses,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function yelpGetBusiness(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const id = String(args.id ?? "").trim();
    if (!id) return { error: "id is required (Yelp business alias or ID)." };
    const data = await yelpGet(apiKey, `/businesses/${encodeURIComponent(id)}`);
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function yelpGetReviews(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const id = String(args.id ?? "").trim();
    if (!id) return { error: "id is required (Yelp business alias or ID)." };
    const params: Record<string, string | number> = {};
    if (args.sort_by)  params.sort_by  = String(args.sort_by);
    if (args.limit)    params.limit    = Number(args.limit);
    if (args.offset)   params.offset   = Number(args.offset);
    if (args.language) params.language = String(args.language);
    const data = await yelpGet(apiKey, `/businesses/${encodeURIComponent(id)}/reviews`, params);
    return {
      total:    data.total,
      reviews:  data.reviews,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function yelpSearchEvents(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const params: Record<string, string | number> = {};
    if (args.location)   params.location   = String(args.location);
    if (args.latitude)   params.latitude   = Number(args.latitude);
    if (args.longitude)  params.longitude  = Number(args.longitude);
    if (args.category)   params.categories = String(args.category);
    if (args.start_date) params.start_date = String(args.start_date);
    if (args.end_date)   params.end_date   = String(args.end_date);
    if (args.limit)      params.limit      = Number(args.limit);
    if (args.offset)     params.offset     = Number(args.offset);
    const data = await yelpGet(apiKey, "/events", params);
    return {
      total:  data.total,
      events: data.events,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function yelpGetAutocomplete(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const text = String(args.text ?? "").trim();
    if (!text) return { error: "text is required." };
    const params: Record<string, string | number> = { text };
    if (args.latitude)  params.latitude  = Number(args.latitude);
    if (args.longitude) params.longitude = Number(args.longitude);
    if (args.locale)    params.locale    = String(args.locale);
    const data = await yelpGet(apiKey, "/autocomplete", params);
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
