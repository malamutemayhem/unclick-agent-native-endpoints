// Riot Games API integration (League of Legends + Valorant).
// Env var: RIOT_API_KEY (header: X-Riot-Token)
// Default region base: https://euw1.api.riotgames.com/
// Match v5 uses regional routing: europe / americas / asia

const RIOT_DEFAULT_REGION = "euw1";

// ─── helpers ──────────────────────────────────────────────────────────────────

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.RIOT_API_KEY ?? "").trim();
  if (!key) {
    throw new Error(
      "RIOT_API_KEY is required. Get a key at https://developer.riotgames.com/"
    );
  }
  return key;
}

function platformBase(region: string): string {
  return `https://${region.toLowerCase()}.api.riotgames.com`;
}

/** Map a platform region to the correct Match v5 regional cluster. */
function matchCluster(region: string): string {
  const r = region.toLowerCase();
  if (["kr", "jp1"].includes(r)) return "asia";
  if (["na1", "br1", "la1", "la2"].includes(r)) return "americas";
  return "europe";
}

async function riotFetch<T>(
  url: string,
  apiKey: string
): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "X-Riot-Token": apiKey,
      "User-Agent": "UnClickMCP/1.0 (https://unclick.io)",
    },
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const status = body.status as Record<string, unknown> | undefined;
    throw new Error(
      `Riot API HTTP ${res.status}: ${String(status?.message ?? body.message ?? "Unknown error")}`
    );
  }
  return body as T;
}

// ─── riot_summoner ────────────────────────────────────────────────────────────
// GET /lol/summoner/v4/summoners/by-name/{name}

export async function riotSummoner(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const summonerName = String(args.summonerName ?? "").trim();
  if (!summonerName) return { error: "summonerName is required." };

  const region = String(args.region ?? RIOT_DEFAULT_REGION);
  const base = platformBase(region);
  const url = `${base}/lol/summoner/v4/summoners/by-name/${encodeURIComponent(summonerName)}`;

  const data = await riotFetch<Record<string, unknown>>(url, key);

  return {
    id: data.id,
    account_id: data.accountId,
    puuid: data.puuid,
    name: data.name,
    profile_icon_id: data.profileIconId,
    summoner_level: data.summonerLevel,
    revision_date: data.revisionDate,
    region,
  };
}

// ─── riot_ranked ──────────────────────────────────────────────────────────────
// GET /lol/league/v4/entries/by-summoner/{id}

export async function riotRanked(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const summonerId = String(args.summonerId ?? "").trim();
  if (!summonerId) return { error: "summonerId is required." };

  const region = String(args.region ?? RIOT_DEFAULT_REGION);
  const base = platformBase(region);
  const url = `${base}/lol/league/v4/entries/by-summoner/${encodeURIComponent(summonerId)}`;

  const data = await riotFetch<Record<string, unknown>[]>(url, key);

  return {
    summoner_id: summonerId,
    region,
    queues: (Array.isArray(data) ? data : []).map((entry) => ({
      queue_type: entry.queueType,
      tier: entry.tier,
      rank: entry.rank,
      lp: entry.leaguePoints,
      wins: entry.wins,
      losses: entry.losses,
      hot_streak: entry.hotStreak,
      veteran: entry.veteran,
      fresh_blood: entry.freshBlood,
      inactive: entry.inactive,
    })),
  };
}

// ─── riot_match_history ───────────────────────────────────────────────────────
// GET /lol/match/v5/matches/by-puuid/{puuid}/ids (regional routing)

export async function riotMatchHistory(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const puuid = String(args.puuid ?? "").trim();
  if (!puuid) return { error: "puuid is required." };

  const region = String(args.region ?? RIOT_DEFAULT_REGION);
  const cluster = matchCluster(region);
  const count = args.count ? String(args.count) : "20";

  const url = new URL(
    `https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids`
  );
  url.searchParams.set("count", count);

  const data = await riotFetch<string[]>(url.toString(), key);

  return {
    puuid,
    region,
    cluster,
    count: data.length,
    match_ids: data,
  };
}

// ─── riot_get_match ───────────────────────────────────────────────────────────
// GET /lol/match/v5/matches/{matchId} (regional routing)

export async function riotGetMatch(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const matchId = String(args.matchId ?? "").trim();
  if (!matchId) return { error: "matchId is required." };

  const region = String(args.region ?? RIOT_DEFAULT_REGION);
  const cluster = matchCluster(region);
  const url = `https://${cluster}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`;

  const data = await riotFetch<Record<string, unknown>>(url, key);

  const metadata = (data.metadata as Record<string, unknown>) ?? {};
  const info = (data.info as Record<string, unknown>) ?? {};
  const participants =
    (info.participants as Record<string, unknown>[]) ?? [];

  return {
    match_id: metadata.matchId,
    game_creation: info.gameCreation,
    game_duration: info.gameDuration,
    game_mode: info.gameMode,
    game_type: info.gameType,
    queue_id: info.queueId,
    platform_id: info.platformId,
    participants: participants.map((p) => ({
      summoner_name: p.summonerName,
      champion_name: p.championName,
      team_id: p.teamId,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      win: p.win,
      total_damage: p.totalDamageDealtToChampions,
      gold_earned: p.goldEarned,
      vision_score: p.visionScore,
      cs: (p.totalMinionsKilled as number ?? 0) + (p.neutralMinionsKilled as number ?? 0),
    })),
  };
}

// ─── riot_valorant_account ────────────────────────────────────────────────────
// GET https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}

export async function riotValorantAccount(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const gameName = String(args.gameName ?? "").trim();
  const tagLine = String(args.tagLine ?? "").trim();
  if (!gameName) return { error: "gameName is required." };
  if (!tagLine) return { error: "tagLine is required." };

  const url = `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  const data = await riotFetch<Record<string, unknown>>(url, key);

  return {
    puuid: data.puuid,
    game_name: data.gameName,
    tag_line: data.tagLine,
  };
}
