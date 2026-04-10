// ─── Etsy Open API v3 Tool ───────────────────────────────────────────────────
// Covers listings, shops, and reviews via the Etsy Open API v3.
// Auth: API key (x-api-key header).
// Base URL: https://openapi.etsy.com/v3
// No external dependencies - native fetch only.

const ETSY_BASE = "https://openapi.etsy.com/v3";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EtsyConfig {
  api_key: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireConfig(args: Record<string, unknown>): EtsyConfig | { error: string } {
  const api_key = String(args.api_key ?? "").trim();
  if (!api_key) return { error: "api_key is required (Etsy API key)." };
  return { api_key };
}

async function etsyFetch(
  cfg:    EtsyConfig,
  path:   string,
  query?: Record<string, string | number | boolean | undefined>,
): Promise<unknown> {
  const url = new URL(`${ETSY_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        "x-api-key": cfg.api_key,
        "Accept":    "application/json",
      },
    });
  } catch (err) {
    return { error: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    return { error: "Etsy rate limit reached.", retry_after: retryAfter ? Number(retryAfter) : 10, status: 429 };
  }

  if (response.status === 403) {
    return { error: "Etsy auth failed: invalid or missing API key.", status: 403 };
  }

  let data: unknown;
  try { data = await response.json(); } catch { return { error: `Non-JSON response (HTTP ${response.status})`, status: response.status }; }

  if (!response.ok) {
    const d = data as Record<string, unknown>;
    return { error: d["error"] ?? d["message"] ?? "Etsy API error", status: response.status };
  }

  return data;
}

// ─── etsy_search_listings ─────────────────────────────────────────────────────

export async function etsySearchListings(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  const keywords = String(args.keywords ?? "").trim();
  if (!keywords) return { error: "keywords is required for searching listings." };

  return etsyFetch(cfg, "/application/listings/active", {
    keywords,
    limit:          args.limit          ? Number(args.limit)          : 25,
    offset:         args.offset         ? Number(args.offset)         : undefined,
    sort_on:        args.sort_on        ? String(args.sort_on)        : undefined,
    sort_order:     args.sort_order     ? String(args.sort_order)     : undefined,
    min_price:      args.min_price      ? Number(args.min_price)      : undefined,
    max_price:      args.max_price      ? Number(args.max_price)      : undefined,
    taxonomy_id:    args.taxonomy_id    ? Number(args.taxonomy_id)    : undefined,
    location:       args.location       ? String(args.location)       : undefined,
  });
}

// ─── etsy_get_listing ─────────────────────────────────────────────────────────

export async function etsyGetListing(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  const listing_id = String(args.listing_id ?? "").trim();
  if (!listing_id) return { error: "listing_id is required." };

  return etsyFetch(cfg, `/application/listings/${encodeURIComponent(listing_id)}`, {
    includes: args.includes ? String(args.includes) : undefined,
  });
}

// ─── etsy_get_shop ────────────────────────────────────────────────────────────

export async function etsyGetShop(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  const shop_id = String(args.shop_id ?? "").trim();
  if (!shop_id) return { error: "shop_id is required." };

  return etsyFetch(cfg, `/application/shops/${encodeURIComponent(shop_id)}`);
}

// ─── etsy_get_shop_listings ───────────────────────────────────────────────────

export async function etsyGetShopListings(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  const shop_id = String(args.shop_id ?? "").trim();
  if (!shop_id) return { error: "shop_id is required." };

  return etsyFetch(cfg, `/application/shops/${encodeURIComponent(shop_id)}/listings/active`, {
    limit:      args.limit      ? Number(args.limit)      : 25,
    offset:     args.offset     ? Number(args.offset)     : undefined,
    sort_on:    args.sort_on    ? String(args.sort_on)    : undefined,
    sort_order: args.sort_order ? String(args.sort_order) : undefined,
  });
}

// ─── etsy_search_shops ────────────────────────────────────────────────────────

export async function etsySearchShops(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  const shop_name = String(args.shop_name ?? "").trim();
  if (!shop_name) return { error: "shop_name is required." };

  return etsyFetch(cfg, "/application/shops", {
    shop_name,
    limit:  args.limit  ? Number(args.limit)  : 25,
    offset: args.offset ? Number(args.offset) : undefined,
  });
}
