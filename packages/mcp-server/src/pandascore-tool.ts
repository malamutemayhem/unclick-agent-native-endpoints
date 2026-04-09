// PandaScore Esports API integration.
// Docs: https://developers.pandascore.co/
// Env var: PANDASCORE_TOKEN (header: Authorization: Bearer {token})
// Base URL: https://api.pandascore.co/

const PANDASCORE_BASE = "https://api.pandascore.co";

// ─── API helper ───────────────────────────────────────────────────────────────

function requireKey(args: Record<string, unknown>): string {
  const key = String(
    args.api_key ?? process.env.PANDASCORE_TOKEN ?? ""
  ).trim();
  if (!key) {
    throw new Error(
      "PANDASCORE_TOKEN is required. Register at https://pandascore.co/"
    );
  }
  return key;
}

async function pandascoreFetch<T>(
  path: string,
  token: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${PANDASCORE_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "UnClickMCP/1.0 (https://unclick.io)",
    },
  });

  if (!res.ok) {
    const body = (await res.json()) as Record<string, unknown>;
    throw new Error(
      `PandaScore API HTTP ${res.status}: ${String(body.error ?? body.message ?? "Unknown error")}`
    );
  }

  return res.json() as Promise<T>;
}

// ─── esports_matches ──────────────────────────────────────────────────────────
// GET /matches (optionally filtered by game/status)

export async function esportsMatches(
  args: Record<string, unknown>
): Promise<unknown> {
  const token = requireKey(args);
  const params: Record<string, string> = {};
  if (args.status) params["filter[status]"] = String(args.status);
  if (args.page) params.page = String(args.page);

  // Game filter uses the videogame slug prefix on the path
  const game = String(args.game ?? "").toLowerCase();
  const path = game ? `/${game}/matches` : "/matches";

  const data = await pandascoreFetch<Record<string, unknown>[]>(
    path,
    token,
    params
  );

  const matches = Array.isArray(data) ? data : [];

  return {
    count: matches.length,
    matches: matches.map((m) => ({
      id: m.id,
      name: m.name,
      status: m.status,
      scheduled_at: m.scheduled_at ?? null,
      begin_at: m.begin_at ?? null,
      end_at: m.end_at ?? null,
      game: m.videogame
        ? (m.videogame as Record<string, unknown>).name
        : null,
      league: m.league
        ? (m.league as Record<string, unknown>).name
        : null,
      serie: m.serie
        ? (m.serie as Record<string, unknown>).full_name
        : null,
      tournament: m.tournament
        ? (m.tournament as Record<string, unknown>).name
        : null,
      opponents:
        ((m.opponents as Record<string, unknown>[]) ?? []).map((o) => ({
          type: o.type,
          name:
            (o.opponent as Record<string, unknown>)?.name ?? null,
          acronym:
            (o.opponent as Record<string, unknown>)?.acronym ?? null,
        })),
      results:
        ((m.results as Record<string, unknown>[]) ?? []).map((r) => ({
          team_id: r.team_id,
          score: r.score,
        })),
      winner: m.winner
        ? {
            id: (m.winner as Record<string, unknown>).id,
            name: (m.winner as Record<string, unknown>).name,
          }
        : null,
    })),
  };
}

// ─── esports_tournaments ──────────────────────────────────────────────────────
// GET /tournaments

export async function esportsTournaments(
  args: Record<string, unknown>
): Promise<unknown> {
  const token = requireKey(args);
  const params: Record<string, string> = {};
  if (args.tier) params["filter[tier]"] = String(args.tier);

  const game = String(args.game ?? "").toLowerCase();
  const path = game ? `/${game}/tournaments` : "/tournaments";

  const data = await pandascoreFetch<Record<string, unknown>[]>(
    path,
    token,
    params
  );

  const tournaments = Array.isArray(data) ? data : [];

  return {
    count: tournaments.length,
    tournaments: tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug ?? null,
      tier: t.tier ?? null,
      begin_at: t.begin_at ?? null,
      end_at: t.end_at ?? null,
      game: t.videogame
        ? (t.videogame as Record<string, unknown>).name
        : null,
      league: t.league
        ? (t.league as Record<string, unknown>).name
        : null,
      serie: t.serie
        ? (t.serie as Record<string, unknown>).full_name
        : null,
      expected_roster: t.expected_roster ?? null,
      prizepool: t.prizepool ?? null,
    })),
  };
}

