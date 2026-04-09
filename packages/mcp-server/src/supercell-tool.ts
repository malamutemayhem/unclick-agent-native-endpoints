// Supercell Games API integration: Clash of Clans, Clash Royale, Brawl Stars.
// Three games, one file. Each game uses its own base URL and API key.
// Env vars: COC_API_KEY, CR_API_KEY, BS_API_KEY

const COC_BASE = "https://api.clashofclans.com/v1";
const CR_BASE = "https://api.clashroyale.com/v1";
const BS_BASE = "https://api.brawlstars.com/v1";

// ─── API helper ───────────────────────────────────────────────────────────────

async function supercellFetch<T>(
  baseUrl: string,
  path: string,
  apiKey: string
): Promise<T> {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "User-Agent": "UnClickMCP/1.0 (https://unclick.io)",
    },
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      `Supercell API HTTP ${res.status}: ${String(body.message ?? body.reason ?? "Unknown error")}`
    );
  }
  return body as T;
}

/** Encode a Supercell tag: ensure it starts with # and URL-encode it. */
function encodeTag(raw: string): string {
  const tag = raw.trim().startsWith("#") ? raw.trim() : `#${raw.trim()}`;
  return encodeURIComponent(tag);
}

// ─── Clash of Clans ───────────────────────────────────────────────────────────

function requireCocKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.COC_API_KEY ?? "").trim();
  if (!key) {
    throw new Error(
      "COC_API_KEY is required. Register at https://developer.clashofclans.com/"
    );
  }
  return key;
}

// GET /players/{urlencoded_tag}
export async function cocPlayer(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireCocKey(args);
  const tag = String(args.tag ?? "").trim();
  if (!tag) return { error: "tag is required (Clash of Clans player tag)." };

  const data = await supercellFetch<Record<string, unknown>>(
    COC_BASE,
    `/players/${encodeTag(tag)}`,
    key
  );

  return {
    tag: data.tag,
    name: data.name,
    town_hall_level: data.townHallLevel,
    exp_level: data.expLevel,
    trophies: data.trophies,
    best_trophies: data.bestTrophies,
    war_stars: data.warStars,
    attack_wins: data.attackWins,
    defense_wins: data.defenseWins,
    donations: data.donations,
    donations_received: data.donationsReceived,
    clan: data.clan
      ? {
          tag: (data.clan as Record<string, unknown>).tag,
          name: (data.clan as Record<string, unknown>).name,
          role: data.role,
        }
      : null,
    league: data.league
      ? { name: (data.league as Record<string, unknown>).name }
      : null,
    troops:
      ((data.troops as Record<string, unknown>[]) ?? [])
        .slice(0, 20)
        .map((t) => ({ name: t.name, level: t.level, max_level: t.maxLevel })),
  };
}

// GET /clans/{urlencoded_tag}
export async function cocClan(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireCocKey(args);
  const tag = String(args.tag ?? "").trim();
  if (!tag) return { error: "tag is required (Clash of Clans clan tag)." };

  const data = await supercellFetch<Record<string, unknown>>(
    COC_BASE,
    `/clans/${encodeTag(tag)}`,
    key
  );

  return {
    tag: data.tag,
    name: data.name,
    type: data.type,
    description: data.description ?? null,
    location: data.location
      ? (data.location as Record<string, unknown>).name
      : null,
    clan_level: data.clanLevel,
    clan_points: data.clanPoints,
    clan_versus_points: data.clanVersusPoints,
    required_trophies: data.requiredTrophies,
    war_frequency: data.warFrequency,
    war_win_streak: data.warWinStreak,
    war_wins: data.warWins,
    war_ties: data.warTies ?? null,
    war_losses: data.warLosses ?? null,
    is_war_log_public: data.isWarLogPublic,
    members: data.members,
    member_list:
      ((data.memberList as Record<string, unknown>[]) ?? []).map((m) => ({
        tag: m.tag,
        name: m.name,
        role: m.role,
        trophies: m.trophies,
        town_hall_level: m.townHallLevel,
      })),
  };
}

// GET /clans/{urlencoded_tag}/members
export async function cocClanMembers(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireCocKey(args);
  const tag = String(args.tag ?? "").trim();
  if (!tag) return { error: "tag is required (Clash of Clans clan tag)." };

  const data = await supercellFetch<Record<string, unknown>>(
    COC_BASE,
    `/clans/${encodeTag(tag)}/members`,
    key
  );

  const items = (data.items as Record<string, unknown>[]) ?? [];

  return {
    clan_tag: tag,
    count: items.length,
    members: items.map((m) => ({
      tag: m.tag,
      name: m.name,
      role: m.role,
      exp_level: m.expLevel,
      trophies: m.trophies,
      donations: m.donations,
      donations_received: m.donationsReceived,
      town_hall_level: m.townHallLevel,
    })),
  };
}

