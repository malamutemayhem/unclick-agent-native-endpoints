// Lichess API integration for the UnClick MCP server.
// Uses the Lichess public API via fetch - no external dependencies, no API key required.
// Documentation: https://lichess.org/api

const LICHESS_BASE = "https://lichess.org/api";

// ─── API helper ──────────────────────────────────────────────────────────────

async function lichessFetch<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${LICHESS_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "UnClick MCP Server",
    },
  });
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("Not found (HTTP 404). Check the username or resource exists.");
    }
    const text = await res.text().catch(() => "");
    throw new Error(`Lichess API HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// ─── Operations ──────────────────────────────────────────────────────────────

export async function lichessUser(
  args: Record<string, unknown>
): Promise<unknown> {
  const username = String(args.username ?? "").trim().toLowerCase();
  if (!username) throw new Error("username is required.");

  const data = (await lichessFetch<Record<string, unknown>>(
    `/user/${username}`
  )) as Record<string, unknown>;

  const perfs = (data.perfs as Record<string, unknown>) ?? {};
  const ratings: Record<string, number | null> = {};
  for (const [key, val] of Object.entries(perfs)) {
    ratings[key] = (val as Record<string, unknown>).rating as number ?? null;
  }

  return {
    id: data.id,
    username: data.username,
    title: data.title ?? null,
    patron: data.patron ?? false,
    created_at: data.createdAt
      ? new Date(Number(data.createdAt)).toISOString()
      : null,
    seen_at: data.seenAt
      ? new Date(Number(data.seenAt)).toISOString()
      : null,
    play_time_hours: data.playTime
      ? Math.round(Number((data.playTime as Record<string, unknown>).total) / 3600)
      : null,
    game_count: data.count
      ? (data.count as Record<string, unknown>).all
      : null,
    ratings,
    online: data.online ?? false,
  };
}

export async function lichessUserGames(
  args: Record<string, unknown>
): Promise<unknown> {
  const username = String(args.username ?? "").trim().toLowerCase();
  if (!username) throw new Error("username is required.");
  const max = Math.min(50, Math.max(1, Number(args.max ?? 10)));

  // Lichess returns NDJSON by default; request JSON
  const url = new URL(`${LICHESS_BASE}/games/user/${username}`);
  url.searchParams.set("max", String(max));
  url.searchParams.set("pgnInJson", "false");
  url.searchParams.set("clocks", "false");
  url.searchParams.set("evals", "false");
  url.searchParams.set("opening", "true");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/x-ndjson",
      "User-Agent": "UnClick MCP Server",
    },
  });

  if (!res.ok) {
    throw new Error(`Lichess API HTTP ${res.status}`);
  }

  const text = await res.text();
  const games = text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((g): g is Record<string, unknown> => g !== null);

  return {
    username,
    count: games.length,
    games: games.map((g) => {
      const players = (g.players as Record<string, unknown>) ?? {};
      const white = (players.white as Record<string, unknown>) ?? {};
      const black = (players.black as Record<string, unknown>) ?? {};
      return {
        id: g.id,
        rated: g.rated,
        speed: g.speed,
        status: g.status,
        winner: g.winner ?? null,
        created_at: g.createdAt
          ? new Date(Number(g.createdAt)).toISOString()
          : null,
        white: {
          user: (white.user as Record<string, unknown>)?.name ?? null,
          rating: white.rating ?? null,
          result: g.winner === "white" ? "win" : g.winner === "black" ? "loss" : "draw",
        },
        black: {
          user: (black.user as Record<string, unknown>)?.name ?? null,
          rating: black.rating ?? null,
          result: g.winner === "black" ? "win" : g.winner === "white" ? "loss" : "draw",
        },
        opening: g.opening
          ? (g.opening as Record<string, unknown>).name
          : null,
      };
    }),
  };
}

export async function lichessPuzzleDaily(
  _args: Record<string, unknown>
): Promise<unknown> {
  const data = (await lichessFetch<Record<string, unknown>>(
    "/puzzle/daily"
  )) as Record<string, unknown>;

  const puzzle = (data.puzzle as Record<string, unknown>) ?? {};
  const game = (data.game as Record<string, unknown>) ?? {};

  return {
    id: puzzle.id,
    rating: puzzle.rating ?? null,
    plays: puzzle.plays ?? null,
    themes: puzzle.themes ?? [],
    solution: puzzle.solution ?? [],
    fen: (game.pgn as string)?.split(" ").pop() ?? null,
    pgn: game.pgn ?? null,
    url: puzzle.id ? `https://lichess.org/training/${puzzle.id}` : null,
  };
}

export async function lichessTopPlayers(
  args: Record<string, unknown>
): Promise<unknown> {
  const perfType = String(args.perfType ?? "bullet");
  const validTypes = [
    "ultraBullet",
    "bullet",
    "blitz",
    "rapid",
    "classical",
    "chess960",
    "crazyhouse",
    "antichess",
    "atomic",
    "horde",
    "kingOfTheHill",
    "racingKings",
    "threeCheck",
  ];
  if (!validTypes.includes(perfType)) {
    throw new Error(`perfType must be one of: ${validTypes.join(", ")}`);
  }

  const data = (await lichessFetch<Record<string, unknown>>(
    `/player/top/10/${perfType}`
  )) as Record<string, unknown>;

  const users = (data.users as Record<string, unknown>[]) ?? [];

  return {
    perf_type: perfType,
    count: users.length,
    players: users.map((u) => {
      const perfs = (u.perfs as Record<string, unknown>) ?? {};
      const perf = (perfs[perfType] as Record<string, unknown>) ?? {};
      return {
        id: u.id,
        username: u.username,
        title: u.title ?? null,
        patron: u.patron ?? false,
        rating: perf.rating ?? null,
        progress: perf.progress ?? null,
      };
    }),
  };
}

export async function lichessTournament(
  args: Record<string, unknown>
): Promise<unknown> {
  const id = String(args.id ?? "").trim();
  if (!id) throw new Error("id is required (Lichess tournament ID).");

  const data = (await lichessFetch<Record<string, unknown>>(
    `/tournament/${id}`
  )) as Record<string, unknown>;

  const podium = (data.podium as Record<string, unknown>[]) ?? [];

  return {
    id: data.id,
    full_name: data.fullName ?? data.id,
    status: data.status ?? null,
    starts_at: data.startsAt
      ? new Date(Number(data.startsAt)).toISOString()
      : null,
    finished_at: data.finishesAt
      ? new Date(Number(data.finishesAt)).toISOString()
      : null,
    nb_players: data.nbPlayers ?? null,
    winner: podium[0]
      ? {
          username: (podium[0].player as Record<string, unknown>)?.name ?? null,
          score: podium[0].score ?? null,
        }
      : null,
    podium: podium.slice(0, 3).map((p) => ({
      username: (p.player as Record<string, unknown>)?.name ?? null,
      score: p.score ?? null,
      nb: p.nb ?? null,
    })),
    url: `https://lichess.org/tournament/${id}`,
  };
}