// ─── esports_teams ────────────────────────────────────────────────────────────
// GET /teams

export async function esportsTeams(
  args: Record<string, unknown>
): Promise<unknown> {
  const token = requireKey(args);
  const game = String(args.game ?? "").toLowerCase();
  const path = game ? `/${game}/teams` : "/teams";

  const data = await pandascoreFetch<Record<string, unknown>[]>(
    path,
    token
  );

  const teams = Array.isArray(data) ? data : [];

  return {
    count: teams.length,
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      acronym: t.acronym ?? null,
      slug: t.slug ?? null,
      location: t.location ?? null,
      image_url: t.image_url ?? null,
      current_videogame: t.current_videogame
        ? (t.current_videogame as Record<string, unknown>).name
        : null,
      players:
        ((t.players as Record<string, unknown>[]) ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          first_name: p.first_name ?? null,
          last_name: p.last_name ?? null,
          role: p.role ?? null,
          nationality: p.nationality ?? null,
        })),
    })),
  };
}

// ─── esports_players ──────────────────────────────────────────────────────────
// GET /players

export async function esportsPlayers(
  args: Record<string, unknown>
): Promise<unknown> {
  const token = requireKey(args);
  const game = String(args.game ?? "").toLowerCase();
  const path = game ? `/${game}/players` : "/players";

  const data = await pandascoreFetch<Record<string, unknown>[]>(
    path,
    token
  );

  const players = Array.isArray(data) ? data : [];

  return {
    count: players.length,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      first_name: p.first_name ?? null,
      last_name: p.last_name ?? null,
      role: p.role ?? null,
      nationality: p.nationality ?? null,
      age: p.age ?? null,
      image_url: p.image_url ?? null,
      current_team: p.current_team
        ? {
            id: (p.current_team as Record<string, unknown>).id,
            name: (p.current_team as Record<string, unknown>).name,
            acronym: (p.current_team as Record<string, unknown>).acronym ?? null,
          }
        : null,
      current_videogame: p.current_videogame
        ? (p.current_videogame as Record<string, unknown>).name
        : null,
    })),
  };
}

// ─── esports_get_match ────────────────────────────────────────────────────────
// GET /matches/{id}

export async function esportsGetMatch(
  args: Record<string, unknown>
): Promise<unknown> {
  const token = requireKey(args);
  const id = String(args.id ?? "").trim();
  if (!id) return { error: "id is required (PandaScore match ID)." };

  const data = await pandascoreFetch<Record<string, unknown>>(
    `/matches/${encodeURIComponent(id)}`,
    token
  );

  return {
    id: data.id,
    name: data.name,
    status: data.status,
    number_of_games: data.number_of_games ?? null,
    scheduled_at: data.scheduled_at ?? null,
    begin_at: data.begin_at ?? null,
    end_at: data.end_at ?? null,
    modified_at: data.modified_at ?? null,
    game: data.videogame
      ? (data.videogame as Record<string, unknown>).name
      : null,
    league: data.league
      ? (data.league as Record<string, unknown>).name
      : null,
    serie: data.serie
      ? (data.serie as Record<string, unknown>).full_name
      : null,
    tournament: data.tournament
      ? (data.tournament as Record<string, unknown>).name
      : null,
    opponents:
      ((data.opponents as Record<string, unknown>[]) ?? []).map((o) => ({
        type: o.type,
        name: (o.opponent as Record<string, unknown>)?.name ?? null,
        acronym:
          (o.opponent as Record<string, unknown>)?.acronym ?? null,
        players:
          ((o.opponent as Record<string, unknown>)?.players as Record<string, unknown>[])
            ?.map((p) => ({ id: p.id, name: p.name, role: p.role ?? null })) ?? [],
      })),
    results:
      ((data.results as Record<string, unknown>[]) ?? []).map((r) => ({
        team_id: r.team_id,
        score: r.score,
      })),
    winner: data.winner
      ? {
          id: (data.winner as Record<string, unknown>).id,
          name: (data.winner as Record<string, unknown>).name,
        }
      : null,
    games:
      ((data.games as Record<string, unknown>[]) ?? []).map((g) => ({
        id: g.id,
        position: g.position,
        status: g.status,
        winner: g.winner
          ? (g.winner as Record<string, unknown>).name
          : null,
        length: g.length ?? null,
      })),
  };
}
