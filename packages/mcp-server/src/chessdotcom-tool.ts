// Chess.com Public API integration for the UnClick MCP server.
// Uses the Chess.com Published-Data API via fetch - no external dependencies, no API key required.
// Documentation: https://www.chess.com/news/view/published-data-api

const CHESS_BASE = "https://api.chess.com/pub";

// ─── API helper ──────────────────────────────────────────────────────────────

async function chessFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${CHESS_BASE}${path}`, {
    headers: {
      "User-Agent": "UnClick MCP Server",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        `Not found (HTTP 404). Check the username or resource exists.`
      );
    }
    throw new Error(`Chess.com API HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Operations ──────────────────────────────────────────────────────────────

export async function chessPlayer(
  args: Record<string, unknown>
): Promise<unknown> {
  const username = String(args.username ?? "").trim().toLowerCase();
  if (!username) throw new Error("username is required.");

  const data = (await chessFetch<Record<string, unknown>>(
    `/player/${username}`
  )) as Record<string, unknown>;

  return {
    username: data.username,
    name: data.name ?? null,
    title: data.title ?? null,
    country: data.country ?? null,
    location: data.location ?? null,
    joined: data.joined ? new Date(Number(data.joined) * 1000).toISOString() : null,
    last_online: data.last_online
      ? new Date(Number(data.last_online) * 1000).toISOString()
      : null,
    followers: data.followers ?? 0,
    is_streamer: data.is_streamer ?? false,
    verified: data.verified ?? false,
    url: data.url ?? null,
    avatar: data.avatar ?? null,
  };
}

export async function chessPlayerStats(
  args: Record<string, unknown>
): Promise<unknown> {
  const username = String(args.username ?? "").trim().toLowerCase();
  if (!username) throw new Error("username is required.");

  const data = (await chessFetch<Record<string, unknown>>(
    `/player/${username}/stats`
  )) as Record<string, unknown>;

  const extractRating = (gameType: unknown) => {
    if (!gameType || typeof gameType !== "object") return null;
    const gt = gameType as Record<string, unknown>;
    const last = (gt.last as Record<string, unknown>) ?? {};
    const best = (gt.best as Record<string, unknown>) ?? {};
    const record = (gt.record as Record<string, unknown>) ?? {};
    return {
      rating: last.rating ?? null,
      best_rating: best.rating ?? null,
      wins: record.win ?? 0,
      losses: record.loss ?? 0,
      draws: record.draw ?? 0,
    };
  };

  return {
    username,
    chess_rapid: extractRating(data.chess_rapid),
    chess_blitz: extractRating(data.chess_blitz),
    chess_bullet: extractRating(data.chess_bullet),
    chess_daily: extractRating(data.chess_daily),
    tactics: data.tactics
      ? {
          highest: (data.tactics as Record<string, unknown>).highest ?? null,
          lowest: (data.tactics as Record<string, unknown>).lowest ?? null,
        }
      : null,
    puzzle_rush: data.puzzle_rush ?? null,
  };
}

export async function chessPlayerGames(
  args: Record<string, unknown>
): Promise<unknown> {
  const username = String(args.username ?? "").trim().toLowerCase();
  if (!username) throw new Error("username is required.");
  const year = String(args.year ?? "").trim();
  const month = String(args.month ?? "").trim().padStart(2, "0");
  if (!year) throw new Error("year is required (e.g. 2024).");
  if (!args.month) throw new Error("month is required (e.g. 1 for January).");

  const data = (await chessFetch<Record<string, unknown>>(
    `/player/${username}/games/${year}/${month}`
  )) as Record<string, unknown>;

  const games = (data.games as Record<string, unknown>[]) ?? [];

  return {
    username,
    year,
    month,
    count: games.length,
    games: games.slice(-20).map((g) => ({
      url: g.url,
      pgn_first_move: g.pgn
        ? String(g.pgn).split("\n").filter((l: string) => !l.startsWith("[")).join(" ").trim().slice(0, 100)
        : null,
      time_class: g.time_class,
      time_control: g.time_control,
      rated: g.rated,
      white: {
        username: (g.white as Record<string, unknown>)?.username,
        result: (g.white as Record<string, unknown>)?.result,
        rating: (g.white as Record<string, unknown>)?.rating,
      },
      black: {
        username: (g.black as Record<string, unknown>)?.username,
        result: (g.black as Record<string, unknown>)?.result,
        rating: (g.black as Record<string, unknown>)?.rating,
      },
      end_time: g.end_time
        ? new Date(Number(g.end_time) * 1000).toISOString()
        : null,
    })),
  };
}

export async function chessPuzzlesRandom(
  _args: Record<string, unknown>
): Promise<unknown> {
  const data = (await chessFetch<Record<string, unknown>>(
    "/puzzle/random"
  )) as Record<string, unknown>;

  return {
    title: data.title ?? null,
    url: data.url ?? null,
    publish_time: data.publish_time
      ? new Date(Number(data.publish_time) * 1000).toISOString()
      : null,
    fen: data.fen ?? null,
    pgn: data.pgn ?? null,
    image: data.image ?? null,
  };
}

export async function chessLeaderboards(
  args: Record<string, unknown>
): Promise<unknown> {
  const data = (await chessFetch<Record<string, unknown>>(
    "/leaderboards"
  )) as Record<string, unknown>;

  const gameType = args.game_type ? String(args.game_type) : null;
  const validTypes = [
    "live_rapid",
    "live_blitz",
    "live_bullet",
    "live_bughouse",
    "live_blitz960",
    "live_threecheck",
    "live_crazyhouse",
    "live_kingofthehill",
    "tactics",
    "lessons",
    "puzzle_rush",
    "daily",
    "daily960",
  ];

  if (gameType) {
    if (!validTypes.includes(gameType)) {
      throw new Error(
        `game_type must be one of: ${validTypes.join(", ")}`
      );
    }
    const board = (data[gameType] as Record<string, unknown>[]) ?? [];
    return {
      game_type: gameType,
      count: board.length,
      players: board.slice(0, 20).map((p) => ({
        rank: p.rank,
        username: p.username,
        score: p.score,
        title: p.title ?? null,
        country: p.country ?? null,
      })),
    };
  }

  const result: Record<string, unknown> = {};
  for (const type of ["live_rapid", "live_blitz", "live_bullet", "daily"]) {
    const board = (data[type] as Record<string, unknown>[]) ?? [];
    result[type] = board.slice(0, 5).map((p) => ({
      rank: p.rank,
      username: p.username,
      score: p.score,
      title: p.title ?? null,
    }));
  }
  return {
    note: "Showing top 5 for rapid, blitz, bullet, and daily. Pass game_type for a full leaderboard.",
    leaderboards: result,
  };
}
