// Public toilet finder using AU Toilet Map API (primary) and OpenStreetMap Overpass (fallback).
// Zero-config - no API key required.
// AU API: https://toiletmap.gov.au/api/getToiletsByRadius
// OSM Overpass: https://overpass-api.de/api/interpreter

const AU_TOILET_BASE = "https://toiletmap.gov.au/api/getToiletsByRadius";
const OVERPASS_BASE = "https://overpass-api.de/api/interpreter";
const FETCH_HEADERS = { "User-Agent": "UnClickMCP/1.0 (https://unclick.io)" };

// ─── Haversine distance ───────────────────────────────────────────────────────

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // metres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

// ─── Shared result shape ──────────────────────────────────────────────────────

interface ToiletResult {
  id: string;
  source: "au" | "osm";
  name: string;
  latitude: number;
  longitude: number;
  distance_meters: number;
  distance_text: string;
  address: string;
  is_accessible: boolean;
  has_baby_change: boolean;
  is_24_hours: boolean;
  is_open_now: boolean | null;
  features: string[];
  walking_directions_url: string;
  maps_url: string;
}

// ─── AU Toilet Map API ────────────────────────────────────────────────────────

interface AuToilet {
  ToiletID?: unknown;
  Name?: unknown;
  Address1?: unknown;
  Town?: unknown;
  State?: unknown;
  Postcode?: unknown;
  Latitude?: unknown;
  Longitude?: unknown;
  IsOpen24Hours?: unknown;
  AccessibleMale?: unknown;
  AccessibleFemale?: unknown;
  AccessibleUnisex?: unknown;
  MaleToilet?: unknown;
  FemaleToilet?: unknown;
  UnisexToilet?: unknown;
  BabyChange?: unknown;
  FacilityType?: unknown;
}

function auToiletToResult(
  t: AuToilet,
  userLat: number,
  userLon: number
): ToiletResult {
  const lat = Number(t.Latitude ?? 0);
  const lon = Number(t.Longitude ?? 0);
  const dist = haversineDistance(userLat, userLon, lat, lon);

  const isAccessible = Boolean(t.AccessibleMale || t.AccessibleFemale || t.AccessibleUnisex);
  const hasBabyChange = Boolean(t.BabyChange);
  const is24Hours = Boolean(t.IsOpen24Hours);
  const hasMale = Boolean(t.MaleToilet);
  const hasFemale = Boolean(t.FemaleToilet);
  const hasUnisex = Boolean(t.UnisexToilet);

  const features: string[] = [];
  if (isAccessible) features.push("Accessible");
  if (hasBabyChange) features.push("Baby change");
  if (is24Hours) features.push("24 hours");
  if (hasMale) features.push("Male");
  if (hasFemale) features.push("Female");
  if (hasUnisex) features.push("Unisex");

  const addressParts = [t.Address1, t.Town, t.State, t.Postcode].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(", ") : "Address unavailable";

  return {
    id: String(t.ToiletID ?? ""),
    source: "au",
    name: String(t.Name ?? "").trim() || "Public Toilet",
    latitude: lat,
    longitude: lon,
    distance_meters: Math.round(dist),
    distance_text: formatDistance(dist),
    address,
    is_accessible: isAccessible,
    has_baby_change: hasBabyChange,
    is_24_hours: is24Hours,
    is_open_now: is24Hours ? true : null,
    features,
    walking_directions_url: `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLon}&destination=${lat},${lon}&travelmode=walking`,
    maps_url: `https://www.google.com/maps?q=${lat},${lon}`,
  };
}

async function fetchAuToilets(
  lat: number,
  lon: number,
  radiusMeters: number
): Promise<AuToilet[]> {
  const radiusKm = radiusMeters / 1000;
  const url = `${AU_TOILET_BASE}?latitude=${lat}&longitude=${lon}&radius=${radiusKm}`;
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`AU Toilet Map API HTTP ${res.status}`);
  const data = await res.json() as unknown;
  if (Array.isArray(data)) return data as AuToilet[];
  // Some responses wrap in a "features" or top-level array-like object
  if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).toilets)) {
    return (data as Record<string, unknown>).toilets as AuToilet[];
  }
  return [];
}

// ─── OSM Overpass API ─────────────────────────────────────────────────────────

interface OsmNode {
  id?: unknown;
  lat?: unknown;
  lon?: unknown;
  tags?: Record<string, string>;
}

function isOpenNow(openingHours: string | undefined): boolean | null {
  if (!openingHours) return null;
  if (/24\/7|24 hours/i.test(openingHours)) return true;
  return null; // Parsing arbitrary opening_hours is complex; return unknown
}

