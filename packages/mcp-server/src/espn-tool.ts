// ESPN sports data via the unofficial public ESPN API.
// No API key required.
// Base URL: https://site.api.espn.com/apis/site/v2/sports/

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

async function espnFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${ESPN_BASE}${path}`, {
    headers: { "User-Agent": "UnClickMCP/1.0 (https://unclick.io)" },
  });
  if (!res.ok) throw new Error(`ESPN API HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

interface EspnEvent {
  id: string;
  name: string;
  shortName?: string;
  date: string;
  status?: {
    type?: { name?: string; description?: string; completed?: boolean };
    displayClock?: string;
    period?: number;
  };
  competitions?: Array<{
    competitors?: Array<{
      team?: { displayName?: string; abbreviation?: string; logo?: string };
      score?: string;
      homeAway?: string;
      winner?: boolean;
    }>;
    venue?: { fullName?: string; address?: { city?: string; state?: string } };
    broadcasts?: Array<{ names?: string[] }>;
  }>;
}

interface EspnScoreboardResponse {
  events?: EspnEvent[];
  season?: { year?: number; type?: number };
  week?: { number?: number };
}

function normalizeEvent(event: EspnEvent) {
  const comp = event.competitions?.[0];
  const competitors = (comp?.competitors ?? []).map((c) => ({
    team: c.team?.displayName ?? "Unknown",
    abbreviation: c.team?.abbreviation ?? null,
    score: c.score ?? null,
    home_away: c.homeAway ?? null,
    winner: c.winner ?? null,
  }));

  const broadcasts = comp?.broadcasts?.flatMap((b) => b.names ?? []) ?? [];
  const venue = comp?.venue
    ? `${comp.venue.fullName ?? ""}${comp.venue.address?.city ? ", " + comp.venue.address.city : ""}`
    : null;

  return {
    id: event.id,
    name: event.name,
    short_name: event.shortName ?? null,
    date: event.date,
    status: event.status?.type?.description ?? event.status?.type?.name ?? null,
    completed: event.status?.type?.completed ?? null,
    clock: event.status?.displayClock ?? null,
    period: event.status?.period ?? null,
    competitors,
    venue: venue?.trim() || null,
    broadcasts,
  };
}

// ─── get_nfl_scores ───────────────────────────────────────────────────────────

export async function getNflScores(_args: Record<string, unknown>): Promise<unknown> {
  const data = await espnFetch<EspnScoreboardResponse>("/football/nfl/scoreboard");
  return {
    sport: "NFL",
    season_year: data.season?.year ?? null,
    week: data.week?.number ?? null,
    event_count: data.events?.length ?? 0,
    events: (data.events ?? []).map(normalizeEvent),
  };
}

// ─── get_nba_scores ───────────────────────────────────────────────────────────

export async function getNbaScores(_args: Record<string, unknown>): Promise<unknown> {
  const data = await espnFetch<EspnScoreboardResponse>("/basketball/nba/scoreboard");
  return {
    sport: "NBA",
    season_year: data.season?.year ?? null,
    event_count: data.events?.length ?? 0,
    events: (data.events ?? []).map(normalizeEvent),
  };
}

// ─── get_mlb_scores ───────────────────────────────────────────────────────────

export async function getMlbScores(_args: Record<string, unknown>): Promise<unknown> {
  const data = await espnFetch<EspnScoreboardResponse>("/baseball/mlb/scoreboard");
  return {
    sport: "MLB",
    season_year: data.season?.year ?? null,
    event_count: data.events?.length ?? 0,
    events: (data.events ?? []).map(normalizeEvent),
  };
}

// ─── get_nhl_scores ───────────────────────────────────────────────────────────

export async function getNhlScores(_args: Record<string, unknown>): Promise<unknown> {
  const data = await espnFetch<EspnScoreboardResponse>("/hockey/nhl/scoreboard");
  return {
    sport: "NHL",
    season_year: data.season?.year ?? null,
    event_count: data.events?.length ?? 0,
    events: (data.events ?? []).map(normalizeEvent),
  };
}

