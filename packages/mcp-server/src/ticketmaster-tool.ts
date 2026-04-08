// ── Ticketmaster Discovery API tool ────────────────────────────────────────────
// Uses the Ticketmaster Discovery API v2 (https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/)
// Free tier with API key auth.
// Env var: TICKETMASTER_API_KEY

const TM_BASE = "https://app.ticketmaster.com/discovery/v2";

async function tmGet(
  apiKey: string,
  path: string,
  params: Record<string, string | number | boolean>
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({ apikey: apiKey });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const res = await fetch(`${TM_BASE}${path}?${qs}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ticketmaster API HTTP ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

function getApiKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.TICKETMASTER_API_KEY ?? "").trim();
  if (!key) throw new Error("api_key is required (or set TICKETMASTER_API_KEY env var).");
  return key;
}

// ── Tool functions ─────────────────────────────────────────────────────────────

export async function tmSearchEvents(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const params: Record<string, string | number> = {};
    if (args.keyword)    params.keyword    = String(args.keyword);
    if (args.city)       params.city       = String(args.city);
    if (args.country)    params.countryCode = String(args.country);
    if (args.start_date) params.startDateTime = String(args.start_date);
    if (args.end_date)   params.endDateTime   = String(args.end_date);
    if (args.classification) params.classificationName = String(args.classification);
    if (args.size)       params.size       = Number(args.size);
    if (args.page)       params.page       = Number(args.page);
    if (args.sort)       params.sort       = String(args.sort);
    const data = await tmGet(apiKey, "/events.json", params);
    const embedded = data._embedded as Record<string, unknown> | undefined;
    const page = data.page as Record<string, unknown> | undefined;
    return {
      total_elements: page?.totalElements,
      total_pages:    page?.totalPages,
      page:           page?.number,
      events: (embedded?.events as unknown[]) ?? [],
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function tmGetEvent(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const id = String(args.id ?? "").trim();
    if (!id) return { error: "id is required." };
    const data = await tmGet(apiKey, `/events/${encodeURIComponent(id)}.json`, {});
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function tmSearchVenues(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const params: Record<string, string | number> = {};
    if (args.keyword)  params.keyword   = String(args.keyword);
    if (args.city)     params.city      = String(args.city);
    if (args.country)  params.countryCode = String(args.country);
    if (args.state)    params.stateCode  = String(args.state);
    if (args.size)     params.size       = Number(args.size);
    if (args.page)     params.page       = Number(args.page);
    const data = await tmGet(apiKey, "/venues.json", params);
    const embedded = data._embedded as Record<string, unknown> | undefined;
    const page = data.page as Record<string, unknown> | undefined;
    return {
      total_elements: page?.totalElements,
      venues: (embedded?.venues as unknown[]) ?? [],
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function tmGetVenue(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const id = String(args.id ?? "").trim();
    if (!id) return { error: "id is required." };
    const data = await tmGet(apiKey, `/venues/${encodeURIComponent(id)}.json`, {});
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function tmSearchAttractions(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const params: Record<string, string | number> = {};
    if (args.keyword)        params.keyword        = String(args.keyword);
    if (args.classification) params.classificationName = String(args.classification);
    if (args.size)           params.size           = Number(args.size);
    if (args.page)           params.page           = Number(args.page);
    const data = await tmGet(apiKey, "/attractions.json", params);
    const embedded = data._embedded as Record<string, unknown> | undefined;
    const page = data.page as Record<string, unknown> | undefined;
    return {
      total_elements: page?.totalElements,
      attractions: (embedded?.attractions as unknown[]) ?? [],
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
