// Sleeper fantasy sports API.
// No authentication required.
// Base URL: https://api.sleeper.app/v1/

const SLEEPER_BASE = "https://api.sleeper.app/v1";

async function sleeperFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${SLEEPER_BASE}${path}`, {
    headers: { "User-Agent": "UnClickMCP/1.0 (https://unclick.io)" },
  });
  if (!res.ok) throw new Error(`Sleeper API HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── get_nfl_state ────────────────────────────────────────────────────────────

interface NflState {
  week: number;
  season_type: string;
  season_start_date: string;
  season: string;
  previous_season: string;
  leg: number;
  league_season: string;
  league_create_season: string;
  display_week: number;
}

export async function getNflState(_args: Record<string, unknown>): Promise<unknown> {
  const data = await sleeperFetch<NflState>("/state/nfl");
  return {
    current_week: data.week,
    display_week: data.display_week,
    season: data.season,
    season_type: data.season_type,
    season_start_date: data.season_start_date,
    previous_season: data.previous_season,
    leg: data.leg,
  };
}

// ─── get_sleeper_players ──────────────────────────────────────────────────────

interface SleeperPlayer {
  player_id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  team?: string;
  status?: string;
  injury_status?: string;
  age?: number;
  years_exp?: number;
  fantasy_positions?: string[];
}

export async function getSleeperPlayers(args: Record<string, unknown>): Promise<unknown> {
  const confirmed = args.confirmed === true || String(args.confirmed) === "true";

  if (!confirmed) {
    return {
      warning: "This endpoint returns a very large payload (5MB+) containing all NFL players. Pass confirmed: true to proceed.",
      tip: "For trending players use get_trending_players instead, which is much smaller.",
    };
  }

  const data = await sleeperFetch<Record<string, SleeperPlayer>>("/players/nfl");
  const players = Object.values(data).filter((p) => p.full_name || (p.first_name && p.last_name));

  return {
    total_players: players.length,
    note: "Full player list. Filter by position, team, or status as needed.",
    players: players.slice(0, 200).map((p) => ({
      id: p.player_id,
      name: p.full_name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
      position: p.position ?? null,
      team: p.team ?? null,
      status: p.status ?? null,
      injury_status: p.injury_status ?? null,
      age: p.age ?? null,
      years_exp: p.years_exp ?? null,
    })),
    truncated: players.length > 200,
    truncated_message: players.length > 200 ? `Showing first 200 of ${players.length} players.` : null,
  };
}

// ─── get_trending_players ─────────────────────────────────────────────────────

interface TrendingPlayer {
  player_id: string;
  count: number;
}

export async function getTrendingPlayers(args: Record<string, unknown>): Promise<unknown> {
  const type = String(args.type ?? "add").toLowerCase();
  if (!["add", "drop"].includes(type)) {
    return { error: 'type must be "add" or "drop".' };
  }

  const limit = Math.min(25, Math.max(1, Number(args.limit ?? 10)));
  const data = await sleeperFetch<TrendingPlayer[]>(`/players/nfl/trending/${type}?limit=${limit}`);

  return {
    type,
    limit,
    count: data.length,
    trending: data.map((p) => ({
      player_id: p.player_id,
      transaction_count: p.count,
    })),
    tip: "Use get_sleeper_players (confirmed: true) to look up player details by player_id.",
  };
}

// ─── get_sleeper_league ───────────────────────────────────────────────────────

interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  season_type: string;
  status: string;
  sport: string;
  total_rosters: number;
  roster_positions: string[];
  scoring_settings?: Record<string, number>;
  settings?: Record<string, unknown>;
  draft_id?: string;
  avatar?: string;
}

export async function getSleeperLeague(args: Record<string, unknown>): Promise<unknown> {
  const leagueId = String(args.league_id ?? "").trim();
  if (!leagueId) return { error: "league_id is required." };

  const data = await sleeperFetch<SleeperLeague>(`/league/${encodeURIComponent(leagueId)}`);

  return {
    league_id: data.league_id,
    name: data.name,
    season: data.season,
    season_type: data.season_type,
    status: data.status,
    sport: data.sport,
    total_rosters: data.total_rosters,
    roster_positions: data.roster_positions,
    draft_id: data.draft_id ?? null,
    scoring_settings: data.scoring_settings ?? null,
  };
}

// ─── get_league_rosters ───────────────────────────────────────────────────────

interface SleeperRoster {
  roster_id: number;
  owner_id?: string;
  league_id: string;
  players?: string[];
  starters?: string[];
  reserve?: string[];
  taxi?: string[];
  settings?: {
    wins?: number;
    losses?: number;
    ties?: number;
    fpts?: number;
    fpts_decimal?: number;
    fpts_against?: number;
    fpts_against_decimal?: number;
    waiver_position?: number;
    waiver_budget_used?: number;
  };
}

export async function getLeagueRosters(args: Record<string, unknown>): Promise<unknown> {
  const leagueId = String(args.league_id ?? "").trim();
  if (!leagueId) return { error: "league_id is required." };

  const data = await sleeperFetch<SleeperRoster[]>(`/league/${encodeURIComponent(leagueId)}/rosters`);

  return {
    league_id: leagueId,
    roster_count: data.length,
    rosters: data.map((r) => ({
      roster_id: r.roster_id,
      owner_id: r.owner_id ?? null,
      player_count: r.players?.length ?? 0,
      starters: r.starters ?? [],
      bench: (r.players ?? []).filter((p) => !(r.starters ?? []).includes(p)),
      reserve: r.reserve ?? [],
      taxi: r.taxi ?? [],
      record: r.settings
        ? {
            wins: r.settings.wins ?? 0,
            losses: r.settings.losses ?? 0,
            ties: r.settings.ties ?? 0,
            points_for: ((r.settings.fpts ?? 0) + (r.settings.fpts_decimal ?? 0) / 100),
            points_against: ((r.settings.fpts_against ?? 0) + (r.settings.fpts_against_decimal ?? 0) / 100),
          }
        : null,
    })),
  };
}

// ─── get_league_matchups ──────────────────────────────────────────────────────

interface SleeperMatchup {
  roster_id: number;
  matchup_id: number;
  players?: string[];
  starters?: string[];
  points: number;
  players_points?: Record<string, number>;
  custom_points?: number | null;
}

export async function getLeagueMatchups(args: Record<string, unknown>): Promise<unknown> {
  const leagueId = String(args.league_id ?? "").trim();
  const week = Number(args.week ?? 0);

  if (!leagueId) return { error: "league_id is required." };
  if (!week || isNaN(week)) return { error: "week is required (numeric week number)." };

  const data = await sleeperFetch<SleeperMatchup[]>(`/league/${encodeURIComponent(leagueId)}/matchups/${week}`);

  // Group by matchup_id
  const grouped: Record<number, SleeperMatchup[]> = {};
  for (const m of data) {
    if (!grouped[m.matchup_id]) grouped[m.matchup_id] = [];
    grouped[m.matchup_id].push(m);
  }

  const matchups = Object.entries(grouped).map(([matchupId, rosters]) => ({
    matchup_id: Number(matchupId),
    rosters: rosters.map((r) => ({
      roster_id: r.roster_id,
      points: r.points,
      starters: r.starters ?? [],
      player_count: r.players?.length ?? 0,
    })),
  }));

  return {
    league_id: leagueId,
    week,
    matchup_count: matchups.length,
    matchups,
  };
}
