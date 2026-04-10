// Steam Web API - player data, games, achievements.
// Docs: https://developer.valvesoftware.com/wiki/Steam_Web_API
// Auth: STEAM_API_KEY (API key query param)
// Base: https://api.steampowered.com

const STEAM_BASE = "https://api.steampowered.com";
const STEAM_STORE_BASE = "https://store.steampowered.com/api";

function getApiKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.STEAM_API_KEY ?? "").trim();
  if (!key) throw new Error("api_key is required (or set STEAM_API_KEY env var).");
  return key;
}

async function steamGet(
  path: string,
  params: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${STEAM_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (res.status === 401 || res.status === 403) throw new Error("Invalid Steam API key.");
  if (res.status === 429) throw new Error("Steam rate limit exceeded.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Steam HTTP ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<unknown>;
}

async function steamStoreGet(
  path: string,
  params: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${STEAM_STORE_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Steam Store HTTP ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<unknown>;
}

// get_steam_player_summaries
export async function getSteamPlayerSummaries(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const steamids = String(args.steamids ?? "").trim();
    if (!steamids) return { error: "steamids is required (comma-separated Steam64 IDs, up to 100)." };

    const json = await steamGet("/ISteamUser/GetPlayerSummaries/v2/", {
      key: apiKey,
      steamids,
    }) as Record<string, unknown>;

    const response = json.response as Record<string, unknown> | undefined;
    const players = (response?.players ?? []) as Array<Record<string, unknown>>;
    return {
      count: players.length,
      players: players.map((p) => ({
        steamid: p.steamid,
        personaname: p.personaname,
        profileurl: p.profileurl,
        avatar: p.avatarfull,
        personastate: p.personastate,
        communityvisibilitystate: p.communityvisibilitystate,
        country: p.loccountrycode,
        lastlogoff: p.lastlogoff,
        timecreated: p.timecreated,
        gameid: p.gameid,
        gameextrainfo: p.gameextrainfo,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// get_steam_owned_games
export async function getSteamOwnedGames(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const steamId = String(args.steamid ?? "").trim();
    if (!steamId) return { error: "steamid is required (Steam64 ID)." };

    const params: Record<string, string> = {
      key: apiKey,
      steamid: steamId,
      format: "json",
    };
    if (args.include_appinfo !== false) params.include_appinfo = "1";
    if (args.include_played_free_games) params.include_played_free_games = "1";

    const json = await steamGet("/IPlayerService/GetOwnedGames/v1/", params) as Record<string, unknown>;
    const response = json.response as Record<string, unknown> | undefined;
    const games = (response?.games ?? []) as Array<Record<string, unknown>>;
    return {
      game_count: response?.game_count ?? games.length,
      games: games.map((g) => ({
        appid: g.appid,
        name: g.name,
        playtime_forever: g.playtime_forever,
        playtime_2weeks: g.playtime_2weeks,
        img_icon_url: g.img_icon_url,
        rtime_last_played: g.rtime_last_played,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// get_steam_achievements
export async function getSteamAchievements(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const steamId = String(args.steamid ?? "").trim();
    if (!steamId) return { error: "steamid is required." };
    const appId = String(args.appid ?? "").trim();
    if (!appId) return { error: "appid is required (the game's Steam App ID)." };

    const json = await steamGet("/ISteamUserStats/GetPlayerAchievements/v1/", {
      key: apiKey,
      steamid: steamId,
      appid: appId,
    }) as Record<string, unknown>;

    const playerstats = json.playerstats as Record<string, unknown> | undefined;
    if (playerstats?.error) throw new Error(String(playerstats.error));

    const achievements = (playerstats?.achievements ?? []) as Array<Record<string, unknown>>;
    const unlocked = achievements.filter((a) => a.achieved === 1);
    return {
      game_name: playerstats?.gameName,
      steamid: playerstats?.steamID,
      total: achievements.length,
      unlocked: unlocked.length,
      achievements: achievements.map((a) => ({
        apiname: a.apiname,
        achieved: a.achieved === 1,
        unlocktime: a.unlocktime,
        name: a.name,
        description: a.description,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// get_steam_app_details
export async function getSteamAppDetails(args: Record<string, unknown>): Promise<unknown> {
  try {
    const appId = String(args.appid ?? "").trim();
    if (!appId) return { error: "appid is required." };
    const params: Record<string, string> = { appids: appId };
    if (args.cc) params.cc = String(args.cc);
    if (args.l) params.l = String(args.l);

    const json = await steamStoreGet("/appdetails", params) as Record<string, unknown>;
    const appData = json[appId] as Record<string, unknown> | undefined;
    if (!appData?.success) return { error: `App ${appId} not found or data unavailable.` };

    const d = appData.data as Record<string, unknown> | undefined;
    return {
      steam_appid: d?.steam_appid,
      name: d?.name,
      type: d?.type,
      is_free: d?.is_free,
      short_description: d?.short_description,
      developers: d?.developers,
      publishers: d?.publishers,
      price_overview: d?.price_overview,
      platforms: d?.platforms,
      genres: d?.genres,
      release_date: d?.release_date,
      metacritic: d?.metacritic,
      header_image: d?.header_image,
      website: d?.website,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// search_steam_store
export async function searchSteamStore(args: Record<string, unknown>): Promise<unknown> {
  try {
    const term = String(args.term ?? "").trim();
    if (!term) return { error: "term is required." };
    const params: Record<string, string> = { term };
    if (args.cc) params.cc = String(args.cc);
    if (args.l) params.l = String(args.l);

    const json = await steamStoreGet("/storesearch", params) as Record<string, unknown>;
    const items = (json.items ?? []) as Array<Record<string, unknown>>;
    return {
      count: items.length,
      total: json.total,
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        type: i.type,
        tiny_image: i.tiny_image,
        price: i.price,
        metascore: i.metascore,
        platforms: i.platforms,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
