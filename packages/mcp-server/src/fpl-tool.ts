// Fantasy Premier League (FPL) API integration for the UnClick MCP server.
// Uses the FPL public API via fetch - no external dependencies, no API key required.
// Documentation: https://fantasy.premierleague.com/api/

const FPL_BASE = "https://fantasy.premierleague.com/api";

// ─── API helper ──────────────────────────────────────────────────────────────

async function fplFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${FPL_BASE}${path}`, {
    headers: {
      "User-Agent": "UnClick MCP Server",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`FPL API HTTP ${res.status} for ${path}`);
  }
  return res.json() as Promise<T>;
}

// ─── Operations ──────────────────────────────────────────────────────────────

export async function fplBootstrap(
  _args: Record<string, unknown>
): Promise<unknown> {
  const data = (await fplFetch<Record<string, unknown>>(
    "/bootstrap-static/"
  )) as Record<string, unknown>;

  const players = (data.elements as Record<string, unknown>[]) ?? [];
  const teams = (data.teams as Record<string, unknown>[]) ?? [];
  const events = (data.events as Record<string, unknown>[]) ?? [];

  const currentGw = events.find((e) => e.is_current === true);
  const nextGw = events.find((e) => e.is_next === true);

  return {
    total_players: players.length,
    total_teams: teams.length,
    current_gameweek: currentGw
      ? { id: currentGw.id, name: currentGw.name, deadline_time: currentGw.deadline_time }
      : null,
    next_gameweek: nextGw
      ? { id: nextGw.id, name: nextGw.name, deadline_time: nextGw.deadline_time }
      : null,
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      short_name: t.short_name,
      strength: t.strength,
    })),
    top_players: players
      .sort(
        (a, b) =>
          Number(b.total_points ?? 0) - Number(a.total_points ?? 0)
      )
      .slice(0, 20)
      .map((p) => ({
        id: p.id,
        web_name: p.web_name,
        first_name: p.first_name,
        second_name: p.second_name,
        team_id: p.team,
        position: p.element_type,
        total_points: p.total_points,
        now_cost: p.now_cost,
        selected_by_percent: p.selected_by_percent,
        form: p.form,
        status: p.status,
      })),
  };
}

export async function fplPlayer(
  args: Record<string, unknown>
): Promise<unknown> {
  const id = String(args.id ?? "").trim();
  if (!id) throw new Error("id is required (player element ID from fpl_bootstrap).");

  const data = (await fplFetch<Record<string, unknown>>(
    `/element-summary/${id}/`
  )) as Record<string, unknown>;

  const history = (data.history as Record<string, unknown>[]) ?? [];
  const fixtures = (data.fixtures as Record<string, unknown>[]) ?? [];

  return {
    player_id: id,
    season_stats: history.slice(-5).map((h) => ({
      round: h.round,
      opponent_team: h.opponent_team,
      total_points: h.total_points,
      minutes: h.minutes,
      goals_scored: h.goals_scored,
      assists: h.assists,
      clean_sheets: h.clean_sheets,
      bonus: h.bonus,
      bps: h.bps,
    })),
    upcoming_fixtures: fixtures.slice(0, 5).map((f) => ({
      event: f.event,
      difficulty: f.difficulty,
      kickoff_time: f.kickoff_time,
      is_home: f.is_home,
      team_h: f.team_h,
      team_a: f.team_a,
    })),
  };
}

export async function fplGameweek(
  args: Record<string, unknown>
): Promise<unknown> {
  const gw = String(args.gw ?? "").trim();
  if (!gw) throw new Error("gw is required (gameweek number).");

  const data = (await fplFetch<Record<string, unknown>>(
    `/event/${gw}/live/`
  )) as Record<string, unknown>;

  const elements = (data.elements as Record<string, unknown>[]) ?? [];

  return {
    gameweek: Number(gw),
    count: elements.length,
    player_scores: elements.slice(0, 50).map((e) => {
      const stats = (e.stats as Record<string, unknown>) ?? {};
      return {
        player_id: e.id,
        total_points: stats.total_points,
        minutes: stats.minutes,
        goals_scored: stats.goals_scored,
        assists: stats.assists,
        bonus: stats.bonus,
        clean_sheets: stats.clean_sheets,
      };
    }),
  };
}

export async function fplFixtures(
  args: Record<string, unknown>
): Promise<unknown> {
  const path = args.gw ? `/fixtures/?event=${args.gw}` : "/fixtures/";
  const data = (await fplFetch<Record<string, unknown>[]>(path)) as Record<
    string,
    unknown
  >[];

  return {
    count: data.length,
    fixtures: data.slice(0, 50).map((f) => ({
      id: f.id,
      event: f.event,
      kickoff_time: f.kickoff_time,
      team_h: f.team_h,
      team_a: f.team_a,
      team_h_score: f.team_h_score ?? null,
      team_a_score: f.team_a_score ?? null,
      started: f.started,
      finished: f.finished,
    })),
  };
}

export async function fplMyTeam(
  args: Record<string, unknown>
): Promise<unknown> {
  const teamId = String(args.team_id ?? "").trim();
  const gw = String(args.gw ?? "").trim();
  if (!teamId) throw new Error("team_id is required.");
  if (!gw) throw new Error("gw is required (gameweek number).");

  const data = (await fplFetch<Record<string, unknown>>(
    `/entry/${teamId}/event/${gw}/picks/`
  )) as Record<string, unknown>;

  const picks = (data.picks as Record<string, unknown>[]) ?? [];

  return {
    team_id: teamId,
    gameweek: Number(gw),
    active_chip: data.active_chip ?? null,
    picks: picks.map((p) => ({
      element: p.element,
      position: p.position,
      multiplier: p.multiplier,
      is_captain: p.is_captain,
      is_vice_captain: p.is_vice_captain,
    })),
  };
}

export async function fplManager(
  args: Record<string, unknown>
): Promise<unknown> {
  const teamId = String(args.team_id ?? "").trim();
  if (!teamId) throw new Error("team_id is required.");

  const data = (await fplFetch<Record<string, unknown>>(
    `/entry/${teamId}/`
  )) as Record<string, unknown>;

  return {
    team_id: teamId,
    manager_name: `${data.player_first_name ?? ""} ${data.player_last_name ?? ""}`.trim(),
    team_name: data.name,
    overall_rank: data.summary_overall_rank ?? null,
    overall_points: data.summary_overall_points ?? null,
    last_deadline_bank: data.last_deadline_bank ?? null,
    last_deadline_value: data.last_deadline_value ?? null,
    started_event: data.started_event ?? null,
    favourite_team: data.favourite_team ?? null,
  };
}

export async function fplLeaguesClassic(
  args: Record<string, unknown>
): Promise<unknown> {
  const leagueId = String(args.league_id ?? "").trim();
  if (!leagueId) throw new Error("league_id is required.");
  const page = Math.max(1, Number(args.page ?? 1));

  const data = (await fplFetch<Record<string, unknown>>(
    `/leagues-classic/${leagueId}/standings/?page_standings=${page}`
  )) as Record<string, unknown>;

  const league = (data.league as Record<string, unknown>) ?? {};
  const standings = (data.standings as Record<string, unknown>) ?? {};
  const results = (standings.results as Record<string, unknown>[]) ?? [];

  return {
    league_id: leagueId,
    league_name: league.name ?? null,
    page,
    has_next: standings.has_next ?? false,
    count: results.length,
    standings: results.map((r) => ({
      rank: r.rank,
      last_rank: r.last_rank,
      team_name: r.entry_name,
      manager_name: r.player_name,
      entry_id: r.entry,
      total: r.total,
      event_total: r.event_total,
    })),
  };
}
