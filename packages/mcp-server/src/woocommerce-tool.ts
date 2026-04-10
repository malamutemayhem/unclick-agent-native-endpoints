// ─── WooCommerce REST API Tool ───────────────────────────────────────────────
// Covers products, orders, customers, and coupons.
// Auth: Consumer key + Consumer secret (HTTP Basic Auth).
// API: WooCommerce REST API v3 (wp-json/wc/v3).
// No external dependencies - native fetch only.

// ─── Types ────────────────────────────────────────────────────────────────────

interface WooConfig {
  store_url:       string; // e.g. https://mystore.com
  consumer_key:    string; // ck_...
  consumer_secret: string; // cs_...
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireConfig(args: Record<string, unknown>): WooConfig | { error: string } {
  const store_url       = String(args.store_url       ?? "").trim().replace(/\/$/, "");
  const consumer_key    = String(args.consumer_key    ?? "").trim();
  const consumer_secret = String(args.consumer_secret ?? "").trim();
  if (!store_url)       return { error: "store_url is required (e.g. https://mystore.com)." };
  if (!consumer_key)    return { error: "consumer_key is required (WooCommerce consumer key, starts with ck_)." };
  if (!consumer_secret) return { error: "consumer_secret is required (WooCommerce consumer secret, starts with cs_)." };
  return { store_url, consumer_key, consumer_secret };
}

async function wooFetch(
  cfg:    WooConfig,
  method: "GET" | "POST",
  path:   string,
  body?:  unknown,
  query?: Record<string, string | number | boolean | undefined>,
): Promise<unknown> {
  const base = `${cfg.store_url}/wp-json/wc/v3`;
  const url  = new URL(`${base}${path}`);

  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const credentials = Buffer.from(`${cfg.consumer_key}:${cfg.consumer_secret}`).toString("base64");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization:  `Basic ${credentials}`,
        "Content-Type": "application/json",
        "Accept":       "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    return { error: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    return { error: "WooCommerce rate limit reached.", retry_after: retryAfter ? Number(retryAfter) : 5, status: 429 };
  }

  if (response.status === 401 || response.status === 403) {
    return { error: "WooCommerce auth failed: invalid consumer key or secret.", status: response.status };
  }

  let data: unknown;
  try { data = await response.json(); } catch { return { error: `Non-JSON response (HTTP ${response.status})`, status: response.status }; }

  if (!response.ok) {
    const d = data as Record<string, unknown>;
    return { error: d["message"] ?? d["code"] ?? "WooCommerce API error", status: response.status, code: d["code"] };
  }

  return data;
}

// ─── woo_products ─────────────────────────────────────────────────────────────

export async function wooProducts(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  const action = String(args.action ?? "list");

  switch (action) {
    case "list": {
      return wooFetch(cfg, "GET", "/products", undefined, {
        per_page: args.per_page ? Number(args.per_page) : 20,
        page:     args.page     ? Number(args.page)     : 1,
        status:   args.status   ? String(args.status)   : undefined,
        category: args.category ? String(args.category) : undefined,
        search:   args.search   ? String(args.search)   : undefined,
        orderby:  args.orderby  ? String(args.orderby)  : undefined,
        order:    args.order    ? String(args.order)    : undefined,
      });
    }
    case "get": {
      const id = String(args.id ?? "").trim();
      if (!id) return { error: "id is required for action='get'." };
      return wooFetch(cfg, "GET", `/products/${encodeURIComponent(id)}`);
    }
    default:
      return { error: `Unknown action "${action}". Valid: list, get.` };
  }
}

// ─── woo_orders ───────────────────────────────────────────────────────────────

export async function wooOrders(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  const action = String(args.action ?? "list");

  switch (action) {
    case "list": {
      return wooFetch(cfg, "GET", "/orders", undefined, {
        per_page: args.per_page ? Number(args.per_page) : 20,
        page:     args.page     ? Number(args.page)     : 1,
        status:   args.status   ? String(args.status)   : undefined,
        customer: args.customer ? Number(args.customer) : undefined,
        after:    args.after    ? String(args.after)    : undefined,
        before:   args.before   ? String(args.before)   : undefined,
      });
    }
    case "get": {
      const id = String(args.id ?? "").trim();
      if (!id) return { error: "id is required for action='get'." };
      return wooFetch(cfg, "GET", `/orders/${encodeURIComponent(id)}`);
    }
    case "create": {
      if (!args.order || typeof args.order !== "object") {
        return { error: "order object is required for action='create'." };
      }
      return wooFetch(cfg, "POST", "/orders", args.order);
    }
    default:
      return { error: `Unknown action "${action}". Valid: list, get, create.` };
  }
}

// ─── woo_customers ────────────────────────────────────────────────────────────

export async function wooCustomers(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  return wooFetch(cfg, "GET", "/customers", undefined, {
    per_page: args.per_page ? Number(args.per_page) : 20,
    page:     args.page     ? Number(args.page)     : 1,
    search:   args.search   ? String(args.search)   : undefined,
    email:    args.email    ? String(args.email)    : undefined,
    role:     args.role     ? String(args.role)     : undefined,
    orderby:  args.orderby  ? String(args.orderby)  : undefined,
    order:    args.order    ? String(args.order)    : undefined,
  });
}