function osmNodeToResult(
  node: OsmNode,
  userLat: number,
  userLon: number
): ToiletResult {
  const lat = Number(node.lat ?? 0);
  const lon = Number(node.lon ?? 0);
  const dist = haversineDistance(userLat, userLon, lat, lon);
  const tags = node.tags ?? {};

  const isAccessible = tags.wheelchair === "yes" || tags.wheelchair === "designated";
  const hasBabyChange = tags.changing_table === "yes" || tags["toilets:changing_table"] === "yes";
  const openingHoursStr = tags.opening_hours;
  const is24Hours = /24\/7|24 hours/i.test(openingHoursStr ?? "");
  const openNow = isOpenNow(openingHoursStr);
  const hasMale = tags["toilets:male"] === "yes" || tags.male === "yes";
  const hasFemale = tags["toilets:female"] === "yes" || tags.female === "yes";
  const hasUnisex = tags["toilets:unisex"] === "yes" || tags.unisex === "yes";

  const features: string[] = [];
  if (isAccessible) features.push("Accessible");
  if (hasBabyChange) features.push("Baby change");
  if (is24Hours) features.push("24 hours");
  if (hasMale) features.push("Male");
  if (hasFemale) features.push("Female");
  if (hasUnisex) features.push("Unisex");

  const addressParts = [
    tags["addr:housenumber"] && tags["addr:street"]
      ? `${tags["addr:housenumber"]} ${tags["addr:street"]}`
      : tags["addr:street"],
    tags["addr:suburb"] ?? tags["addr:city"],
    tags["addr:state"],
    tags["addr:postcode"],
  ].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(", ") : "Address unavailable";

  return {
    id: String(node.id ?? ""),
    source: "osm",
    name: tags.name?.trim() || tags.description?.trim() || "Public Toilet",
    latitude: lat,
    longitude: lon,
    distance_meters: Math.round(dist),
    distance_text: formatDistance(dist),
    address,
    is_accessible: isAccessible,
    has_baby_change: hasBabyChange,
    is_24_hours: is24Hours,
    is_open_now: openNow,
    features,
    walking_directions_url: `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLon}&destination=${lat},${lon}&travelmode=walking`,
    maps_url: `https://www.google.com/maps?q=${lat},${lon}`,
  };
}

async function fetchOsmToilets(
  lat: number,
  lon: number,
  radiusMeters: number
): Promise<OsmNode[]> {
  const query = `[out:json][timeout:10];
node["amenity"="toilets"](around:${radiusMeters},${lat},${lon});
out body;`;

  const res = await fetch(OVERPASS_BASE, {
    method: "POST",
    headers: { ...FETCH_HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`Overpass API HTTP ${res.status}`);
  const data = await res.json() as { elements?: OsmNode[] };
  return data.elements ?? [];
}

// ─── find_nearest_toilets ─────────────────────────────────────────────────────

export async function findNearestToilets(args: Record<string, unknown>): Promise<unknown> {
  const lat = Number(args.latitude);
  const lon = Number(args.longitude);
  const radiusMeters = Number(args.radius_meters ?? 500);
  const limit = Math.max(1, Math.min(50, Number(args.limit ?? 5)));
  const accessibleOnly = Boolean(args.accessible_only ?? false);

  if (isNaN(lat) || isNaN(lon)) {
    return { error: "latitude and longitude are required and must be valid numbers." };
  }

  let results: ToiletResult[] = [];
  let auFailed = false;

  // 1. Try AU Toilet Map API
  try {
    const auRaw = await fetchAuToilets(lat, lon, radiusMeters);
    if (auRaw.length > 0) {
      results = auRaw.map((t) => auToiletToResult(t, lat, lon));
    }
  } catch {
    auFailed = true;
  }

  // 2. Fall back to OSM if AU returned nothing or failed
  if (results.length === 0) {
    try {
      const osmRaw = await fetchOsmToilets(lat, lon, radiusMeters);
      results = osmRaw.map((n) => osmNodeToResult(n, lat, lon));
    } catch (osmErr) {
      if (auFailed) {
        return {
          error:
            "Both the AU Toilet Map API and OpenStreetMap Overpass API failed. " +
            "Check your network connection or try again shortly.",
        };
      }
    }
  }

  if (accessibleOnly) {
    results = results.filter((r) => r.is_accessible);
  }

  // Sort by distance ascending
  results.sort((a, b) => a.distance_meters - b.distance_meters);
  const topResults = results.slice(0, limit);

  if (topResults.length === 0) {
    return {
      found: 0,
      message: `No public toilets found within ${formatDistance(radiusMeters)}. Try increasing the radius.`,
      results: [],
    };
  }

  return {
    found: topResults.length,
    radius_meters: radiusMeters,
    results: topResults,
  };
}

// ─── get_toilet_details ───────────────────────────────────────────────────────

export async function getToiletDetails(args: Record<string, unknown>): Promise<unknown> {
  const toiletId = String(args.toilet_id ?? "").trim();
  const source = String(args.source ?? "").toLowerCase();

  if (!toiletId) return { error: "toilet_id is required." };
  if (source !== "au" && source !== "osm") {
    return { error: "source must be 'au' or 'osm'." };
  }

  if (source === "au") {
    try {
      const url = `https://toiletmap.gov.au/api/getToiletDetails?toiletId=${encodeURIComponent(toiletId)}`;
      const res = await fetch(url, { headers: FETCH_HEADERS });
      if (!res.ok) throw new Error(`AU Toilet Map API HTTP ${res.status}`);
      const data = await res.json() as unknown;
      return data;
    } catch (err) {
      return {
        error: `Failed to fetch AU toilet details: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // OSM: fetch node by ID
  try {
    const url = `https://api.openstreetmap.org/api/0.6/node/${encodeURIComponent(toiletId)}.json`;
    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`OSM API HTTP ${res.status}`);
    const data = await res.json() as { elements?: OsmNode[] };
    const node = data.elements?.[0];
    if (!node) return { error: `OSM node ${toiletId} not found.` };
    return {
      id: String(node.id),
      source: "osm",
      latitude: node.lat,
      longitude: node.lon,
      tags: node.tags ?? {},
      maps_url: `https://www.google.com/maps?q=${node.lat},${node.lon}`,
    };
  } catch (err) {
    return {
      error: `Failed to fetch OSM toilet details: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
