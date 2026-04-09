// The Lott AU integration.
// Australian lottery results and jackpots. No authentication required.
// Supports Tattslotto, Oz Lotto, Powerball, Set for Life, Monday/Wednesday Lotto.
// Base URL: https://api.thelott.com/

const LOTT_BASE = "https://api.thelott.com";

const GAME_SLUGS: Record<string, string> = {
  "tattslotto": "saturday-tattslotto",
  "saturday-lotto": "saturday-tattslotto",
  "oz-lotto": "oz-lotto",
  "ozlotto": "oz-lotto",
  "powerball": "powerball",
  "set-for-life": "set-for-life",
  "setforlife": "set-for-life",
  "monday-lotto": "monday-lotto",
  "wednesday-lotto": "wednesday-lotto",
};

async function lottGet(path: string, params?: Record<string, string>): Promise<unknown> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await fetch(`${LOTT_BASE}${path}${qs}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "UnClickMCP/1.0 (https://unclick.io)",
    },
  });
  if (res.status === 404) throw new Error("Game or draw not found.");
  if (res.status === 429) throw new Error("The Lott API rate limit exceeded.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`The Lott API HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  return res.json() as Promise<unknown>;
}

function resolveSlug(game: string): string {
  const lower = game.toLowerCase().replace(/\s+/g, "-");
  return GAME_SLUGS[lower] ?? lower;
}

// ─── get_lott_results ─────────────────────────────────────────────────────────

export async function getLottResults(args: Record<string, unknown>): Promise<unknown> {
  try {
    const game = String(args.game ?? "powerball").trim();
    const slug = resolveSlug(game);

    const params: Record<string, string> = {};
    if (args.draw_number) params["drawNumber"] = String(args.draw_number);
    if (args.date) params["drawDate"] = String(args.date);

    const data = await lottGet(`/games/${slug}/draws/latest`, params) as Record<string, unknown>;

    return {
      game: slug,
      draw_number: data["drawNumber"],
      draw_date: data["drawDate"],
      winning_numbers: data["primaryNumbers"] ?? data["winningNumbers"],
      supplementary_numbers: data["secondaryNumbers"] ?? data["supplementaryNumbers"],
      powerball: data["powerball"],
      jackpot: data["jackpot"],
      prize_pools: data["prizePools"],
      division_results: data["divisionResults"],
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── get_lott_jackpots ────────────────────────────────────────────────────────

export async function getLottJackpots(args: Record<string, unknown>): Promise<unknown> {
  try {
    const games = args.games
      ? (Array.isArray(args.games) ? args.games as string[] : [String(args.games)])
      : ["powerball", "oz-lotto", "tattslotto", "set-for-life"];

    const results = await Promise.allSettled(
      games.map(async (game) => {
        const slug = resolveSlug(game);
        const data = await lottGet(`/games/${slug}/draws/latest`) as Record<string, unknown>;
        return {
          game: slug,
          draw_date: data["drawDate"],
          jackpot: data["jackpot"],
          next_jackpot: data["nextJackpot"],
          jackpot_guaranteed: data["isJackpotGuaranteed"] ?? false,
        };
      })
    );

    return {
      jackpots: results.map((r, i) =>
        r.status === "fulfilled"
          ? r.value
          : { game: games[i], error: r.reason instanceof Error ? r.reason.message : String(r.reason) }
      ),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
