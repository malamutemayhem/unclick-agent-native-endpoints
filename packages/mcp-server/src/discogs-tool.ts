// ── Discogs API tool ────────────────────────────────────────────────────────────
// Free API with personal access token auth.
// Docs: https://www.discogs.com/developers
// Env var: DISCOGS_TOKEN

const DISCOGS_BASE = "https://api.discogs.com";

async function discogsGet(
  token: string,
  path: string,
  params: Record<string, string | number | boolean> = {}
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const url = `${DISCOGS_BASE}${path}${qs.toString() ? "?" + qs.toString() : ""}`;
  const res = await fetch(url, {
    headers: {
      Authorization:  `Discogs token=${token}`,
      "User-Agent":   "UnClickMCP/1.0",
      Accept:         "application/vnd.discogs.v2.discogs+json",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Discogs API HTTP ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

function getToken(args: Record<string, unknown>): string {
  const token = String(args.token ?? process.env.DISCOGS_TOKEN ?? "").trim();
  if (!token) throw new Error("token is required (or set DISCOGS_TOKEN env var).");
  return token;
}

// ── Tool functions ─────────────────────────────────────────────────────────────

export async function discogsSearchReleases(args: Record<string, unknown>): Promise<unknown> {
  try {
    const token = getToken(args);
    const params: Record<string, string | number> = { type: "release" };
    if (args.query)  params.q      = String(args.query);
    if (args.artist) params.artist = String(args.artist);
    if (args.genre)  params.genre  = String(args.genre);
    if (args.year)   params.year   = Number(args.year);
    if (args.format) params.format = String(args.format);
    if (args.label)  params.label  = String(args.label);
    if (args.per_page) params.per_page = Number(args.per_page);
    if (args.page)     params.page     = Number(args.page);
    const data = await discogsGet(token, "/database/search", params);
    return {
      total:   (data.pagination as Record<string, unknown>)?.items,
      pages:   (data.pagination as Record<string, unknown>)?.pages,
      page:    (data.pagination as Record<string, unknown>)?.page,
      results: data.results,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function discogsGetRelease(args: Record<string, unknown>): Promise<unknown> {
  try {
    const token = getToken(args);
    const id = String(args.id ?? "").trim();
    if (!id) return { error: "id is required." };
    const data = await discogsGet(token, `/releases/${encodeURIComponent(id)}`);
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function discogsGetArtist(args: Record<string, unknown>): Promise<unknown> {
  try {
    const token = getToken(args);
    const id = String(args.id ?? "").trim();
    if (!id) return { error: "id is required." };
    const data = await discogsGet(token, `/artists/${encodeURIComponent(id)}`);
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function discogsSearchArtists(args: Record<string, unknown>): Promise<unknown> {
  try {
    const token = getToken(args);
    const query = String(args.query ?? "").trim();
    if (!query) return { error: "query is required." };
    const params: Record<string, string | number> = { q: query, type: "artist" };
    if (args.per_page) params.per_page = Number(args.per_page);
    if (args.page)     params.page     = Number(args.page);
    const data = await discogsGet(token, "/database/search", params);
    return {
      total:   (data.pagination as Record<string, unknown>)?.items,
      results: data.results,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function discogsGetMarketplaceStats(args: Record<string, unknown>): Promise<unknown> {
  try {
    const token = getToken(args);
    const releaseId = String(args.release_id ?? "").trim();
    if (!releaseId) return { error: "release_id is required." };
    const data = await discogsGet(token, `/marketplace/stats/${encodeURIComponent(releaseId)}`);
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function discogsGetLabel(args: Record<string, unknown>): Promise<unknown> {
  try {
    const token = getToken(args);
    const id = String(args.id ?? "").trim();
    if (!id) return { error: "id is required." };
    const data = await discogsGet(token, `/labels/${encodeURIComponent(id)}`);
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
