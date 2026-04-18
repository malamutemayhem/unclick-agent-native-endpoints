// BoardGameGeek XML API2 integration.
// Docs: https://boardgamegeek.com/wiki/page/BGG_XML_API2
// No authentication required.
// Base URL: https://boardgamegeek.com/xmlapi2

import { XMLParser } from "fast-xml-parser";

const BGG_BASE = "https://boardgamegeek.com/xmlapi2";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

// ─── helpers ──────────────────────────────────────────────────────────────────

async function bggFetch(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BGG_BASE}${path}`, {
    headers: { "User-Agent": "UnClickMCP/1.0 (https://unclick.io)" },
  });
  if (!res.ok) throw new Error(`BGG API HTTP ${res.status}`);
  const xml = await res.text();
  return parser.parse(xml) as Record<string, unknown>;
}

/** BGG collection endpoints return 202 while the data is being prepared. Retry. */
async function bggFetchWithRetry(
  path: string,
  maxRetries = 5,
  delayMs = 2000
): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(`${BGG_BASE}${path}`, {
      headers: { "User-Agent": "UnClickMCP/1.0 (https://unclick.io)" },
    });
    if (res.status === 202) {
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw new Error(
        "BGG collection is still being prepared. Please try again in a few seconds."
      );
    }
    if (!res.ok) throw new Error(`BGG API HTTP ${res.status}`);
    const xml = await res.text();
    return parser.parse(xml) as Record<string, unknown>;
  }
  throw new Error("BGG collection request timed out after retries.");
}

function attr(obj: unknown, key: string): string {
  if (obj && typeof obj === "object") {
    return String((obj as Record<string, unknown>)[`@_${key}`] ?? "");
  }
  return "";
}

function val(obj: unknown): string {
  return attr(obj, "value");
}

function primaryName(names: unknown): string {
  if (!Array.isArray(names)) {
    return val(names);
  }
  const primary = names.find((n) => attr(n, "type") === "primary");
  return val(primary ?? names[0]);
}

// ─── bgg_search ───────────────────────────────────────────────────────────────
// GET /search?query=<name>&type=boardgame[,boardgameexpansion]

export async function bggSearch(args: Record<string, unknown>): Promise<unknown> {
  const query = String(args.query ?? "").trim();
  if (!query) return { error: "query is required." };

  const type = String(args.type ?? "boardgame").trim();
  const allowed = ["boardgame", "boardgameexpansion"];
  const safeType = allowed.includes(type) ? type : "boardgame";

  const data = await bggFetch(
    `/search?query=${encodeURIComponent(query)}&type=${encodeURIComponent(safeType)}`
  );

  const root = (data.items ?? {}) as Record<string, unknown>;
  const items = (root.item as Record<string, unknown>[]) ?? [];

  return {
    total: Number(attr(root, "total") ?? items.length),
    results: items.slice(0, 20).map((item) => ({
      id: attr(item, "id"),
      type: attr(item, "type"),
      name: primaryName(item.name),
      year_published: val(item.yearpublished) || null,
    })),
  };
}

// ─── bgg_game_details ─────────────────────────────────────────────────────────
// GET /thing?id=<id>&stats=1

export async function bggGameDetails(args: Record<string, unknown>): Promise<unknown> {
  const gameId = String(args.gameId ?? "").trim();
  if (!gameId) return { error: "gameId is required." };

  const data = await bggFetch(`/thing?id=${encodeURIComponent(gameId)}&stats=1`);

  const root = (data.items ?? {}) as Record<string, unknown>;
  const items = (root.item as Record<string, unknown>[]) ?? [];
  const item = items[0];
  if (!item) return { error: `No game found with id ${gameId}` };

  const stats = (item.statistics as Record<string, unknown>) ?? {};
  const ratings = (stats.ratings as Record<string, unknown>) ?? {};

  const links = ((item.link as Record<string, unknown>[]) ?? []);
  const categories = links
    .filter((l) => attr(l, "type") === "boardgamecategory")
    .map((l) => val(l));
  const mechanics = links
    .filter((l) => attr(l, "type") === "boardgamemechanic")
    .map((l) => val(l));
  const designers = links
    .filter((l) => attr(l, "type") === "boardgamedesigner")
    .map((l) => val(l));
  const publishers = links
    .filter((l) => attr(l, "type") === "boardgamepublisher")
    .map((l) => val(l));

  // Strip HTML tags from description
  const rawDesc = String(item.description ?? "");
  const description = rawDesc.replace(/&#10;/g, "\n").replace(/<[^>]+>/g, "").trim();

  return {
    id: attr(item, "id"),
    type: attr(item, "type"),
    name: primaryName(item.name),
    year_published: val(item.yearpublished) || null,
    description: description.slice(0, 1000) + (description.length > 1000 ? "…" : ""),
    image: String(item.image ?? "").trim() || null,
    min_players: val(item.minplayers) || null,
    max_players: val(item.maxplayers) || null,
    playing_time: val(item.playingtime) || null,
    min_play_time: val(item.minplaytime) || null,
    max_play_time: val(item.maxplaytime) || null,
    min_age: val(item.minage) || null,
    complexity_weight: val(ratings.averageweight) || null,
    average_rating: val(ratings.average) || null,
    bayes_average: val(ratings.bayesaverage) || null,
    rank: (() => {
      const ranks = (ratings.ranks as Record<string, unknown>) ?? {};
      const rankItems = Array.isArray(ranks.rank) ? ranks.rank : ranks.rank ? [ranks.rank] : [];
      const overall = rankItems.find((r: unknown) => attr(r, "name") === "boardgame");
      return overall ? val(overall) : null;
    })(),
    num_ratings: val(ratings.usersrated) || null,
    num_owned: val(ratings.owned) || null,
    categories,
    mechanics,
    designers,
    publishers: publishers.slice(0, 5),
  };
}

// ─── bgg_user_collection ──────────────────────────────────────────────────────
// GET /collection?username=<username>&own=1 (or wishlist=1, played=1)

export async function bggUserCollection(args: Record<string, unknown>): Promise<unknown> {
  const username = String(args.username ?? "").trim();
  if (!username) return { error: "username is required." };

  const status = String(args.status ?? "owned").trim();
  const statusMap: Record<string, string> = {
    owned: "own=1",
    wishlist: "wishlist=1",
    played: "played=1",
  };
  const statusParam = statusMap[status] ?? "own=1";

  const data = await bggFetchWithRetry(
    `/collection?username=${encodeURIComponent(username)}&${statusParam}&stats=1`
  );

  const root = (data.items ?? {}) as Record<string, unknown>;
  const rawItems = root.item;
  const items: Record<string, unknown>[] = Array.isArray(rawItems)
    ? rawItems
    : rawItems
    ? [rawItems as Record<string, unknown>]
    : [];

  return {
    username,
    status,
    total: items.length,
    games: items.slice(0, 50).map((item) => {
      const stats = (item.stats as Record<string, unknown>) ?? {};
      const rating = (item.stats as Record<string, unknown>
        ? (stats.rating as Record<string, unknown>) ?? {}
        : {}) as Record<string, unknown>;
      return {
        id: attr(item, "objectid"),
        name: String((item.name as Record<string, unknown>)?.["#text"] ?? ""),
        year_published: attr(item.yearpublished as unknown ?? {}, ""),
        image: String(item.image ?? "").trim() || null,
        num_plays: attr(item, "numplays") || String(item.numplays ?? ""),
        user_rating: val(rating) || null,
        average_rating: val((stats.rating as Record<string, unknown>)?.average ?? {}) || null,
        rank: (() => {
          const r = stats.ranks as Record<string, unknown> | undefined;
          if (!r) return null;
          const rankItems = Array.isArray(r.rank) ? r.rank : r.rank ? [r.rank] : [];
          const overall = rankItems.find((x: unknown) => attr(x, "name") === "boardgame");
          return overall ? attr(overall, "value") : null;
        })(),
      };
    }),
  };
}

// ─── bgg_top_games ────────────────────────────────────────────────────────────
// GET /hot?type=boardgame - returns BGG's "Hotness" list (top 50)

export async function bggTopGames(args: Record<string, unknown>): Promise<unknown> {
  const limit = Math.min(Number(args.limit ?? 20), 50);
  const data = await bggFetch("/hot?type=boardgame");

  const root = (data.items ?? {}) as Record<string, unknown>;
  const rawItems = root.item;
  const items: Record<string, unknown>[] = Array.isArray(rawItems)
    ? rawItems
    : rawItems
    ? [rawItems as Record<string, unknown>]
    : [];

  return {
    list: "BGG Hotness (most discussed/active games right now)",
    total: items.length,
    games: items.slice(0, limit).map((item, i) => ({
      rank: i + 1,
      id: attr(item, "id"),
      name: val(item.name),
      year_published: val(item.yearpublished) || null,
      thumbnail: val(item.thumbnail) || null,
    })),
  };
}

// ─── bgg_game_reviews ─────────────────────────────────────────────────────────
// GET /thing?id=<id>&comments=1&page=<page>

export async function bggGameReviews(args: Record<string, unknown>): Promise<unknown> {
  const gameId = String(args.gameId ?? "").trim();
  if (!gameId) return { error: "gameId is required." };
  const page = Math.max(1, Number(args.page ?? 1));

  const data = await bggFetch(
    `/thing?id=${encodeURIComponent(gameId)}&comments=1&page=${page}&pagesize=25`
  );

  const root = (data.items ?? {}) as Record<string, unknown>;
  const rawItems = root.item;
  const items: Record<string, unknown>[] = Array.isArray(rawItems)
    ? rawItems
    : rawItems
    ? [rawItems as Record<string, unknown>]
    : [];
  const item = items[0];
  if (!item) return { error: `No game found with id ${gameId}` };

  const comments = (item.comments as Record<string, unknown>) ?? {};
  const rawComments = comments.comment;
  const commentList: Record<string, unknown>[] = Array.isArray(rawComments)
    ? rawComments
    : rawComments
    ? [rawComments as Record<string, unknown>]
    : [];

  return {
    game_id: gameId,
    game_name: primaryName(item.name),
    page,
    total_comments: Number(attr(comments, "totalitems") ?? 0),
    comments: commentList.map((c) => ({
      username: attr(c, "username"),
      rating: attr(c, "rating") || null,
      comment: String(c["#text"] ?? attr(c, "value") ?? "").trim(),
    })),
  };
}
