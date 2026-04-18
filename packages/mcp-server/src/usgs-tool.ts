// ─── USGS Earthquake Data ─────────────────────────────────────────────────────
// Free USGS Earthquake Hazards Program API - no auth required.
// Docs: https://earthquake.usgs.gov/fdsnws/event/1/

const USGS_BASE = "https://earthquake.usgs.gov/fdsnws/event/1";

// ─── API helper ──────────────────────────────────────────────────────────────

async function usgsFetch<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(`${USGS_BASE}/query`);
  url.searchParams.set("format", "geojson");
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`USGS API HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

interface GeoJsonFeature {
  id:         string;
  properties: Record<string, unknown>;
  geometry:   { coordinates: [number, number, number] };
}

interface GeoJsonResponse {
  metadata: Record<string, unknown>;
  features: GeoJsonFeature[];
}

function mapFeature(f: GeoJsonFeature) {
  const p = f.properties;
  const [lon, lat, depth] = f.geometry.coordinates;
  return {
    id:        f.id,
    magnitude: p.mag,
    place:     p.place,
    time:      p.time ? new Date(p.time as number).toISOString() : null,
    updated:   p.updated ? new Date(p.updated as number).toISOString() : null,
    url:       p.url,
    status:    p.status,
    type:      p.type,
    lat,
    lon,
    depth_km:  depth,
    felt:      p.felt ?? null,
    tsunami:   p.tsunami === 1,
    alert:     p.alert ?? null,
  };
}

// ─── Operations ──────────────────────────────────────────────────────────────

export async function getRecentEarthquakes(
  args: Record<string, unknown>
): Promise<unknown> {
  const limit    = String(Math.min(500, Math.max(1, Number(args.limit ?? 10))));
  const minMag   = String(args.min_magnitude ?? args.minmagnitude ?? "");
  const startTime = String(args.start_time ?? "");
  const endTime   = String(args.end_time ?? "");

  const params: Record<string, string> = { limit };
  if (minMag)    params.minmagnitude = minMag;
  if (startTime) params.starttime    = startTime;
  if (endTime)   params.endtime      = endTime;

  const data = await usgsFetch<GeoJsonResponse>(params);

  return {
    count:       data.features.length,
    generated:   data.metadata?.generated
      ? new Date(data.metadata.generated as number).toISOString()
      : null,
    earthquakes: data.features.map(mapFeature),
  };
}

export async function getEarthquakeDetail(
  args: Record<string, unknown>
): Promise<unknown> {
  const eventId = String(args.event_id ?? "").trim();
  if (!eventId) throw new Error("event_id is required.");

  const url = new URL(`${USGS_BASE}/query`);
  url.searchParams.set("format", "geojson");
  url.searchParams.set("eventid", eventId);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`USGS API HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json() as GeoJsonFeature;

  const p = data.properties;
  const [lon, lat, depth] = data.geometry.coordinates;
  return {
    id:           data.id,
    magnitude:    p.mag,
    place:        p.place,
    time:         p.time ? new Date(p.time as number).toISOString() : null,
    url:          p.url,
    detail:       p.detail,
    status:       p.status,
    type:         p.type,
    lat,
    lon,
    depth_km:     depth,
    felt:         p.felt ?? null,
    cdi:          p.cdi ?? null,
    mmi:          p.mmi ?? null,
    alert:        p.alert ?? null,
    tsunami:      p.tsunami === 1,
    sig:          p.sig ?? null,
    net:          p.net ?? null,
    sources:      p.sources ?? null,
    products:     p.products ? Object.keys(p.products as object) : [],
  };
}

export async function getEarthquakesByRegion(
  args: Record<string, unknown>
): Promise<unknown> {
  const lat    = Number(args.lat);
  const lon    = Number(args.lon);
  const radius = Number(args.radius ?? 500);

  if (!Number.isFinite(lat)) throw new Error("lat is required (decimal degrees).");
  if (!Number.isFinite(lon)) throw new Error("lon is required (decimal degrees).");

  const limit  = String(Math.min(500, Math.max(1, Number(args.limit ?? 20))));
  const minMag = String(args.min_magnitude ?? "");

  const params: Record<string, string> = {
    latitude:  String(lat),
    longitude: String(lon),
    maxradius: String(Math.min(20000, radius)),
    limit,
  };
  if (minMag) params.minmagnitude = minMag;

  const data = await usgsFetch<GeoJsonResponse>(params);

  return {
    lat,
    lon,
    radius_km:   radius,
    count:       data.features.length,
    earthquakes: data.features.map(mapFeature),
  };
}

// ─── Public dispatcher ────────────────────────────────────────────────────────

export async function usgsAction(
  action: string,
  args:   Record<string, unknown>
): Promise<unknown> {
  switch (action) {
    case "get_recent_earthquakes":    return getRecentEarthquakes(args);
    case "get_earthquake_detail":     return getEarthquakeDetail(args);
    case "get_earthquakes_by_region": return getEarthquakesByRegion(args);
    default:
      return {
        error:
          `Unknown USGS action: "${action}". ` +
          "Valid: get_recent_earthquakes, get_earthquake_detail, get_earthquakes_by_region.",
      };
  }
}
