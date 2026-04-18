// GDELT Project integration - global news intelligence, no auth required.
// Docs: https://www.gdeltproject.org/
// DOC API: https://api.gdeltproject.org/api/v2/doc/doc
// GEO API: https://api.gdeltproject.org/api/v2/geo/geo
// Updated every 15 minutes. Covers all broadcast, print, and web news globally.

const GDELT_DOC = "https://api.gdeltproject.org/api/v2/doc/doc";
const GDELT_GEO = "https://api.gdeltproject.org/api/v2/geo/geo";

// ─── API helpers ──────────────────────────────────────────────────────────────

async function gdeltFetch(base: string, params: URLSearchParams): Promise<unknown> {
  const url = `${base}?${params}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "UnClickMCP/1.0 (https://unclick.io)" },
  });
  if (!res.ok) throw new Error(`GDELT API HTTP ${res.status}`);
  return res.json() as Promise<unknown>;
}

interface GdeltArticle {
  url?: string;
  url_mobile?: string;
  title?: string;
  seendate?: string;
  socialimage?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
}

interface GdeltTimelineEntry {
  date?: string;
  value?: number;
  normvalue?: number;
}

interface GdeltGeoFeature {
  type?: string;
  geometry?: { type?: string; coordinates?: [number, number] };
  properties?: {
    name?: string;
    countrycode?: string;
    adm1code?: string;
    latitude?: string;
    longitude?: string;
    featureid?: string;
    count?: number;
    tone?: number;
  };
}

// ─── gdelt_news_search ────────────────────────────────────────────────────────

export async function gdeltNewsSearch(args: Record<string, unknown>): Promise<unknown> {
  const query = String(args.query ?? "").trim();
  if (!query) return { error: "query is required." };

  const maxrecords = Math.min(250, Math.max(1, Number(args.maxrecords ?? 25)));
  const params = new URLSearchParams({
    query,
    mode: "artlist",
    format: "json",
    maxrecords: String(maxrecords),
  });

  if (args.startdatetime) params.set("startdatetime", String(args.startdatetime));
  if (args.enddatetime) params.set("enddatetime", String(args.enddatetime));
  if (args.sourcelang) params.set("sourcelang", String(args.sourcelang));
  if (args.sourcecountry) params.set("sourcecountry", String(args.sourcecountry));

  const data = await gdeltFetch(GDELT_DOC, params) as { articles?: GdeltArticle[] };
  const articles = data?.articles ?? [];

  return {
    query,
    count: articles.length,
    articles: articles.map((a) => ({
      title: a.title ?? null,
      url: a.url ?? null,
      domain: a.domain ?? null,
      date: a.seendate ?? null,
      language: a.language ?? null,
      country: a.sourcecountry ?? null,
      image: a.socialimage ?? null,
    })),
  };
}

// ─── gdelt_tone_analysis ──────────────────────────────────────────────────────
// Uses timelinetone mode - returns average tone score over time.
// Negative values = negative sentiment; positive = positive sentiment.

export async function gdeltToneAnalysis(args: Record<string, unknown>): Promise<unknown> {
  const query = String(args.query ?? "").trim();
  if (!query) return { error: "query is required." };

  const params = new URLSearchParams({
    query,
    mode: "timelinetone",
    format: "json",
  });

  if (args.timespan) params.set("timespan", String(args.timespan));
  if (args.sourcelang) params.set("sourcelang", String(args.sourcelang));
  if (args.sourcecountry) params.set("sourcecountry", String(args.sourcecountry));

  const data = await gdeltFetch(GDELT_DOC, params) as {
    timeline?: Array<{ data?: GdeltTimelineEntry[] }>;
  };

  const timelineArr = data?.timeline ?? [];
  const entries: GdeltTimelineEntry[] = timelineArr.flatMap((t) => t?.data ?? []);

  if (entries.length === 0) {
    return { query, timeline: [], summary: null };
  }

  const values = entries.map((e) => e.value ?? 0).filter((v) => !isNaN(v));
  const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const latest = entries[entries.length - 1];

  return {
    query,
    summary: {
      average_tone: Math.round(avg * 100) / 100,
      min_tone: Math.round(min * 100) / 100,
      max_tone: Math.round(max * 100) / 100,
      latest_tone: Math.round((latest?.value ?? 0) * 100) / 100,
      latest_date: latest?.date ?? null,
      interpretation:
        avg < -2 ? "strongly negative" :
        avg < -0.5 ? "slightly negative" :
        avg < 0.5 ? "neutral" :
        avg < 2 ? "slightly positive" : "strongly positive",
    },
    timeline: entries.slice(-30).map((e) => ({
      date: e.date ?? null,
      tone: Math.round((e.value ?? 0) * 100) / 100,
    })),
  };
}

// ─── gdelt_geo_events ─────────────────────────────────────────────────────────
// Uses the GDELT GEO API - returns geographic event clusters with article counts and tone.

export async function gdeltGeoEvents(args: Record<string, unknown>): Promise<unknown> {
  const query = String(args.query ?? "").trim();
  if (!query) return { error: "query is required." };

  const maxpoints = Math.min(250, Math.max(1, Number(args.maxpoints ?? 50)));
  const params = new URLSearchParams({
    query,
    format: "json",
    maxpoints: String(maxpoints),
  });

  if (args.timespan) params.set("timespan", String(args.timespan));

  const data = await gdeltFetch(GDELT_GEO, params) as { features?: GdeltGeoFeature[] };
  const features = data?.features ?? [];

  return {
    query,
    count: features.length,
    events: features.map((f) => ({
      name: f.properties?.name ?? null,
      country: f.properties?.countrycode ?? null,
      coordinates: f.geometry?.coordinates
        ? { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }
        : null,
      article_count: f.properties?.count ?? 0,
      tone: f.properties?.tone != null
        ? Math.round(f.properties.tone * 100) / 100
        : null,
    })).sort((a, b) => (b.article_count ?? 0) - (a.article_count ?? 0)),
  };
}

// ─── gdelt_trending ───────────────────────────────────────────────────────────
// Uses timelinevol mode - returns article volume over time for a query.
// Shows whether a topic is surging, stable, or fading in the news cycle.

export async function gdeltTrending(args: Record<string, unknown>): Promise<unknown> {
  const query = String(args.query ?? "").trim();
  if (!query) return { error: "query is required." };

  const params = new URLSearchParams({
    query,
    mode: "timelinevol",
    format: "json",
  });

  if (args.timespan) params.set("timespan", String(args.timespan));
  if (args.sourcelang) params.set("sourcelang", String(args.sourcelang));

  const data = await gdeltFetch(GDELT_DOC, params) as {
    timeline?: Array<{ data?: GdeltTimelineEntry[] }>;
  };

  const timelineArr = data?.timeline ?? [];
  const entries: GdeltTimelineEntry[] = timelineArr.flatMap((t) => t?.data ?? []);

  if (entries.length === 0) {
    return { query, trend: "no data", timeline: [] };
  }

  const values = entries.map((e) => e.normvalue ?? e.value ?? 0);
  const recent = values.slice(-5);
  const older = values.slice(0, Math.max(1, values.length - 5));
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

  const trend =
    olderAvg === 0 ? "emerging" :
    recentAvg > olderAvg * 1.5 ? "surging" :
    recentAvg > olderAvg * 1.1 ? "rising" :
    recentAvg < olderAvg * 0.5 ? "fading" :
    recentAvg < olderAvg * 0.9 ? "declining" : "stable";

  return {
    query,
    trend,
    recent_avg_volume: Math.round(recentAvg * 1000) / 1000,
    older_avg_volume: Math.round(olderAvg * 1000) / 1000,
    timeline: entries.map((e) => ({
      date: e.date ?? null,
      volume: Math.round((e.normvalue ?? e.value ?? 0) * 1000) / 1000,
    })),
  };
}
