// ── SeatGeek API tool ───────────────────────────────────────────────────────────
// SeatGeek Platform API for events, performers, and venues.
// Docs: https://platform.seatgeek.com/
// Env var: SEATGEEK_CLIENT_ID

const SEATGEEK_BASE = "https://api.seatgeek.com/2";

async function seatgeekGet(
  clientId: string,
  path: string,
  params: Record<string, string | number | boolean> = {}
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({ client_id: clientId });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const res = await fetch(`${SEATGEEK_BASE}${path}?${qs}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SeatGeek API HTTP ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

function getClientId(args: Record<string, unknown>): string {
  const id = String(args.client_id ?? process.env.SEATGEEK_CLIENT_ID ?? "").trim();
  if (!id) throw new Error("client_id is required (or set SEATGEEK_CLIENT_ID env var).");
  return id;
}

// ── Tool functions ─────────────────────────────────────────────────────────────

export async function seatgeekSearchEvents(args: Record<string, unknown>): Promise<unknown> {
  try {
    const clientId = getClientId(args);
    const params: Record<string, string | number> = {};
    if (args.query)          params.q              = String(args.query);
    if (args.venue_id)       params["venue.id"]    = String(args.venue_id);
    if (args.type)           params.type           = String(args.type);
    if (args.datetime_local) params.datetime_local = String(args.datetime_local);
    if (args.city)           params["venue.city"]  = String(args.city);
    if (args.state)          params["venue.state"] = String(args.state);
    if (args.country)        params["venue.country"] = String(args.country);
    if (args.per_page)       params.per_page       = Number(args.per_page);
    if (args.page)           params.page           = Number(args.page);
    const data = await seatgeekGet(clientId, "/events", params);
    return {
      total:  data.meta ? (data.meta as Record<string, unknown>).total : undefined,
      events: data.events,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function seatgeekGetEvent(args: Record<string, unknown>): Promise<unknown> {
  try {
    const clientId = getClientId(args);
    const id = String(args.id ?? "").trim();
    if (!id) return { error: "id is required." };
    const data = await seatgeekGet(clientId, `/events/${encodeURIComponent(id)}`);
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function seatgeekSearchPerformers(args: Record<string, unknown>): Promise<unknown> {
  try {
    const clientId = getClientId(args);
    const query = String(args.query ?? "").trim();
    if (!query) return { error: "query is required." };
    const params: Record<string, string | number> = { q: query };
    if (args.per_page) params.per_page = Number(args.per_page);
    if (args.page)     params.page     = Number(args.page);
    const data = await seatgeekGet(clientId, "/performers", params);
    return {
      total:      data.meta ? (data.meta as Record<string, unknown>).total : undefined,
      performers: data.performers,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function seatgeekGetPerformer(args: Record<string, unknown>): Promise<unknown> {
  try {
    const clientId = getClientId(args);
    const id = String(args.id ?? "").trim();
    if (!id) return { error: "id is required." };
    const data = await seatgeekGet(clientId, `/performers/${encodeURIComponent(id)}`);
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function seatgeekSearchVenues(args: Record<string, unknown>): Promise<unknown> {
  try {
    const clientId = getClientId(args);
    const params: Record<string, string | number> = {};
    if (args.query)   params.q                = String(args.query);
    if (args.city)    params["venue.city"]    = String(args.city);
    if (args.state)   params["venue.state"]   = String(args.state);
    if (args.country) params["venue.country"] = String(args.country);
    if (args.per_page) params.per_page        = Number(args.per_page);
    if (args.page)    params.page             = Number(args.page);
    const data = await seatgeekGet(clientId, "/venues", params);
    return {
      total:  data.meta ? (data.meta as Record<string, unknown>).total : undefined,
      venues: data.venues,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function seatgeekGetVenue(args: Record<string, unknown>): Promise<unknown> {
  try {
    const clientId = getClientId(args);
    const id = String(args.id ?? "").trim();
    if (!id) return { error: "id is required." };
    const data = await seatgeekGet(clientId, `/venues/${encodeURIComponent(id)}`);
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
