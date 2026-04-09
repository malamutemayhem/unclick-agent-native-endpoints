// RAWG Video Games Database API integration.
// Docs: https://rawg.io/apidocs
// Env var: RAWG_API_KEY
// Base URL: https://api.rawg.io/api/

const RAWG_BASE = "https://api.rawg.io/api";

// ─── API helper ───────────────────────────────────────────────────────────────

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.RAWG_API_KEY ?? "").trim();
  if (!key) {
    throw new Error(
      "RAWG_API_KEY is required. Get a free key at https://rawg.io/apidocs"
    );
  }
  return key;
}

async function rawgFetch<T>(
  path: string,
  apiKey: string,
  extra: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${RAWG_BASE}${path}`);
  url.searchParams.set("key", apiKey);
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "UnClickMCP/1.0 (https://unclick.io)" },
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      `RAWG API HTTP ${res.status}: ${String(body.detail ?? "Unknown error")}`
    );
  }
  return body as T;
}

function normalizeGame(g: Record<string, unknown>) {
  return {
    id: g.id,
    slug: g.slug ?? null,
    name: g.name ?? null,
    released: g.released ?? null,
    rating: g.rating ?? null,
    ratings_count: g.ratings_count ?? null,
    metacritic: g.metacritic ?? null,
    playtime: g.playtime ?? null,
    background_image: g.background_image ?? null,
    genres:
      ((g.genres as Record<string, unknown>[]) ?? []).map(
        (x) => x.name
      ),
    platforms:
      ((g.platforms as Record<string, unknown>[]) ?? []).map(
        (p) => (p.platform as Record<string, unknown>)?.name ?? p
      ),
  };
}

// ─── rawg_search_games ────────────────────────────────────────────────────────
// GET /games?search=&genres=&platforms=&ordering=&page_size=

export async function rawgSearchGames(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const search = String(args.search ?? "").trim();
  if (!search) return { error: "search is required." };

  const extra: Record<string, string> = { search };
  if (args.genres) extra.genres = String(args.genres);
  if (args.platforms) extra.platforms = String(args.platforms);
  if (args.ordering) extra.ordering = String(args.ordering);
  if (args.page_size) extra.page_size = String(args.page_size);

  const data = await rawgFetch<Record<string, unknown>>("/games", key, extra);
  const results = (data.results as Record<string, unknown>[]) ?? [];

  return {
    count: data.count ?? 0,
    next: data.next ?? null,
    results: results.map(normalizeGame),
  };
}

// ─── rawg_get_game ────────────────────────────────────────────────────────────
// GET /games/{id}

export async function rawgGetGame(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const id = String(args.id ?? "").trim();
  if (!id) return { error: "id is required (RAWG game ID or slug)." };

  const data = await rawgFetch<Record<string, unknown>>(
    `/games/${encodeURIComponent(id)}`,
    key
  );

  return {
    id: data.id,
    slug: data.slug ?? null,
    name: data.name ?? null,
    name_original: data.name_original ?? null,
    description_raw: data.description_raw ?? null,
    released: data.released ?? null,
    updated: data.updated ?? null,
    rating: data.rating ?? null,
    ratings_count: data.ratings_count ?? null,
    metacritic: data.metacritic ?? null,
    playtime: data.playtime ?? null,
    esrb_rating:
      (data.esrb_rating as Record<string, unknown>)?.name ?? null,
    background_image: data.background_image ?? null,
    website: data.website ?? null,
    genres:
      ((data.genres as Record<string, unknown>[]) ?? []).map(
        (x) => x.name
      ),
    tags:
      ((data.tags as Record<string, unknown>[]) ?? [])
        .slice(0, 20)
        .map((x) => x.name),
    platforms:
      ((data.platforms as Record<string, unknown>[]) ?? []).map(
        (p) => (p.platform as Record<string, unknown>)?.name ?? p
      ),
    developers:
      ((data.developers as Record<string, unknown>[]) ?? []).map(
        (x) => x.name
      ),
    publishers:
      ((data.publishers as Record<string, unknown>[]) ?? []).map(
        (x) => x.name
      ),
  };
}

// ─── rawg_get_game_screenshots ────────────────────────────────────────────────
// GET /games/{id}/screenshots

export async function rawgGetGameScreenshots(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const id = String(args.id ?? "").trim();
  if (!id) return { error: "id is required (RAWG game ID or slug)." };

  const data = await rawgFetch<Record<string, unknown>>(
    `/games/${encodeURIComponent(id)}/screenshots`,
    key
  );
  const results = (data.results as Record<string, unknown>[]) ?? [];

  return {
    count: data.count ?? 0,
    screenshots: results.map((s) => ({
      id: s.id,
      image: s.image,
      width: s.width ?? null,
      height: s.height ?? null,
    })),
  };
}

// ─── rawg_list_genres ─────────────────────────────────────────────────────────
// GET /genres

export async function rawgListGenres(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const data = await rawgFetch<Record<string, unknown>>("/genres", key);
  const results = (data.results as Record<string, unknown>[]) ?? [];

  return {
    count: data.count ?? 0,
    genres: results.map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug ?? null,
      games_count: g.games_count ?? null,
    })),
  };
}

// ─── rawg_list_platforms ──────────────────────────────────────────────────────
// GET /platforms

export async function rawgListPlatforms(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const data = await rawgFetch<Record<string, unknown>>("/platforms", key);
  const results = (data.results as Record<string, unknown>[]) ?? [];

  return {
    count: data.count ?? 0,
    platforms: results.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug ?? null,
      games_count: p.games_count ?? null,
      year_start: p.year_start ?? null,
      year_end: p.year_end ?? null,
    })),
  };
}

// ─── rawg_upcoming_games ──────────────────────────────────────────────────────
// GET /games?dates=upcoming&ordering=-added

export async function rawgUpcomingGames(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const extra: Record<string, string> = {
    dates: "upcoming",
    ordering: "-added",
  };
  if (args.page_size) extra.page_size = String(args.page_size);

  const data = await rawgFetch<Record<string, unknown>>("/games", key, extra);
  const results = (data.results as Record<string, unknown>[]) ?? [];

  return {
    count: data.count ?? 0,
    next: data.next ?? null,
    results: results.map(normalizeGame),
  };
}
