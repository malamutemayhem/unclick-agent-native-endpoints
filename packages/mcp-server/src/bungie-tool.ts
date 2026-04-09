// Bungie / Destiny 2 API integration.
// Docs: https://bungie-net.github.io/
// Env var: BUNGIE_API_KEY (header: X-API-Key)
// Base URL: https://www.bungie.net/Platform/

const BUNGIE_BASE = "https://www.bungie.net/Platform";

// ─── API helper ───────────────────────────────────────────────────────────────

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.BUNGIE_API_KEY ?? "").trim();
  if (!key) {
    throw new Error(
      "BUNGIE_API_KEY is required. Register at https://www.bungie.net/en/Application"
    );
  }
  return key;
}

async function bungieFetch<T>(
  path: string,
  apiKey: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${BUNGIE_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      "X-API-Key": apiKey,
      "User-Agent": "UnClickMCP/1.0 (https://unclick.io)",
    },
  });

  const body = (await res.json()) as Record<string, unknown>;

  if (!res.ok || (body.ErrorCode !== undefined && Number(body.ErrorCode) !== 1)) {
    throw new Error(
      `Bungie API error ${body.ErrorCode ?? res.status}: ${String(body.Message ?? body.ErrorStatus ?? "Unknown error")}`
    );
  }

  return body.Response as T;
}

// ─── bungie_search_player ─────────────────────────────────────────────────────
// GET /Destiny2/SearchDestinyPlayer/{membershipType}/{displayName}/

export async function bungieSearchPlayer(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const displayName = String(args.displayName ?? "").trim();
  if (!displayName) return { error: "displayName is required." };

  const membershipType = String(args.membershipType ?? "-1");
  const data = await bungieFetch<Record<string, unknown>[]>(
    `/Destiny2/SearchDestinyPlayer/${encodeURIComponent(membershipType)}/${encodeURIComponent(displayName)}/`,
    key
  );

  const results = Array.isArray(data) ? data : [];

  return {
    query: displayName,
    count: results.length,
    players: results.map((p) => ({
      membership_id: p.membershipId,
      membership_type: p.membershipType,
      display_name: p.displayName,
      bungie_global_display_name: p.bungieGlobalDisplayName ?? null,
      bungie_global_display_name_code: p.bungieGlobalDisplayNameCode ?? null,
      icon_path: p.iconPath ? `https://www.bungie.net${p.iconPath}` : null,
    })),
  };
}

// ─── bungie_get_profile ───────────────────────────────────────────────────────
// GET /Destiny2/{membershipType}/Profile/{membershipId}/
// components: 100=Profiles, 200=Characters, 204=CharacterEquipment

export async function bungieGetProfile(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const membershipType = String(args.membershipType ?? "").trim();
  const membershipId = String(args.membershipId ?? "").trim();
  if (!membershipType) return { error: "membershipType is required." };
  if (!membershipId) return { error: "membershipId is required." };

  const components = String(args.components ?? "100,200,204");

  const data = await bungieFetch<Record<string, unknown>>(
    `/Destiny2/${encodeURIComponent(membershipType)}/Profile/${encodeURIComponent(membershipId)}/`,
    key,
    { components }
  );

  // Extract profile info
  const profileData = (data.profile as Record<string, unknown>) ?? {};
  const profileInfo = (profileData.data as Record<string, unknown>) ?? {};
  const userInfo =
    (profileInfo.userInfo as Record<string, unknown>) ?? {};

  // Extract character summaries
  const charactersData = (data.characters as Record<string, unknown>) ?? {};
  const charactersMap =
    (charactersData.data as Record<string, Record<string, unknown>>) ?? {};
  const characters = Object.values(charactersMap).map((c) => ({
    character_id: c.characterId,
    membership_id: c.membershipId,
    membership_type: c.membershipType,
    class_type: c.classType,
    race_type: c.raceType,
    gender_type: c.genderType,
    light: c.light,
    level: c.levelProgression
      ? (c.levelProgression as Record<string, unknown>).level
      : null,
    minutes_played_total: c.minutesPlayedTotal,
    date_last_played: c.dateLastPlayed,
    emblem_path: c.emblemPath
      ? `https://www.bungie.net${c.emblemPath}`
      : null,
  }));

  return {
    membership_id: userInfo.membershipId ?? membershipId,
    membership_type: userInfo.membershipType ?? membershipType,
    display_name: userInfo.displayName ?? null,
    characters,
  };
}

// ─── bungie_get_manifest ──────────────────────────────────────────────────────
// GET /Destiny2/Manifest/

export async function bungieGetManifest(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const data = await bungieFetch<Record<string, unknown>>(
    "/Destiny2/Manifest/",
    key
  );

  return {
    version: data.version,
    mobile_asset_content_path: data.mobileAssetContentPath ?? null,
    mobile_gear_asset_data_bases:
      (data.mobileGearAssetDataBases as unknown[]) ?? [],
    mobile_world_content_paths:
      (data.mobileWorldContentPaths as Record<string, string>) ?? {},
    json_world_content_paths:
      (data.jsonWorldContentPaths as Record<string, string>) ?? {},
    mobile_clan_banner_database_path:
      data.mobileClanBannerDatabasePath ?? null,
    mobile_gear_cdn: (data.mobileGearCDN as Record<string, string>) ?? {},
  };
}

// ─── bungie_search_entities ───────────────────────────────────────────────────
// GET /Destiny2/Armory/Search/{entityType}/{searchTerm}/

export async function bungieSearchEntities(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireKey(args);
  const entityType = String(args.entityType ?? "").trim();
  const searchTerm = String(args.searchTerm ?? "").trim();
  if (!entityType) return { error: "entityType is required (e.g. DestinyInventoryItemDefinition)." };
  if (!searchTerm) return { error: "searchTerm is required." };

  const data = await bungieFetch<Record<string, unknown>>(
    `/Destiny2/Armory/Search/${encodeURIComponent(entityType)}/${encodeURIComponent(searchTerm)}/`,
    key
  );

  const results =
    (data.results as Record<string, unknown>[]) ?? [];

  return {
    entity_type: entityType,
    query: searchTerm,
    total: data.totalResults ?? results.length,
    results: results.map((r) => ({
      hash: r.hash,
      entity_type: r.entityType,
      display_properties: r.displayProperties ?? null,
      has_icon: r.hasIcon,
    })),
  };
}
