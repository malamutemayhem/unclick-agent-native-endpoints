// The Movie Database (TMDB) API integration for the UnClick MCP server.
// Uses the TMDB v3 REST API via fetch - no external dependencies.
// Get a free API key at https://www.themoviedb.org/settings/api

const TMDB_BASE = "https://api.themoviedb.org/3";

// ─── API helper ──────────────────────────────────────────────────────────────

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.TMDB_API_KEY ?? "").trim();
  if (!key) {
    throw new Error(
      "api_key is required. Get a free key at https://www.themoviedb.org/settings/api"
    );
  }
  return key;
}

async function tmdbFetch<T>(
  path: string,
  apiKey: string,
  extra: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", apiKey);
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      `TMDB API HTTP ${res.status}: ${String(body.status_message ?? "Unknown error")}`
    );
  }
  return body as T;
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

function normalizeMovie(m: Record<string, unknown>) {
  return {
    id: m.id,
    title: m.title,
    release_date: m.release_date ?? null,
    overview: m.overview ?? null,
    vote_average: m.vote_average ?? null,
    vote_count: m.vote_count ?? null,
    popularity: m.popularity ?? null,
    poster_path: m.poster_path
      ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
      : null,
    genre_ids: m.genre_ids ?? null,
  };
}

function normalizeTv(t: Record<string, unknown>) {
  return {
    id: t.id,
    name: t.name,
    first_air_date: t.first_air_date ?? null,
    overview: t.overview ?? null,
    vote_average: t.vote_average ?? null,
    vote_count: t.vote_count ?? null,
    popularity: t.popularity ?? null,
    poster_path: t.poster_path
      ? `https://image.tmdb.org/t/p/w500${t.poster_path}`
      : null,
    genre_ids: t.genre_ids ?? null,
  };
}

// ─── Operations ──────────────────────────────────────────────────────────────

export async function tmdbSearchMovies(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const query = String(args.query ?? "").trim();
  if (!query) throw new Error("query is required.");

  const extra: Record<string, string> = { query };
  if (args.year) extra.year = String(args.year);

  const data = await tmdbFetch<Record<string, unknown>>(
    "/search/movie",
    key,
    extra
  );
  const results = (data.results as Record<string, unknown>[]) ?? [];

  return {
    total: data.total_results ?? 0,
    pages: data.total_pages ?? 1,
    results: results.map(normalizeMovie),
  };
}

export async function tmdbSearchTv(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const query = String(args.query ?? "").trim();
  if (!query) throw new Error("query is required.");

  const data = await tmdbFetch<Record<string, unknown>>("/search/tv", key, {
    query,
  });
  const results = (data.results as Record<string, unknown>[]) ?? [];

  return {
    total: data.total_results ?? 0,
    pages: data.total_pages ?? 1,
    results: results.map(normalizeTv),
  };
}

export async function tmdbMovie(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const id = String(args.id ?? "").trim();
  if (!id) throw new Error("id is required (TMDB movie ID).");

  const data = await tmdbFetch<Record<string, unknown>>(
    `/movie/${id}`,
    key,
    { append_to_response: "credits" }
  );

  const credits = (data.credits as Record<string, unknown>) ?? {};
  const cast = (credits.cast as Record<string, unknown>[]) ?? [];

  return {
    id: data.id,
    title: data.title,
    tagline: data.tagline ?? null,
    overview: data.overview ?? null,
    release_date: data.release_date ?? null,
    runtime: data.runtime ?? null,
    status: data.status ?? null,
    vote_average: data.vote_average ?? null,
    vote_count: data.vote_count ?? null,
    popularity: data.popularity ?? null,
    budget: data.budget ?? null,
    revenue: data.revenue ?? null,
    genres: (data.genres as Record<string, unknown>[])?.map((g) => g.name) ?? [],
    poster_path: data.poster_path
      ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
      : null,
    cast: cast.slice(0, 10).map((c) => ({
      name: c.name,
      character: c.character,
      order: c.order,
    })),
  };
}

export async function tmdbTv(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const id = String(args.id ?? "").trim();
  if (!id) throw new Error("id is required (TMDB TV show ID).");

  const data = await tmdbFetch<Record<string, unknown>>(`/tv/${id}`, key, {
    append_to_response: "credits",
  });

  const credits = (data.credits as Record<string, unknown>) ?? {};
  const cast = (credits.cast as Record<string, unknown>[]) ?? [];

  return {
    id: data.id,
    name: data.name,
    tagline: data.tagline ?? null,
    overview: data.overview ?? null,
    first_air_date: data.first_air_date ?? null,
    last_air_date: data.last_air_date ?? null,
    number_of_seasons: data.number_of_seasons ?? null,
    number_of_episodes: data.number_of_episodes ?? null,
    status: data.status ?? null,
    vote_average: data.vote_average ?? null,
    vote_count: data.vote_count ?? null,
    popularity: data.popularity ?? null,
    genres: (data.genres as Record<string, unknown>[])?.map((g) => g.name) ?? [],
    poster_path: data.poster_path
      ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
      : null,
    cast: cast.slice(0, 10).map((c) => ({
      name: c.name,
      character: c.character,
      order: c.order,
    })),
  };
}

export async function tmdbTrending(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const mediaType = String(args.media_type ?? "all");
  const timeWindow = String(args.time_window ?? "week");

  const validMedia = ["movie", "tv", "all"];
  const validWindow = ["day", "week"];
  if (!validMedia.includes(mediaType)) {
    throw new Error(`media_type must be one of: ${validMedia.join(", ")}`);
  }
  if (!validWindow.includes(timeWindow)) {
    throw new Error(`time_window must be one of: ${validWindow.join(", ")}`);
  }

  const data = await tmdbFetch<Record<string, unknown>>(
    `/trending/${mediaType}/${timeWindow}`,
    key
  );
  const results = (data.results as Record<string, unknown>[]) ?? [];

  return {
    media_type: mediaType,
    time_window: timeWindow,
    total: data.total_results ?? 0,
    results: results.map((r) =>
      r.media_type === "tv" ? normalizeTv(r) : normalizeMovie(r)
    ),
  };
}

export async function tmdbNowPlaying(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const data = await tmdbFetch<Record<string, unknown>>(
    "/movie/now_playing",
    key
  );
  const results = (data.results as Record<string, unknown>[]) ?? [];

  return {
    total: data.total_results ?? 0,
    results: results.map(normalizeMovie),
  };
}

export async function tmdbUpcoming(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const data = await tmdbFetch<Record<string, unknown>>(
    "/movie/upcoming",
    key
  );
  const results = (data.results as Record<string, unknown>[]) ?? [];

  return {
    total: data.total_results ?? 0,
    results: results.map(normalizeMovie),
  };
}

export async function tmdbPopularTv(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const data = await tmdbFetch<Record<string, unknown>>("/tv/popular", key);
  const results = (data.results as Record<string, unknown>[]) ?? [];

  return {
    total: data.total_results ?? 0,
    results: results.map(normalizeTv),
  };
}
