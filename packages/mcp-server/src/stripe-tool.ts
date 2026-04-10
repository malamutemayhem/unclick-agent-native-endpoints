// ─── Stripe REST API Tool ────────────────────────────────────────────────────
// Covers customers, charges, subscriptions, invoices, products, and prices.
// Auth: Secret key (Bearer token - sk_live_* or sk_test_*).
// Base URL: https://api.stripe.com/v1
// No external dependencies - native fetch only.

const STRIPE_BASE = "https://api.stripe.com/v1";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StripeConfig {
  secret_key: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireConfig(args: Record<string, unknown>): StripeConfig | { error: string } {
  const secret_key = String(args.secret_key ?? "").trim();
  if (!secret_key) return { error: "secret_key is required (Stripe secret key, starts with sk_)." };
  return { secret_key };
}

async function stripeFetch(
  cfg:    StripeConfig,
  method: "GET" | "POST" | "DELETE",
  path:   string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<unknown> {
  const url = new URL(`${STRIPE_BASE}${path}`);

  let body: string | undefined;
  if (method === "GET" && params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  } else if (method === "POST" && params) {
    const form = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) form.set(k, String(v));
    }
    body = form.toString();
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization:  `Bearer ${cfg.secret_key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  } catch (err) {
    return { error: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    return { error: "Stripe rate limit reached.", retry_after: retryAfter ? Number(retryAfter) : 5, status: 429 };
  }

  if (response.status === 401 || response.status === 403) {
    return { error: "Stripe auth failed: invalid secret key.", status: response.status };
  }

  let data: unknown;
  try { data = await response.json(); } catch { return { error: `Non-JSON response (HTTP ${response.status})`, status: response.status }; }

  if (!response.ok) {
    const d = data as Record<string, unknown>;
    const err = d["error"] as Record<string, unknown> | undefined;
    return { error: err?.["message"] ?? d["message"] ?? "Stripe API error", status: response.status };
  }

  return data;
}

// ─── stripe_customers ─────────────────────────────────────────────────────────

export async function stripeCustomers(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  const action = String(args.action ?? "list");

  switch (action) {
    case "list": {
      return stripeFetch(cfg, "GET", "/customers", {
        limit:          args.limit          ? Number(args.limit)          : 20,
        starting_after: args.starting_after ? String(args.starting_after) : undefined,
        email:          args.email          ? String(args.email)          : undefined,
      });
    }
    case "create": {
      const params: Record<string, string | number | boolean | undefined> = {};
      if (args.email)       params["email"]       = String(args.email);
      if (args.name)        params["name"]         = String(args.name);
      if (args.phone)       params["phone"]        = String(args.phone);
      if (args.description) params["description"]  = String(args.description);
      return stripeFetch(cfg, "POST", "/customers", params);
    }
    default:
      return { error: `Unknown action "${action}". Valid: list, create.` };
  }
}

// ─── stripe_charges ───────────────────────────────────────────────────────────

export async function stripeCharges(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  const action = String(args.action ?? "list");

  switch (action) {
    case "list": {
      return stripeFetch(cfg, "GET", "/charges", {
        limit:          args.limit          ? Number(args.limit)          : 20,
        starting_after: args.starting_after ? String(args.starting_after) : undefined,
        customer:       args.customer       ? String(args.customer)       : undefined,
        created:        args.created        ? Number(args.created)        : undefined,
      });
    }
    case "create": {
      const amount   = Number(args.amount ?? 0);
      const currency = String(args.currency ?? "").trim();
      if (!amount)   return { error: "amount is required for action='create' (in smallest currency unit, e.g. cents)." };
      if (!currency) return { error: "currency is required for action='create' (e.g. 'usd')." };
      const params: Record<string, string | number | boolean | undefined> = { amount, currency };
      if (args.source)      params["source"]      = String(args.source);
      if (args.customer)    params["customer"]    = String(args.customer);
      if (args.description) params["description"] = String(args.description);
      return stripeFetch(cfg, "POST", "/charges", params);
    }
    default:
      return { error: `Unknown action "${action}". Valid: list, create.` };
  }
}

// ─── stripe_subscriptions ─────────────────────────────────────────────────────

export async function stripeSubscriptions(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  return stripeFetch(cfg, "GET", "/subscriptions", {
    limit:          args.limit          ? Number(args.limit)          : 20,
    starting_after: args.starting_after ? String(args.starting_after) : undefined,
    customer:       args.customer       ? String(args.customer)       : undefined,
    status:         args.status         ? String(args.status)         : undefined,
    price:          args.price          ? String(args.price)          : undefined,
  });
}

// ─── stripe_invoices ──────────────────────────────────────────────────────────

export async function stripeInvoices(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  return stripeFetch(cfg, "GET", "/invoices", {
    limit:          args.limit          ? Number(args.limit)          : 20,
    starting_after: args.starting_after ? String(args.starting_after) : undefined,
    customer:       args.customer       ? String(args.customer)       : undefined,
    status:         args.status         ? String(args.status)         : undefined,
    subscription:   args.subscription   ? String(args.subscription)   : undefined,
  });
}

// ─── stripe_products ──────────────────────────────────────────────────────────

export async function stripeProducts(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  return stripeFetch(cfg, "GET", "/products", {
    limit:          args.limit          ? Number(args.limit)          : 20,
    starting_after: args.starting_after ? String(args.starting_after) : undefined,
    active:         args.active !== undefined ? (args.active ? "true" : "false") as unknown as boolean : undefined,
  });
}

// ─── stripe_prices ────────────────────────────────────────────────────────────

export async function stripePrices(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  return stripeFetch(cfg, "GET", "/prices", {
    limit:          args.limit          ? Number(args.limit)          : 20,
    starting_after: args.starting_after ? String(args.starting_after) : undefined,
    product:        args.product        ? String(args.product)        : undefined,
    active:         args.active !== undefined ? (args.active ? "true" : "false") as unknown as boolean : undefined,
    type:           args.type           ? String(args.type)           : undefined,
  });
}
