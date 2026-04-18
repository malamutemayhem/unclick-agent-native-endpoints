// Radio Browser API integration - 50,000+ internet radio stations worldwide.
// No authentication required - completely free and open.
// Base URL: https://de1.api.radio-browser.info/json/

const RADIO_BASE = "https://de1.api.radio-browser.info/json";

// ─── API helper ───────────────────────────────────────────────────────────────

async function radioFetch(path: string, params?: URLSearchParams): Promise<unknown> {
  const url = params ? `${RADIO_BASE}${path}?${params}` : `${RADIO_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "UnClickMCP/1.0 (https://unclick.io)",
      "Accept": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Radio Browser API HTTP ${res.status}`);
  return res.json() as Promise<unknown>;
}

interface Station {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved?: string;
  homepage?: string;
  favicon?: string;
  country?: string;
  countrycode?: string;
  language?: string;
  tags?: string;
  codec?: string;
  bitrate?: number;
  votes?: number;
  clickcount?: number;
  lastchangetime?: string;
}

function normalizeStation(s: Station) {
  return {
    id: s.stationuuid,
    name: s.name,
    stream_url: s.url_resolved || s.url,
    homepage: s.homepage || null,
    favicon: s.favicon || null,
    country: s.country || null,
    country_code: s.countrycode || null,
    language: s.language || null,
    tags: s.tags ? s.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    codec: s.codec || null,
    bitrate: s.bitrate || null,
    votes: s.votes || 0,
    click_count: s.clickcount || 0,
  };
}

// ─── radio_search ─────────────────────────────────────────────────────────────
// POST /stations/search

export async function radioSearch(args: Record<string, unknown>): Promise<unknown> {
  const limit = Math.min(100, Math.max(1, Number(args.limit ?? 20)));
  const params = new URLSearchParams({ limit: String(limit), hidebroken: "true" });

  if (args.name) params.set("name", String(args.name));
  if (args.country) params.set("country", String(args.country));
  if (args.language) params.set("language", String(args.language));
  if (args.tag) params.set("tag", String(args.tag));

  if (!args.name && !args.country && !args.language && !args.tag) {
    return { error: "At least one search filter is required: name, country, language, or tag." };
  }

  const data = await radioFetch("/stations/search", params) as Station[];
  return {
    count: data.length,
    stations: data.map(normalizeStation),
  };
}

// ─── radio_by_country ─────────────────────────────────────────────────────────
// GET /stations/bycountry/{country}

export async function radioByCountry(args: Record<string, unknown>): Promise<unknown> {
  const country = String(args.country ?? "").trim();
  if (!country) return { error: "country is required (e.g. 'Australia' or 'Germany')." };

  const limit = Math.min(100, Math.max(1, Number(args.limit ?? 30)));
  const params = new URLSearchParams({ limit: String(limit), hidebroken: "true" });

  const data = await radioFetch(
    `/stations/bycountry/${encodeURIComponent(country)}`,
    params
  ) as Station[];

  return {
    country,
    count: data.length,
    stations: data.map(normalizeStation),
  };
}

// ─── radio_top_clicked ────────────────────────────────────────────────────────
// GET /stations/topclick

export async function radioTopClicked(args: Record<string, unknown>): Promise<unknown> {
  const limit = Math.min(100, Math.max(1, Number(args.limit ?? 20)));
  const params = new URLSearchParams({ limit: String(limit), hidebroken: "true" });

  const data = await radioFetch("/stations/topclick", params) as Station[];
  return {
    count: data.length,
    ranked_by: "click_count",
    stations: data.map(normalizeStation),
  };
}

// ─── radio_top_voted ──────────────────────────────────────────────────────────
// GET /stations/topvote

export async function radioTopVoted(args: Record<string, unknown>): Promise<unknown> {
  const limit = Math.min(100, Math.max(1, Number(args.limit ?? 20)));
  const params = new URLSearchParams({ limit: String(limit), hidebroken: "true" });

  const data = await radioFetch("/stations/topvote", params) as Station[];
  return {
    count: data.length,
    ranked_by: "votes",
    stations: data.map(normalizeStation),
  };
}

// ─── radio_by_tag ─────────────────────────────────────────────────────────────
// GET /stations/bytag/{tag}

export async function radioByTag(args: Record<string, unknown>): Promise<unknown> {
  const tag = String(args.tag ?? "").trim().toLowerCase();
  if (!tag) return { error: "tag is required (e.g. 'jazz', 'classical', 'news')." };

  const limit = Math.min(100, Math.max(1, Number(args.limit ?? 30)));
  const params = new URLSearchParams({ limit: String(limit), hidebroken: "true" });

  const data = await radioFetch(
    `/stations/bytag/${encodeURIComponent(tag)}`,
    params
  ) as Station[];

  return {
    tag,
    count: data.length,
    stations: data.map(normalizeStation),
  };
}

// ─── radio_countries ──────────────────────────────────────────────────────────
// GET /countries

export async function radioCountries(_args: Record<string, unknown>): Promise<unknown> {
  const data = await radioFetch("/countries") as Array<{
    name: string;
    stationcount: number;
    iso_3166_1?: string;
  }>;

  const sorted = [...data].sort((a, b) => b.stationcount - a.stationcount);

  return {
    count: sorted.length,
    countries: sorted.map((c) => ({
      name: c.name,
      station_count: c.stationcount,
      code: c.iso_3166_1 ?? null,
    })),
  };
}
