// Open-Meteo weather API integration.
// No authentication required — completely free and open.
// Base URL: https://api.open-meteo.com/v1/
// Geocoding: https://geocoding-api.open-meteo.com/v1/search

const WEATHER_BASE = "https://api.open-meteo.com/v1";
const GEO_BASE = "https://geocoding-api.open-meteo.com/v1";

// ─── WMO weather code descriptions ───────────────────────────────────────────

const WMO_CODES: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Depositing rime fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Slight showers", 81: "Moderate showers", 82: "Violent showers",
  85: "Slight snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
};

// ─── Geocoding helper ─────────────────────────────────────────────────────────

interface GeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  country_code: string;
  admin1?: string;
}

async function resolveLocation(
  args: Record<string, unknown>
): Promise<{ latitude: number; longitude: number; location_name: string } | { error: string }> {
  if (args.latitude !== undefined && args.longitude !== undefined) {
    return {
      latitude: Number(args.latitude),
      longitude: Number(args.longitude),
      location_name: `${args.latitude}, ${args.longitude}`,
    };
  }

  const city = String(args.city ?? "").trim();
  if (!city) {
    return { error: "Provide either (latitude + longitude) or city." };
  }

  const res = await fetch(
    `${GEO_BASE}/search?name=${encodeURIComponent(city)}&count=1&format=json`,
    { headers: { "User-Agent": "UnClickMCP/1.0 (https://unclick.io)" } }
  );
  if (!res.ok) throw new Error(`Geocoding API HTTP ${res.status}`);

  const data = await res.json() as { results?: GeoResult[] };
  const place = data.results?.[0];
  if (!place) return { error: `City "${city}" not found.` };

  return {
    latitude: place.latitude,
    longitude: place.longitude,
    location_name: [place.name, place.admin1, place.country].filter(Boolean).join(", "),
  };
}

async function weatherFetch(params: URLSearchParams): Promise<unknown> {
  const url = `${WEATHER_BASE}/forecast?${params}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "UnClickMCP/1.0 (https://unclick.io)" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Open-Meteo HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  return res.json() as Promise<unknown>;
}

// ─── weather_current ──────────────────────────────────────────────────────────

export async function weatherCurrent(args: Record<string, unknown>): Promise<unknown> {
  const loc = await resolveLocation(args);
  if ("error" in loc) return loc;

  const params = new URLSearchParams({
    latitude: String(loc.latitude),
    longitude: String(loc.longitude),
    current_weather: "true",
    timezone: "auto",
  });

  const data = await weatherFetch(params) as Record<string, unknown>;
  const cw = data["current_weather"] as Record<string, unknown> | undefined;

  return {
    location: loc.location_name,
    latitude: loc.latitude,
    longitude: loc.longitude,
    time: cw?.["time"] ?? null,
    temperature_c: cw?.["temperature"] ?? null,
    wind_speed_kmh: cw?.["windspeed"] ?? null,
    wind_direction_deg: cw?.["winddirection"] ?? null,
    weather_code: cw?.["weathercode"] ?? null,
    weather_description: WMO_CODES[Number(cw?.["weathercode"])] ?? "Unknown",
    is_day: cw?.["is_day"] === 1,
  };
}

// ─── weather_forecast ────────────────────────────────────────────────────────

export async function weatherForecast(args: Record<string, unknown>): Promise<unknown> {
  const loc = await resolveLocation(args);
  if ("error" in loc) return loc;

  const days = Math.min(16, Math.max(1, Number(args.days ?? 7)));

  const params = new URLSearchParams({
    latitude: String(loc.latitude),
    longitude: String(loc.longitude),
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "windspeed_10m_max",
      "weathercode",
    ].join(","),
    forecast_days: String(days),
    timezone: "auto",
  });

  const data = await weatherFetch(params) as Record<string, unknown>;
  const daily = data["daily"] as Record<string, unknown[]> | undefined;
  const dates = (daily?.["time"] ?? []) as string[];

  const forecast = dates.map((date, i) => ({
    date,
    temp_max_c: daily?.["temperature_2m_max"]?.[i] ?? null,
    temp_min_c: daily?.["temperature_2m_min"]?.[i] ?? null,
    precipitation_mm: daily?.["precipitation_sum"]?.[i] ?? null,
    wind_speed_max_kmh: daily?.["windspeed_10m_max"]?.[i] ?? null,
    weather_code: daily?.["weathercode"]?.[i] ?? null,
    weather_description: WMO_CODES[Number(daily?.["weathercode"]?.[i])] ?? "Unknown",
  }));

  return {
    location: loc.location_name,
    latitude: loc.latitude,
    longitude: loc.longitude,
    days: forecast.length,
    timezone: data["timezone"] ?? null,
    forecast,
  };
}

// ─── weather_hourly ───────────────────────────────────────────────────────────

export async function weatherHourly(args: Record<string, unknown>): Promise<unknown> {
  const loc = await resolveLocation(args);
  if ("error" in loc) return loc;

  const params = new URLSearchParams({
    latitude: String(loc.latitude),
    longitude: String(loc.longitude),
    hourly: [
      "temperature_2m",
      "precipitation",
      "windspeed_10m",
      "weathercode",
      "relativehumidity_2m",
    ].join(","),
    forecast_days: "2",
    timezone: "auto",
  });

  const data = await weatherFetch(params) as Record<string, unknown>;
  const hourly = data["hourly"] as Record<string, unknown[]> | undefined;
  const times = (hourly?.["time"] ?? []) as string[];

  // Return next 48 hours
  const hours = times.slice(0, 48).map((time, i) => ({
    time,
    temperature_c: hourly?.["temperature_2m"]?.[i] ?? null,
    precipitation_mm: hourly?.["precipitation"]?.[i] ?? null,
    wind_speed_kmh: hourly?.["windspeed_10m"]?.[i] ?? null,
    humidity_pct: hourly?.["relativehumidity_2m"]?.[i] ?? null,
    weather_code: hourly?.["weathercode"]?.[i] ?? null,
    weather_description: WMO_CODES[Number(hourly?.["weathercode"]?.[i])] ?? "Unknown",
  }));

  return {
    location: loc.location_name,
    latitude: loc.latitude,
    longitude: loc.longitude,
    timezone: data["timezone"] ?? null,
    hours: hours.length,
    hourly: hours,
  };
}
