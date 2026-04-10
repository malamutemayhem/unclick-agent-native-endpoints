// Speedrun.com API - games, runs, and leaderboards.
// Docs: https://github.com/speedruncomorg/api
// Auth: None required for public data
// Base: https://www.speedrun.com/api/v1

const SPEEDRUN_BASE = "https://www.speedrun.com/api/v1";

async function speedrunGet(
  path: string,
  params?: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${SPEEDRUN_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (res.status === 404) throw new Error(`Speedrun.com: resource not found at ${path}.`);
  if (res.status === 420) throw new Error("Speedrun.com rate limit exceeded. Please wait before retrying.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Speedrun.com HTTP ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<unknown>;
}

// speedrun_search_games
export async function speedrunSearchGames(args: Record<string, unknown>): Promise<unknown> {
  try {
    const name = String(args.name ?? "").trim();
    if (!name) return { error: "name is required." };
    const params: Record<string, string> = { name };
    if (args.max) params.max = String(args.max);

    const json = await speedrunGet("/games", params) as Record<string, unknown>;
    const data = (json.data ?? []) as Array<Record<string, unknown>>;
    return {
      count: data.length,
      games: data.map((g) => ({
        id: g.id,
        names: g.names,
        abbreviation: g.abbreviation,
        weblink: g.weblink,
        released: g.released,
        platforms: (g.platforms as string[] | undefined) ?? [],
        regions: (g.regions as string[] | undefined) ?? [],
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// speedrun_get_game
export async function speedrunGetGame(args: Record<string, unknown>): Promise<unknown> {
  try {
    const gameId = String(args.game_id ?? "").trim();
    if (!gameId) return { error: "game_id is required (use speedrun_search_games to find an ID)." };

    const json = await speedrunGet(`/games/${gameId}`, { embed: "categories,levels,platforms" }) as Record<string, unknown>;
    const data = json.data as Record<string, unknown> | undefined;
    if (!data) return { error: "Game not found." };
    return {
      id: data.id,
      names: data.names,
      abbreviation: data.abbreviation,
      weblink: data.weblink,
      released: data.released,
      categories: (data.categories as Record<string, unknown>)?.data ?? [],
      levels: (data.levels as Record<string, unknown>)?.data ?? [],
      platforms: (data.platforms as Record<string, unknown>)?.data ?? [],
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// speedrun_get_leaderboard
export async function speedrunGetLeaderboard(args: Record<string, unknown>): Promise<unknown> {
  try {
    const gameId = String(args.game_id ?? "").trim();
    if (!gameId) return { error: "game_id is required." };
    const categoryId = String(args.category_id ?? "").trim();
    if (!categoryId) return { error: "category_id is required." };

    const params: Record<string, string> = { embed: "players" };
    if (args.top) params.top = String(args.top);
    if (args.platform) params.platform = String(args.platform);
    if (args.region) params.region = String(args.region);
    if (args.emulators !== undefined) params.emulators = String(args.emulators);
    if (args.video_only !== undefined) params.video_only = String(args.video_only);

    const json = await speedrunGet(`/leaderboards/${gameId}/category/${categoryId}`, params) as Record<string, unknown>;
    const data = json.data as Record<string, unknown> | undefined;
    const runs = (data?.runs ?? []) as Array<Record<string, unknown>>;
    return {
      game: data?.game,
      category: data?.category,
      weblink: data?.weblink,
      count: runs.length,
      runs: runs.map((r) => {
        const run = r.run as Record<string, unknown>;
        return {
          place: r.place,
          run_id: run?.id,
          status: (run?.status as Record<string, unknown>)?.status,
          times: run?.times,
          date: run?.date,
          weblink: run?.weblink,
          players: run?.players,
          videos: run?.videos,
        };
      }),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// speedrun_list_runs
export async function speedrunListRuns(args: Record<string, unknown>): Promise<unknown> {
  try {
    const params: Record<string, string> = {};
    if (args.game) params.game = String(args.game);
    if (args.category) params.category = String(args.category);
    if (args.user) params.user = String(args.user);
    if (args.status) params.status = String(args.status);
    if (args.orderby) params.orderby = String(args.orderby);
    if (args.direction) params.direction = String(args.direction);
    if (args.max) params.max = String(args.max);
    if (!params.game && !params.user) return { error: "At least game or user is required." };

    const json = await speedrunGet("/runs", params) as Record<string, unknown>;
    const data = (json.data ?? []) as Array<Record<string, unknown>>;
    return {
      count: data.length,
      runs: data.map((r) => ({
        id: r.id,
        game: r.game,
        category: r.category,
        status: (r.status as Record<string, unknown>)?.status,
        times: r.times,
        date: r.date,
        weblink: r.weblink,
        players: r.players,
        videos: r.videos,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// speedrun_get_user
export async function speedrunGetUser(args: Record<string, unknown>): Promise<unknown> {
  try {
    const userId = String(args.user_id ?? "").trim();
    if (!userId) return { error: "user_id is required (can be the username or ID)." };

    const json = await speedrunGet(`/users/${userId}`) as Record<string, unknown>;
    const data = json.data as Record<string, unknown> | undefined;
    if (!data) return { error: "User not found." };
    return {
      id: data.id,
      names: data.names,
      weblink: data.weblink,
      location: data.location,
      signup: data.signup,
      role: data.role,
      links: data.links,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
