// Untappd API integration.
// Docs: https://untappd.com/api/docs
// Env vars: UNTAPPD_CLIENT_ID, UNTAPPD_CLIENT_SECRET
// Public endpoints authenticate via query params: ?client_id=&client_secret=
// Base URL: https://api.untappd.com/v4/

const UNTAPPD_BASE = "https://api.untappd.com/v4";

// ─── API helper ───────────────────────────────────────────────────────────────

interface UntappdCreds {
  clientId: string;
  clientSecret: string;
}

function requireCreds(args: Record<string, unknown>): UntappdCreds {
  const clientId = String(
    args.client_id ?? process.env.UNTAPPD_CLIENT_ID ?? ""
  ).trim();
  const clientSecret = String(
    args.client_secret ?? process.env.UNTAPPD_CLIENT_SECRET ?? ""
  ).trim();

  if (!clientId || !clientSecret) {
    throw new Error(
      "UNTAPPD_CLIENT_ID and UNTAPPD_CLIENT_SECRET are required. Register at https://untappd.com/api/register"
    );
  }
  return { clientId, clientSecret };
}

async function untappdFetch<T>(
  path: string,
  creds: UntappdCreds,
  extra: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${UNTAPPD_BASE}${path}`);
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("client_secret", creds.clientSecret);
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "UnClickMCP/1.0 (https://unclick.io)" },
  });

  const body = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    const meta = (body.meta as Record<string, unknown>) ?? {};
    throw new Error(
      `Untappd API HTTP ${res.status}: ${String(meta.error_detail ?? meta.developer_friendly ?? "Unknown error")}`
    );
  }

  const response = (body.response as Record<string, unknown>) ?? {};
  return response as T;
}

// ─── untappd_search_beer ──────────────────────────────────────────────────────
// GET /search/beer?q={q}&limit={limit}

export async function untappdSearchBeer(
  args: Record<string, unknown>
): Promise<unknown> {
  const creds = requireCreds(args);
  const q = String(args.q ?? "").trim();
  if (!q) return { error: "q is required (search query)." };

  const extra: Record<string, string> = { q };
  if (args.limit) extra.limit = String(args.limit);

  const data = await untappdFetch<Record<string, unknown>>(
    "/search/beer",
    creds,
    extra
  );

  const beers = (data.beers as Record<string, unknown>) ?? {};
  const items = (beers.items as Record<string, unknown>[]) ?? [];

  return {
    query: q,
    found: beers.count ?? 0,
    offset: beers.offset ?? 0,
    results: items.map((item) => {
      const beer = (item.beer as Record<string, unknown>) ?? {};
      const brewery = (item.brewery as Record<string, unknown>) ?? {};
      return {
        bid: beer.bid,
        beer_name: beer.beer_name,
        beer_style: beer.beer_style ?? null,
        beer_abv: beer.beer_abv ?? null,
        beer_ibu: beer.beer_ibu ?? null,
        beer_description: beer.beer_description ?? null,
        beer_label: beer.beer_label ?? null,
        rating_score: beer.rating_score ?? null,
        rating_count: beer.rating_count ?? null,
        brewery_name: brewery.brewery_name ?? null,
        brewery_id: brewery.brewery_id ?? null,
      };
    }),
  };
}

// ─── untappd_get_beer ─────────────────────────────────────────────────────────
// GET /beer/info/{bid}

export async function untappdGetBeer(
  args: Record<string, unknown>
): Promise<unknown> {
  const creds = requireCreds(args);
  const bid = String(args.bid ?? "").trim();
  if (!bid) return { error: "bid is required (Untappd beer ID)." };

  const data = await untappdFetch<Record<string, unknown>>(
    `/beer/info/${encodeURIComponent(bid)}`,
    creds
  );

  const beer = (data.beer as Record<string, unknown>) ?? {};
  const brewery = (beer.brewery as Record<string, unknown>) ?? {};

  return {
    bid: beer.bid,
    beer_name: beer.beer_name,
    beer_label: beer.beer_label ?? null,
    beer_abv: beer.beer_abv ?? null,
    beer_ibu: beer.beer_ibu ?? null,
    beer_style: beer.beer_style ?? null,
    beer_description: beer.beer_description ?? null,
    rating_score: beer.rating_score ?? null,
    rating_count: beer.rating_count ?? null,
    stats: beer.stats ?? null,
    brewery: {
      brewery_id: brewery.brewery_id ?? null,
      brewery_name: brewery.brewery_name ?? null,
      brewery_type: brewery.brewery_type ?? null,
      brewery_city: brewery.location
        ? (brewery.location as Record<string, unknown>).brewery_city ?? null
        : null,
      brewery_state: brewery.location
        ? (brewery.location as Record<string, unknown>).brewery_state ?? null
        : null,
      country_name: brewery.country_name ?? null,
    },
    similar_beers:
      ((beer.similar as Record<string, unknown>)?.items as Record<string, unknown>[])
        ?.slice(0, 5)
        .map((i) => ({
          bid: (i.beer as Record<string, unknown>)?.bid,
          name: (i.beer as Record<string, unknown>)?.beer_name,
        })) ?? [],
  };
}

// ─── untappd_get_brewery ──────────────────────────────────────────────────────
// GET /brewery/info/{brewery_id}

export async function untappdGetBrewery(
  args: Record<string, unknown>
): Promise<unknown> {
  const creds = requireCreds(args);
  const breweryId = String(args.brewery_id ?? "").trim();
  if (!breweryId) return { error: "brewery_id is required." };

  const data = await untappdFetch<Record<string, unknown>>(
    `/brewery/info/${encodeURIComponent(breweryId)}`,
    creds
  );

  const brewery = (data.brewery as Record<string, unknown>) ?? {};

  return {
    brewery_id: brewery.brewery_id,
    brewery_name: brewery.brewery_name,
    brewery_slug: brewery.brewery_slug ?? null,
    brewery_type: brewery.brewery_type ?? null,
    brewery_label: brewery.brewery_label ?? null,
    brewery_description: brewery.brewery_description ?? null,
    country_name: brewery.country_name ?? null,
    location: brewery.location ?? null,
    contact: brewery.contact ?? null,
    stats: brewery.stats ?? null,
    beer_count: brewery.beer_count ?? null,
    rating: brewery.rating ?? null,
  };
}

// ─── untappd_search_brewery ───────────────────────────────────────────────────
// GET /search/brewery?q={q}

export async function untappdSearchBrewery(
  args: Record<string, unknown>
): Promise<unknown> {
  const creds = requireCreds(args);
  const q = String(args.q ?? "").trim();
  if (!q) return { error: "q is required (search query)." };

  const data = await untappdFetch<Record<string, unknown>>(
    "/search/brewery",
    creds,
    { q }
  );

  const brewery = (data.brewery as Record<string, unknown>) ?? {};
  const items = (brewery.items as Record<string, unknown>[]) ?? [];

  return {
    query: q,
    found: brewery.count ?? 0,
    results: items.map((item) => {
      const b = (item.brewery as Record<string, unknown>) ?? {};
      return {
        brewery_id: b.brewery_id,
        brewery_name: b.brewery_name,
        brewery_type: b.brewery_type ?? null,
        country_name: b.country_name ?? null,
        brewery_label: b.brewery_label ?? null,
      };
    }),
  };
}

// ─── untappd_beer_activities ──────────────────────────────────────────────────
// GET /beer/checkins/{bid}

export async function untappdBeerActivities(
  args: Record<string, unknown>
): Promise<unknown> {
  const creds = requireCreds(args);
  const bid = String(args.bid ?? "").trim();
  if (!bid) return { error: "bid is required (Untappd beer ID)." };

  const data = await untappdFetch<Record<string, unknown>>(
    `/beer/checkins/${encodeURIComponent(bid)}`,
    creds
  );

  const checkins = (data.checkins as Record<string, unknown>) ?? {};
  const items = (checkins.items as Record<string, unknown>[]) ?? [];

  return {
    bid,
    count: items.length,
    checkins: items.map((c) => ({
      checkin_id: c.checkin_id,
      rating_score: c.rating_score ?? null,
      checkin_comment: c.checkin_comment ?? null,
      created_at: c.created_at,
      user: c.user
        ? {
            user_name: (c.user as Record<string, unknown>).user_name,
            first_name: (c.user as Record<string, unknown>).first_name,
          }
        : null,
      venue: c.venue
        ? {
            venue_name: (c.venue as Record<string, unknown>).venue_name,
            venue_id: (c.venue as Record<string, unknown>).venue_id,
          }
        : null,
    })),
  };
}