// ─── get_soccer_scores ────────────────────────────────────────────────────────

const SOCCER_LEAGUES: Record<string, string> = {
  "eng.1": "English Premier League",
  "eng.2": "Championship",
  "esp.1": "La Liga",
  "ger.1": "Bundesliga",
  "ita.1": "Serie A",
  "fra.1": "Ligue 1",
  "usa.1": "MLS",
  "aus.1": "A-League",
  "uefa.champions": "UEFA Champions League",
  "uefa.europa": "UEFA Europa League",
};

export async function getSoccerScores(args: Record<string, unknown>): Promise<unknown> {
  const league = String(args.league ?? "eng.1").trim();
  const data = await espnFetch<EspnScoreboardResponse>(`/soccer/${encodeURIComponent(league)}/scoreboard`);

  return {
    sport: "Soccer",
    league,
    league_name: SOCCER_LEAGUES[league] ?? league,
    common_leagues: SOCCER_LEAGUES,
    season_year: data.season?.year ?? null,
    event_count: data.events?.length ?? 0,
    events: (data.events ?? []).map(normalizeEvent),
  };
}

// ─── get_espn_news ────────────────────────────────────────────────────────────

interface EspnNewsResponse {
  articles?: Array<{
    headline?: string;
    description?: string;
    published?: string;
    lastModified?: string;
    links?: { web?: { href?: string } };
    categories?: Array<{ description?: string }>;
    byline?: string;
    images?: Array<{ url?: string }>;
  }>;
}

export async function getEspnNews(args: Record<string, unknown>): Promise<unknown> {
  const sport = String(args.sport ?? "football/nfl").trim();
  const data = await espnFetch<EspnNewsResponse>(`/${sport}/news`);

  return {
    sport,
    count: data.articles?.length ?? 0,
    articles: (data.articles ?? []).slice(0, 20).map((a) => ({
      headline: a.headline ?? null,
      description: a.description ?? null,
      byline: a.byline ?? null,
      published: a.published ?? null,
      url: a.links?.web?.href ?? null,
    })),
    tip: 'sport examples: "football/nfl", "basketball/nba", "baseball/mlb", "hockey/nhl", "soccer/eng.1"',
  };
}

// ─── get_team_info ────────────────────────────────────────────────────────────

interface EspnTeamResponse {
  team?: {
    id?: string;
    displayName?: string;
    abbreviation?: string;
    nickname?: string;
    location?: string;
    color?: string;
    alternateColor?: string;
    logos?: Array<{ href?: string }>;
    record?: { items?: Array<{ summary?: string; name?: string }> };
    links?: Array<{ href?: string; text?: string }>;
  };
}

export async function getTeamInfo(args: Record<string, unknown>): Promise<unknown> {
  const sport = String(args.sport ?? "").trim();
  const league = String(args.league ?? "").trim();
  const teamId = String(args.team_id ?? "").trim();

  if (!sport || !league || !teamId) {
    return { error: "sport, league, and team_id are all required. Example: sport=football, league=nfl, team_id=12." };
  }

  const data = await espnFetch<EspnTeamResponse>(`/${sport}/${league}/teams/${encodeURIComponent(teamId)}`);

  if (!data.team) return { error: `No team found for ${sport}/${league}/${teamId}.` };

  const t = data.team;
  return {
    id: t.id ?? null,
    name: t.displayName ?? null,
    abbreviation: t.abbreviation ?? null,
    nickname: t.nickname ?? null,
    location: t.location ?? null,
    primary_color: t.color ? `#${t.color}` : null,
    alternate_color: t.alternateColor ? `#${t.alternateColor}` : null,
    logo: t.logos?.[0]?.href ?? null,
    record: t.record?.items?.map((r) => ({ name: r.name, summary: r.summary })) ?? [],
    links: t.links?.map((l) => ({ text: l.text, url: l.href })) ?? [],
  };
}
