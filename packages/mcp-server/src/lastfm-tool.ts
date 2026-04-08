// ── Last.fm API tool ────────────────────────────────────────────────────────────
// Unlimited free read access. No OAuth needed for read operations.
// Docs: https://www.last.fm/api
// Env var: LASTFM_API_KEY

const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0";

async function lastfmGet(
  apiKey: string,
  method: string,
  params: Record<string, string | number>
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({
    method,
    api_key: apiKey,
    format:  "json",
  });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const res = await fetch(`${LASTFM_BASE}/?${qs}`);
  if (!res.ok) throw new Error(`Last.fm API HTTP ${res.status}: ${res.statusText}`);
  const json = await res.json() as Record<string, unknown>;
  if (json.error) throw new Error(`Last.fm error ${json.error}: ${json.message}`);
  return json;
}

function getApiKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.LASTFM_API_KEY ?? "").trim();
  if (!key) throw new Error("api_key is required (or set LASTFM_API_KEY env var).");
  return key;
}

// ── Tool functions ─────────────────────────────────────────────────────────────

export async function lastfmGetArtistInfo(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const artist = String(args.artist ?? "").trim();
    if (!artist) return { error: "artist is required." };
    const params: Record<string, string | number> = { artist };
    if (args.lang) params.lang = String(args.lang);
    const data = await lastfmGet(apiKey, "artist.getinfo", params);
    return data.artist ?? data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function lastfmSearchArtists(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const query = String(args.query ?? "").trim();
    if (!query) return { error: "query is required." };
    const params: Record<string, string | number> = { artist: query };
    if (args.limit) params.limit = Number(args.limit);
    if (args.page)  params.page  = Number(args.page);
    const data = await lastfmGet(apiKey, "artist.search", params);
    const results = data.results as Record<string, unknown> | undefined;
    const matches = (results?.artistmatches as Record<string, unknown>)?.artist;
    return {
      total: (results?.["opensearch:totalResults"] as string | undefined),
      artists: Array.isArray(matches) ? matches : matches ? [matches] : [],
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function lastfmGetTopTracks(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const artist = String(args.artist ?? "").trim();
    if (!artist) return { error: "artist is required." };
    const params: Record<string, string | number> = { artist };
    if (args.limit) params.limit = Number(args.limit);
    if (args.page)  params.page  = Number(args.page);
    const data = await lastfmGet(apiKey, "artist.gettoptracks", params);
    const toptracks = data.toptracks as Record<string, unknown> | undefined;
    return {
      artist,
      tracks: toptracks?.track ?? [],
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function lastfmGetSimilarArtists(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const artist = String(args.artist ?? "").trim();
    if (!artist) return { error: "artist is required." };
    const params: Record<string, string | number> = { artist };
    if (args.limit) params.limit = Number(args.limit);
    const data = await lastfmGet(apiKey, "artist.getsimilar", params);
    const similar = data.similarartists as Record<string, unknown> | undefined;
    return {
      artist,
      similar_artists: similar?.artist ?? [],
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function lastfmGetChartTopArtists(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const params: Record<string, string | number> = {};
    if (args.limit) params.limit = Number(args.limit);
    if (args.page)  params.page  = Number(args.page);
    const data = await lastfmGet(apiKey, "chart.gettopartists", params);
    const artists = data.artists as Record<string, unknown> | undefined;
    return {
      artists: artists?.artist ?? [],
      total: (artists?.["@attr"] as Record<string, unknown> | undefined)?.total,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function lastfmGetChartTopTracks(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const params: Record<string, string | number> = {};
    if (args.limit) params.limit = Number(args.limit);
    if (args.page)  params.page  = Number(args.page);
    const data = await lastfmGet(apiKey, "chart.gettoptracks", params);
    const tracks = data.tracks as Record<string, unknown> | undefined;
    return {
      tracks: tracks?.track ?? [],
      total: (tracks?.["@attr"] as Record<string, unknown> | undefined)?.total,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function lastfmGetAlbumInfo(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const artist = String(args.artist ?? "").trim();
    const album  = String(args.album  ?? "").trim();
    if (!artist) return { error: "artist is required." };
    if (!album)  return { error: "album is required." };
    const params: Record<string, string | number> = { artist, album };
    if (args.lang) params.lang = String(args.lang);
    const data = await lastfmGet(apiKey, "album.getinfo", params);
    return data.album ?? data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
