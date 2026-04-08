// Public Transport Victoria (PTV) Timetable API v3 integration.
// Source: Licensed from Public Transport Victoria under a Creative Commons Attribution 4.0 International Licence.
// HMAC-SHA1 signature required on every request.
// Env vars: PTV_USER_ID, PTV_API_KEY

import { createHmac } from "node:crypto";

const PTV_BASE = "https://timetableapi.ptv.vic.gov.au";

// ─── Signature helper ─────────────────────────────────────────────────────────

function buildPtvUrl(path: string, params: Record<string, string>): string {
  const userId = process.env["PTV_USER_ID"] ?? "3003726";
  const apiKey = process.env["PTV_API_KEY"] ?? "4feb0abc-01a2-438f-a1ac-602e4bce0df1";

  // Add devid to query params before signing
  const allParams = new URLSearchParams({ ...params, devid: userId });
  const querystring = allParams.toString();

  // Sign: HMAC-SHA1(path + "?" + querystring, apiKey) as uppercase hex
  const signingString = `${path}?${querystring}`;
  const signature = createHmac("sha1", apiKey)
    .update(signingString)
    .digest("hex")
    .toUpperCase();

  return `${PTV_BASE}${path}?${querystring}&signature=${signature}`;
}

async function ptvFetch(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = buildPtvUrl(path, params);
  const res = await fetch(url, {
    headers: { "User-Agent": "UnClickMCP/1.0 (https://unclick.io)" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PTV API HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  return res.json() as Promise<unknown>;
}

// Route type codes
// 0 = Train (metro), 1 = Tram, 2 = Bus, 3 = Vline (regional train), 4 = Night Bus

// ─── ptv_search ───────────────────────────────────────────────────────────────
// GET /v3/search/{query}

export async function ptvSearch(args: Record<string, unknown>): Promise<unknown> {
  const query = String(args.query ?? "").trim();
  if (!query) return { error: "query is required." };

  return ptvFetch(`/v3/search/${encodeURIComponent(query)}`);
}

// ─── ptv_departures ───────────────────────────────────────────────────────────
// GET /v3/departures/route_type/{route_type}/stop/{stop_id}

export async function ptvDepartures(args: Record<string, unknown>): Promise<unknown> {
  const stopId = String(args.stop_id ?? "").trim();
  if (!stopId) return { error: "stop_id is required." };

  const routeType = Number(args.route_type ?? 0);
  const params: Record<string, string> = {};

  if (args.max_results) params["max_results"] = String(Math.min(20, Number(args.max_results)));
  if (args.route_id) params["route_id"] = String(args.route_id);
  if (args.direction_id) params["direction_id"] = String(args.direction_id);
  if (args.look_backwards === true) params["look_backwards"] = "true";
  if (args.include_cancelled === true) params["include_cancelled"] = "true";

  return ptvFetch(`/v3/departures/route_type/${routeType}/stop/${stopId}`, params);
}

// ─── ptv_disruptions ──────────────────────────────────────────────────────────
// GET /v3/disruptions

export async function ptvDisruptions(args: Record<string, unknown>): Promise<unknown> {
  const params: Record<string, string> = {};

  if (args.route_type !== undefined) {
    params["route_types"] = String(args.route_type);
  }
  if (args.disruption_status) {
    params["disruption_status"] = String(args.disruption_status);
  }

  return ptvFetch("/v3/disruptions", params);
}

// ─── ptv_stops_on_route ───────────────────────────────────────────────────────
// GET /v3/stops/route/{route_id}/route_type/{route_type}

export async function ptvStopsOnRoute(args: Record<string, unknown>): Promise<unknown> {
  const routeId = String(args.route_id ?? "").trim();
  if (!routeId) return { error: "route_id is required." };

  const routeType = Number(args.route_type ?? 0);
  const params: Record<string, string> = {};

  if (args.direction_id) params["direction_id"] = String(args.direction_id);

  return ptvFetch(`/v3/stops/route/${routeId}/route_type/${routeType}`, params);
}

// ─── ptv_route_directions ────────────────────────────────────────────────────
// GET /v3/directions/route/{route_id}

export async function ptvRouteDirections(args: Record<string, unknown>): Promise<unknown> {
  const routeId = String(args.route_id ?? "").trim();
  if (!routeId) return { error: "route_id is required." };

  return ptvFetch(`/v3/directions/route/${routeId}`);
}
