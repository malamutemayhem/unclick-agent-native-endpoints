// ─── OpenAQ Air Quality Data ──────────────────────────────────────────────────
// OpenAQ v3 API for real-time and historical air quality measurements.
// Auth: OPENAQ_API_KEY env or api_key arg (X-API-Key header).
// Docs: https://docs.openaq.io/

const OPENAQ_BASE = "https://api.openaq.io/v3";

// ─── API helper ──────────────────────────────────────────────────────────────

function getKey(args: Record<string, unknown>): string {
  return String(args.api_key ?? process.env.OPENAQ_API_KEY ?? "").trim();
}

async function openaqFetch<T>(
  path: string,
  params: Record<string, string>,
  apiKey: string
): Promise<T> {
  const url = new URL(`${OPENAQ_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }

  const headers: Record<string, string> = { "Accept": "application/json" };
  if (apiKey) headers["X-API-Key"] = apiKey;

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg  = body.detail ?? body.message ?? `HTTP ${res.status}`;
    throw new Error(`OpenAQ API error: ${String(msg)}`);
  }
  return res.json() as Promise<T>;
}

// ─── Operations ──────────────────────────────────────────────────────────────

export async function getAirQuality(
  args: Record<string, unknown>
): Promise<unknown> {
  const apiKey = getKey(args);
  const city   = String(args.city ?? "").trim();
  const lat    = args.lat !== undefined ? Number(args.lat) : null;
  const lon    = args.lon !== undefined ? Number(args.lon) : null;
  const limit  = String(Math.min(100, Math.max(1, Number(args.limit ?? 10))));

  const params: Record<string, string> = { limit };

  if (lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon)) {
    params.coordinates = `${lat},${lon}`;
    params.radius      = String(args.radius ?? 25000);
  } else if (city) {
    params.city = city;
  } else {
    throw new Error("Either city or lat+lon is required.");
  }

  interface LocationsResponse {
    meta:    Record<string, unknown>;
    results: Record<string, unknown>[];
  }

  const data = await openaqFetch<LocationsResponse>("/locations", params, apiKey);

  return {
    count:     data.meta?.found ?? data.results.length,
    locations: data.results.map((loc) => ({
      id:          loc.id,
      name:        loc.name,
      city:        loc.city ?? null,
      country:     (loc.country as Record<string, unknown>)?.code ?? loc.country ?? null,
      lat:         (loc.coordinates as Record<string, unknown>)?.latitude ?? null,
      lon:         (loc.coordinates as Record<string, unknown>)?.longitude ?? null,
      is_mobile:   loc.isMobile ?? false,
      is_monitor:  loc.isMonitor ?? false,
      sensors:     Array.isArray(loc.sensors)
        ? (loc.sensors as Record<string, unknown>[]).map((s) => ({
            id:        s.id,
            parameter: (s.parameter as Record<string, unknown>)?.name ?? s.parameter,
            unit:      (s.parameter as Record<string, unknown>)?.units ?? null,
          }))
        : [],
      last_updated: loc.datetimeLast
        ? (loc.datetimeLast as Record<string, unknown>).utc ?? null
        : null,
    })),
  };
}

export async function getAirMeasurements(
  args: Record<string, unknown>
): Promise<unknown> {
  const apiKey     = getKey(args);
  const locationId = String(args.location_id ?? "").trim();
  if (!locationId) throw new Error("location_id is required.");

  const parameter = String(args.parameter ?? "").toLowerCase().trim();
  const limit     = String(Math.min(1000, Math.max(1, Number(args.limit ?? 100))));

  const params: Record<string, string> = { limit };
  if (parameter) params.parameters_id = parameter;

  interface SensorsResponse {
    meta:    Record<string, unknown>;
    results: Record<string, unknown>[];
  }

  // Get sensors for this location, then measurements
  const sensors = await openaqFetch<SensorsResponse>(
    `/locations/${locationId}/sensors`,
    {},
    apiKey
  );

  // Filter by parameter if provided
  let filteredSensors = sensors.results;
  if (parameter) {
    filteredSensors = filteredSensors.filter((s) => {
      const paramName = String(
        (s.parameter as Record<string, unknown>)?.name ?? ""
      ).toLowerCase();
      return paramName.includes(parameter);
    });
  }

  interface MeasurementResponse {
    meta:    Record<string, unknown>;
    results: Record<string, unknown>[];
  }

  const measurements: unknown[] = [];
  for (const sensor of filteredSensors.slice(0, 5)) {
    const sensorId = String(sensor.id);
    const mData = await openaqFetch<MeasurementResponse>(
      `/sensors/${sensorId}/measurements`,
      { limit: String(Math.min(50, Number(limit))) },
      apiKey
    );
    for (const m of mData.results) {
      measurements.push({
        sensor_id:  sensorId,
        parameter:  (sensor.parameter as Record<string, unknown>)?.name ?? null,
        unit:       (sensor.parameter as Record<string, unknown>)?.units ?? null,
        value:      (m.value as Record<string, unknown>)?.value ?? m.value,
        date:       (m.period as Record<string, unknown>)?.datetimeFrom
          ? ((m.period as Record<string, unknown>).datetimeFrom as Record<string, unknown>)?.utc
          : null,
      });
    }
  }

  return {
    location_id:  locationId,
    parameter:    parameter || "all",
    count:        measurements.length,
    measurements,
  };
}

export async function getAqCountries(
  args: Record<string, unknown>
): Promise<unknown> {
  const apiKey = getKey(args);
  const limit  = String(Math.min(200, Math.max(1, Number(args.limit ?? 100))));

  interface CountriesResponse {
    meta:    Record<string, unknown>;
    results: Record<string, unknown>[];
  }

  const data = await openaqFetch<CountriesResponse>(
    "/countries",
    { limit },
    apiKey
  );

  return {
    count:     data.meta?.found ?? data.results.length,
    countries: data.results.map((c) => ({
      code:              c.code,
      name:              c.name,
      locations:         c.locationsCount ?? null,
      first_updated:     c.firstUpdated   ?? null,
      last_updated:      c.lastUpdated    ?? null,
    })),
  };
}

// ─── Public dispatcher ────────────────────────────────────────────────────────

export async function openaqAction(
  action: string,
  args:   Record<string, unknown>
): Promise<unknown> {
  switch (action) {
    case "get_air_quality":     return getAirQuality(args);
    case "get_air_measurements": return getAirMeasurements(args);
    case "get_aq_countries":    return getAqCountries(args);
    default:
      return {
        error:
          `Unknown OpenAQ action: "${action}". ` +
          "Valid: get_air_quality, get_air_measurements, get_aq_countries.",
      };
  }
}
