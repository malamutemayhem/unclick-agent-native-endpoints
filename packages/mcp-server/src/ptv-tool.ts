// ── PTV Timetable API (Public Transport Victoria) ─────────────────────────────
// V3 REST API for Melbourne and Victoria public transport timetables.
// Docs: https://ptv.vic.gov.au/ptv-timetable-api
//
// Auth: HMAC-SHA1 signature on every request.
// The signature string is:  {path}?{querystring}&devid={userid}
// Sign it with the API key as the HMAC-SHA1 secret, then append:
//   &signature={HMAC_HEX_UPPERCASE}
//
// Route types: 0=Train, 1=Tram, 2=Bus, 3=Vline, 4=Night Bus
//
// Source: Licensed from Public Transport Victoria under a Creative Commons
// Attribution 4.0 International Licence.
//
// Env vars: PTV_USER_ID, PTV_API_KEY

import { createHmac } from "crypto";

const PTV_BASE = "https://timetableapi.ptv.vic.gov.au";

function buildPtvUrl(
  userId: string,
  apiKey: string,
  path: string,
  params: Record<string, string | number | boolean>
): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  qs.set("devid", userId);
  const queryString = qs.toString();
  const toSign = `${path}?${queryString}`;
  const signature = createHmac("sha1", apiKey)
    .update(toSign)
    .digest("hex")
    .toUpperCase();
  return `${PTV_BASE}${path}?${queryString}&signature=${signature}`;
}

async function ptvGet(
  userId: string,
  apiKey: string,
  path: string,
  params: Record<string, string | number | boolean> = {}
): Promise<Record<string, unknown>> {
  const url = buildPtvUrl(userId, apiKey, path, params);
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PTV API HTTP ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

function getCredentials(args: Record<string, unknown>): { userId: string; apiKey: string } {
  const userId  = String(args.user_id  ?? process.env.PTV_USER_ID  ?? "").trim();
  const apiKey  = String(args.api_key  ?? process.env.PTV_API_KEY  ?? "").trim();
  if (!userId)  throw new Error("user_id is required (or set PTV_USER_ID env var).");
  if (!apiKey)  throw new Error("api_key is required (or set PTV_API_KEY env var).");
  return { userId, apiKey };
}

// ── Route type helper ──────────────────────────────────────────────────────────

function resolveRouteType(value: unknown): number {
  const map: Record<string, number> = {
    train: 0, tram: 1, bus: 2, vline: 3, "night bus": 4,
  };
  const n = Number(value);
  if (!isNaN(n)) return n;
  return map[String(value).toLowerCase()] ?? 0;
}

// ── Tool functions ─────────────────────────────────────────────────────────────

export async function ptvGetDepartures(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { userId, apiKey } = getCredentials(args);
    const stopId    = String(args.stop_id    ?? "").trim();
    const routeType = resolveRouteType(args.route_type ?? 0);
    if (!stopId) return { error: "stop_id is required." };
    const params: Record<string, string | number> = {};
    if (args.max_results) params.max_results = Number(args.max_results);
    if (args.route_id)    params.route_id    = Number(args.route_id);
    if (args.expand)      params.expand      = String(args.expand);
    const data = await ptvGet(
      userId, apiKey,
      `/v3/departures/route_type/${routeType}/stop/${encodeURIComponent(stopId)}`,
      params
    );
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function ptvSearch(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { userId, apiKey } = getCredentials(args);
    const searchTerm = String(args.search_term ?? "").trim();
    if (!searchTerm) return { error: "search_term is required." };
    const params: Record<string, string | number> = {};
    if (args.route_types !== undefined) params.route_types = String(args.route_types);
    if (args.include_outlets !== undefined) params.include_outlets = args.include_outlets ? 1 : 0;
    const data = await ptvGet(
      userId, apiKey,
      `/v3/search/${encodeURIComponent(searchTerm)}`,
      params
    );
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function ptvGetStopsOnRoute(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { userId, apiKey } = getCredentials(args);
    const routeId   = String(args.route_id   ?? "").trim();
    const routeType = resolveRouteType(args.route_type ?? 0);
    if (!routeId) return { error: "route_id is required." };
    const params: Record<string, string | number> = {};
    if (args.direction_id) params.direction_id = Number(args.direction_id);
    const data = await ptvGet(
      userId, apiKey,
      `/v3/stops/route/${encodeURIComponent(routeId)}/route_type/${routeType}`,
      params
    );
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function ptvGetDisruptions(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { userId, apiKey } = getCredentials(args);
    const params: Record<string, string | number> = {};
    if (args.route_types !== undefined) params.route_types = String(args.route_types);
    if (args.disruption_status) params.disruption_status = String(args.disruption_status);
    const data = await ptvGet(userId, apiKey, "/v3/disruptions", params);
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function ptvGetRouteDirections(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { userId, apiKey } = getCredentials(args);
    const routeId = String(args.route_id ?? "").trim();
    if (!routeId) return { error: "route_id is required." };
    const data = await ptvGet(
      userId, apiKey,
      `/v3/directions/route/${encodeURIComponent(routeId)}`
    );
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function ptvGetRuns(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { userId, apiKey } = getCredentials(args);
    const routeId   = String(args.route_id   ?? "").trim();
    const routeType = resolveRouteType(args.route_type ?? 0);
    if (!routeId) return { error: "route_id is required." };
    const params: Record<string, string | number> = {};
    if (args.date_utc) params.date_utc = String(args.date_utc);
    const data = await ptvGet(
      userId, apiKey,
      `/v3/runs/route/${encodeURIComponent(routeId)}/route_type/${routeType}`,
      params
    );
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function ptvGetStopDetails(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { userId, apiKey } = getCredentials(args);
    const stopId    = String(args.stop_id    ?? "").trim();
    const routeType = resolveRouteType(args.route_type ?? 0);
    if (!stopId) return { error: "stop_id is required." };
    const params: Record<string, number> = { stop_location: 1, stop_amenities: 1, stop_accessibility: 1 };
    const data = await ptvGet(
      userId, apiKey,
      `/v3/stops/${encodeURIComponent(stopId)}/route_type/${routeType}`,
      params
    );
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
