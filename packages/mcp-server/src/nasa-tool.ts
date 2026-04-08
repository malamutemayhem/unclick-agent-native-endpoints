// NASA Open APIs integration for the UnClick MCP server.
// Uses NASA's public APIs via fetch - no external dependencies.
// Get a free API key at https://api.nasa.gov/ or use DEMO_KEY for low-volume access.

const NASA_BASE = "https://api.nasa.gov";

// ─── API helper ──────────────────────────────────────────────────────────────

function getKey(args: Record<string, unknown>): string {
  return String(
    args.api_key ?? process.env.NASA_API_KEY ?? "DEMO_KEY"
  ).trim();
}

async function nasaFetch<T>(
  path: string,
  params: Record<string, string>
): Promise<T> {
  const url = new URL(`${NASA_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const errMsg = (body.error as Record<string, unknown> | undefined)?.message ?? body.msg ?? "Unknown error";
    throw new Error(`NASA API HTTP ${res.status}: ${String(errMsg)}`);
  }
  return res.json() as Promise<T>;
}

// ─── Operations ──────────────────────────────────────────────────────────────

export async function nasaApod(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = getKey(args);
  const params: Record<string, string> = { api_key: key };
  if (args.date) params.date = String(args.date);

  const data = (await nasaFetch<Record<string, unknown>>(
    "/planetary/apod",
    params
  )) as Record<string, unknown>;

  return {
    date: data.date,
    title: data.title,
    explanation: data.explanation,
    url: data.url,
    media_type: data.media_type,
    copyright: data.copyright ?? null,
    hdurl: data.hdurl ?? null,
  };
}

export async function nasaAsteroids(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = getKey(args);
  const startDate = String(args.start_date ?? "").trim();
  const endDate = String(args.end_date ?? "").trim();
  if (!startDate) throw new Error("start_date is required (YYYY-MM-DD).");
  if (!endDate) throw new Error("end_date is required (YYYY-MM-DD).");

  const data = (await nasaFetch<Record<string, unknown>>(
    "/neo/rest/v1/feed",
    { api_key: key, start_date: startDate, end_date: endDate }
  )) as Record<string, unknown>;

  const nearObjects = (data.near_earth_objects as Record<string, unknown[]>) ?? {};
  const asteroids: unknown[] = [];

  for (const [date, objects] of Object.entries(nearObjects)) {
    for (const obj of objects as Record<string, unknown>[]) {
      const approachData = (obj.close_approach_data as Record<string, unknown>[])?.[0] ?? {};
      const diameter = (obj.estimated_diameter as Record<string, unknown>) ?? {};
      const meters = (diameter.meters as Record<string, unknown>) ?? {};
      asteroids.push({
        id: obj.id,
        name: obj.name,
        date,
        is_potentially_hazardous: obj.is_potentially_hazardous_asteroid,
        diameter_meters_min: meters.estimated_diameter_min ?? null,
        diameter_meters_max: meters.estimated_diameter_max ?? null,
        miss_distance_km: (approachData.miss_distance as Record<string, unknown>)?.kilometers ?? null,
        relative_velocity_kph: (approachData.relative_velocity as Record<string, unknown>)?.kilometers_per_hour ?? null,
        url: obj.nasa_jpl_url ?? null,
      });
    }
  }

  return {
    element_count: data.element_count ?? asteroids.length,
    start_date: startDate,
    end_date: endDate,
    asteroids,
  };
}

export async function nasaMarsPhotos(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = getKey(args);
  const rover = String(args.rover ?? "curiosity").toLowerCase();
  const validRovers = ["curiosity", "opportunity", "spirit", "perseverance"];
  if (!validRovers.includes(rover)) {
    throw new Error(`rover must be one of: ${validRovers.join(", ")}`);
  }

  const params: Record<string, string> = { api_key: key };
  if (args.sol !== undefined) params.sol = String(args.sol);
  if (args.earth_date) params.earth_date = String(args.earth_date);
  if (args.camera) params.camera = String(args.camera);
  if (!args.sol && !args.earth_date) params.sol = "1000";

  const data = (await nasaFetch<Record<string, unknown>>(
    `/mars-photos/api/v1/rovers/${rover}/photos`,
    params
  )) as Record<string, unknown>;

  const photos = (data.photos as Record<string, unknown>[]) ?? [];

  return {
    rover,
    count: photos.length,
    photos: photos.slice(0, 25).map((p) => ({
      id: p.id,
      sol: p.sol,
      earth_date: p.earth_date,
      camera: (p.camera as Record<string, unknown>)?.full_name ?? null,
      img_src: p.img_src,
    })),
  };
}

export async function nasaEarthImagery(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = getKey(args);
  const lat = Number(args.lat);
  const lon = Number(args.lon);
  if (!Number.isFinite(lat)) throw new Error("lat is required (latitude as number).");
  if (!Number.isFinite(lon)) throw new Error("lon is required (longitude as number).");

  const params: Record<string, string> = {
    api_key: key,
    lat: String(lat),
    lon: String(lon),
    dim: "0.025",
  };
  if (args.date) params.date = String(args.date);

  const data = (await nasaFetch<Record<string, unknown>>(
    "/planetary/earth/imagery",
    params
  )) as Record<string, unknown>;

  return {
    lat,
    lon,
    date: data.date ?? args.date ?? null,
    url: data.url ?? null,
    resource: data.resource ?? null,
  };
}

export async function nasaEpic(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = getKey(args);
  const date = args.date ? String(args.date) : null;

  const path = date
    ? `/EPIC/api/natural/date/${date}`
    : "/EPIC/api/natural/images";

  const data = (await nasaFetch<unknown[]>(path, {
    api_key: key,
  })) as Record<string, unknown>[];

  return {
    count: data.length,
    date: date ?? "latest",
    images: data.slice(0, 10).map((img) => {
      const dateStr = String(img.date ?? "").replace(" ", "T");
      const datePart = dateStr.split("T")[0]?.replace(/-/g, "/") ?? "";
      return {
        identifier: img.identifier,
        caption: img.caption ?? null,
        date: img.date,
        centroid_coordinates: img.centroid_coordinates ?? null,
        image_url: datePart
          ? `https://epic.gsfc.nasa.gov/archive/natural/${datePart}/png/${img.image}.png`
          : null,
      };
    }),
  };
}
