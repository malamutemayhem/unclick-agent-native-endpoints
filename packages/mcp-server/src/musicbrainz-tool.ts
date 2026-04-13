// MusicBrainz API integration for the UnClick MCP server.
// Uses the MusicBrainz REST API via fetch - no external dependencies.
// No auth required. Identifies with a User-Agent header as required by MusicBrainz policy.

const MB_BASE = "https://musicbrainz.org/ws/2";
const MB_USER_AGENT = "UnClick/1.0 (support@unclick.world)";

// ─── API helper ───────────────────────────────────────────────────────────────

async function mbCall(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<unknown> {
  const url = new URL(`${MB_BASE}${path}`);
  url.searchParams.set("fmt", "json");

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && k !== "fmt") {
      url.searchParams.set(k, String(v));
    }
  }

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": MB_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from MusicBrainz API`);
  }

  return response.json();
}

// ─── Tools ────────────────────────────────────────────────────────────────────

export async function mbSearchArtists(args: Record<string, unknown>): Promise<unknown> {
  const query = String(args.query ?? "").trim();
  if (!query) throw new Error("query is required.");
  const limit = args.limit !== undefined ? Number(args.limit) : undefined;
  return mbCall("/artist", { query, limit });
}

export async function mbSearchReleases(args: Record<string, unknown>): Promise<unknown> {
  const query = String(args.query ?? "").trim();
  if (!query) throw new Error("query is required.");
  const limit = args.limit !== undefined ? Number(args.limit) : undefined;

  let fullQuery = query;
  if (args.artist) {
    fullQuery = `${query} artist:${args.artist}`;
  }

  return mbCall("/release", { query: fullQuery, limit });
}

export async function mbSearchRecordings(args: Record<string, unknown>): Promise<unknown> {
  const query = String(args.query ?? "").trim();
  if (!query) throw new Error("query is required.");
  const limit = args.limit !== undefined ? Number(args.limit) : undefined;

  let fullQuery = query;
  if (args.artist) {
    fullQuery = `${query} artist:${args.artist}`;
  }

  return mbCall("/recording", { query: fullQuery, limit });
}

export async function mbGetArtist(args: Record<string, unknown>): Promise<unknown> {
  const mbid = String(args.mbid ?? "").trim();
  if (!mbid) throw new Error("mbid is required.");
  return mbCall(`/artist/${mbid}`, { inc: "releases" });
}

export async function mbGetRelease(args: Record<string, unknown>): Promise<unknown> {
  const mbid = String(args.mbid ?? "").trim();
  if (!mbid) throw new Error("mbid is required.");
  return mbCall(`/release/${mbid}`, { inc: "recordings" });
}