// ─── Clash Royale ─────────────────────────────────────────────────────────────

function requireCrKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.CR_API_KEY ?? "").trim();
  if (!key) {
    throw new Error(
      "CR_API_KEY is required. Register at https://developer.clashroyale.com/"
    );
  }
  return key;
}

// GET /players/{urlencoded_tag}
export async function crPlayer(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireCrKey(args);
  const tag = String(args.tag ?? "").trim();
  if (!tag) return { error: "tag is required (Clash Royale player tag)." };

  const data = await supercellFetch<Record<string, unknown>>(
    CR_BASE,
    `/players/${encodeTag(tag)}`,
    key
  );

  return {
    tag: data.tag,
    name: data.name,
    exp_level: data.expLevel,
    trophies: data.trophies,
    best_trophies: data.bestTrophies,
    wins: data.wins,
    losses: data.losses,
    battle_count: data.battleCount,
    three_crown_wins: data.threeCrownWins,
    challenge_max_wins: data.challengeMaxWins,
    challenge_cards_won: data.challengeCardsWon,
    tournament_battle_count: data.tournamentBattleCount,
    clan: data.clan
      ? {
          tag: (data.clan as Record<string, unknown>).tag,
          name: (data.clan as Record<string, unknown>).name,
        }
      : null,
    arena: data.arena
      ? { name: (data.arena as Record<string, unknown>).name }
      : null,
    current_deck:
      ((data.currentDeck as Record<string, unknown>[]) ?? []).map((c) => ({
        name: c.name,
        level: c.level,
        max_level: c.maxLevel,
      })),
  };
}

// GET /locations/{location}/rankings/players
export async function crTopPlayers(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireCrKey(args);
  const location = String(args.location ?? "global");

  const data = await supercellFetch<Record<string, unknown>>(
    CR_BASE,
    `/locations/${encodeURIComponent(location)}/rankings/players`,
    key
  );

  const items = (data.items as Record<string, unknown>[]) ?? [];

  return {
    location,
    count: items.length,
    players: items.map((p) => ({
      rank: p.rank,
      tag: p.tag,
      name: p.name,
      exp_level: p.expLevel,
      trophies: p.trophies,
      clan: p.clan
        ? { name: (p.clan as Record<string, unknown>).name }
        : null,
    })),
  };
}

// ─── Brawl Stars ──────────────────────────────────────────────────────────────

function requireBsKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.BS_API_KEY ?? "").trim();
  if (!key) {
    throw new Error(
      "BS_API_KEY is required. Register at https://developer.brawlstars.com/"
    );
  }
  return key;
}

// GET /players/{urlencoded_tag}
export async function bsPlayer(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireBsKey(args);
  const tag = String(args.tag ?? "").trim();
  if (!tag) return { error: "tag is required (Brawl Stars player tag)." };

  const data = await supercellFetch<Record<string, unknown>>(
    BS_BASE,
    `/players/${encodeTag(tag)}`,
    key
  );

  return {
    tag: data.tag,
    name: data.name,
    trophies: data.trophies,
    highest_trophies: data.highestTrophies,
    exp_level: data.expLevel,
    exp_points: data.expPoints,
    is_qualified_from_championship: data.isQualifiedFromChampionship,
    victories_3v3: data["3vs3Victories"] ?? null,
    solo_victories: data.soloVictories,
    duo_victories: data.duoVictories,
    best_robo_rumble_time: data.bestRoboRumbleTime,
    best_time_as_big_brawler: data.bestTimeAsBigBrawler,
    club: data.club
      ? {
          tag: (data.club as Record<string, unknown>).tag,
          name: (data.club as Record<string, unknown>).name,
        }
      : null,
    brawlers:
      ((data.brawlers as Record<string, unknown>[]) ?? []).map((b) => ({
        id: b.id,
        name: b.name,
        power: b.power,
        trophies: b.trophies,
        highest_trophies: b.highestTrophies,
      })),
  };
}

// GET /clubs/{urlencoded_tag}
export async function bsClub(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireBsKey(args);
  const tag = String(args.tag ?? "").trim();
  if (!tag) return { error: "tag is required (Brawl Stars club tag)." };

  const data = await supercellFetch<Record<string, unknown>>(
    BS_BASE,
    `/clubs/${encodeTag(tag)}`,
    key
  );

  return {
    tag: data.tag,
    name: data.name,
    description: data.description ?? null,
    type: data.type,
    trophies: data.trophies,
    required_trophies: data.requiredTrophies,
    member_count: Array.isArray(data.members) ? (data.members as unknown[]).length : null,
    members:
      ((data.members as Record<string, unknown>[]) ?? []).map((m) => ({
        tag: m.tag,
        name: m.name,
        role: m.role,
        trophies: m.trophies,
      })),
  };
}
