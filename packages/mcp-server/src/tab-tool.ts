// TAB Australia integration.
// Read-only access to racing and sports betting odds (public data, no auth required).
// Docs: https://api.beta.tab.com.au/
// Base URL: https://api.beta.tab.com.au/v1/

const TAB_BASE = "https://api.beta.tab.com.au/v1";

async function tabGet(path: string, params?: Record<string, string>): Promise<unknown> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await fetch(`${TAB_BASE}${path}${qs}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "UnClickMCP/1.0 (https://unclick.io)",
    },
  });
  if (res.status === 404) throw new Error("Resource not found on TAB API.");
  if (res.status === 429) throw new Error("TAB API rate limit exceeded.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TAB API HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  return res.json() as Promise<unknown>;
}

// ─── get_tab_meetings ─────────────────────────────────────────────────────────

export async function getTabMeetings(args: Record<string, unknown>): Promise<unknown> {
  try {
    const raceType = String(args.race_type ?? "R").toUpperCase();
    const validTypes = ["R", "H", "G"];
    if (!validTypes.includes(raceType)) {
      return { error: "race_type must be R (thoroughbred), H (harness), or G (greyhound)." };
    }

    const jurisdiction = String(args.jurisdiction ?? "VIC").toUpperCase();
    const params: Record<string, string> = { jurisdiction };
    if (args.date) params["date"] = String(args.date);

    const data = await tabGet(`/tab-info-service/racing/dates/2024-01-01/meetings`, params) as Record<string, unknown>;
    const meetings = data["meetings"] as Array<Record<string, unknown>> | undefined ?? [];

    const filtered = meetings.filter((m) =>
      !raceType || (m["raceType"] as string)?.toUpperCase() === raceType
    );

    return {
      race_type: raceType,
      jurisdiction,
      count: filtered.length,
      meetings: filtered.map((m) => ({
        id: m["meetingId"],
        name: m["meetingName"],
        race_type: m["raceType"],
        location: m["location"],
        state: m["state"],
        date: m["meetingDate"],
        track_condition: m["trackCondition"],
        race_count: (m["races"] as unknown[])?.length ?? 0,
        races: (m["races"] as Array<Record<string, unknown>> | undefined)?.map((r) => ({
          number: r["raceNumber"],
          name: r["raceName"],
          start_time: r["raceStartTime"],
          distance_m: r["raceDistance"],
          status: r["raceStatus"],
        })),
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── get_tab_race ─────────────────────────────────────────────────────────────

export async function getTabRace(args: Record<string, unknown>): Promise<unknown> {
  try {
    const meetingDate = String(args.meeting_date ?? "").trim();
    const meetingName = String(args.meeting_name ?? "").trim();
    const raceNumber = String(args.race_number ?? "").trim();
    const raceType = String(args.race_type ?? "R").toUpperCase();

    if (!meetingDate) return { error: "meeting_date is required (YYYY-MM-DD)." };
    if (!meetingName) return { error: "meeting_name is required (e.g. Flemington)." };
    if (!raceNumber) return { error: "race_number is required." };

    const jurisdiction = String(args.jurisdiction ?? "VIC").toUpperCase();

    const data = await tabGet(
      `/tab-info-service/racing/dates/${meetingDate}/meetings/${encodeURIComponent(meetingName)}/${raceType}/races/${raceNumber}`,
      { jurisdiction }
    ) as Record<string, unknown>;

    const runners = data["runners"] as Array<Record<string, unknown>> | undefined ?? [];

    return {
      race_name: data["raceName"],
      race_number: data["raceNumber"],
      meeting: data["meetingName"],
      distance_m: data["raceDistance"],
      start_time: data["raceStartTime"],
      status: data["raceStatus"],
      track_condition: data["trackCondition"],
      prize_money: data["prizeMoney"],
      runners: runners.map((r) => ({
        number: r["runnerNumber"],
        name: r["runnerName"],
        barrier: r["barrierNumber"],
        jockey: r["jockeyName"] ?? r["driverName"],
        trainer: r["trainerName"],
        weight_kg: r["handicapWeight"],
        win_odds: (r["fixedOdds"] as Record<string, unknown>)?.["returnWin"],
        place_odds: (r["fixedOdds"] as Record<string, unknown>)?.["returnPlace"],
        scratched: r["scratched"] ?? false,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── get_tab_sports_markets ───────────────────────────────────────────────────

export async function getTabSportsMarkets(args: Record<string, unknown>): Promise<unknown> {
  try {
    const sport = String(args.sport ?? "").trim();
    const params: Record<string, string> = {};
    if (args.jurisdiction) params["jurisdiction"] = String(args.jurisdiction).toUpperCase();

    const path = sport
      ? `/tab-info-service/sports/${encodeURIComponent(sport)}/competitions`
      : "/tab-info-service/sports";

    const data = await tabGet(path, params) as Record<string, unknown>;

    return {
      sport: sport || "all",
      data,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
