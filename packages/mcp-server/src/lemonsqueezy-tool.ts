// Lemon Squeezy API integration for the UnClick MCP server.
// Uses the Lemon Squeezy REST API via fetch - no external dependencies.
// Users must supply an API key from app.lemonsqueezy.com/settings/api.

const LS_API_BASE = "https://api.lemonsqueezy.com/v1";

// --- Types -------------------------------------------------------------------

interface LsListResponse<T> {
  data: T[];
  meta: {
    page: {
      currentPage: number;
      from: number;
      lastPage: number;
      perPage: number;
      to: number;
      total: number;
    };
  };
  links: Record<string, string>;
}

interface LsStore {
  id: string;
  type: string;
  attributes: {
    name: string;
    slug: string;
    domain: string;
    url: string;
    avatar_url: string;
    plan: string;
    country: string;
    currency: string;
    total_revenue: number;
    thirty_day_revenue: number;
    created_at: string;
    updated_at: string;
  };
}

interface LsProduct {
  id: string;
  type: string;
  attributes: {
    store_id: number;
    name: string;
    slug: string;
    description: string;
    status: string;
    price: number;
    price_formatted: string;
    buy_now_url: string;
    from_price: number | null;
    to_price: number | null;
    created_at: string;
    updated_at: string;
  };
}

interface LsOrder {
  id: string;
  type: string;
  attributes: {
    store_id: number;
    customer_id: number;
    identifier: string;
    order_number: number;
    user_name: string;
    user_email: string;
    currency: string;
    subtotal: number;
    discount_total: number;
    tax: number;
    total: number;
    total_formatted: string;
    status: string;
    status_formatted: string;
    created_at: string;
    updated_at: string;
  };
}

interface LsSubscription {
  id: string;
  type: string;
  attributes: {
    store_id: number;
    order_id: number;
    product_id: number;
    variant_id: number;
    product_name: string;
    variant_name: string;
    user_name: string;
    user_email: string;
    status: string;
    status_formatted: string;
    renews_at: string | null;
    ends_at: string | null;
    trial_ends_at: string | null;
    created_at: string;
    updated_at: string;
  };
}

interface LsCustomer {
  id: string;
  type: string;
  attributes: {
    store_id: number;
    name: string;
    email: string;
    status: string;
    total_revenue_currency: number;
    mrr: number;
    created_at: string;
    updated_at: string;
  };
}

// --- Auth validation ---------------------------------------------------------

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? "").trim();
  if (!key) throw new Error("api_key is required. Get one at app.lemonsqueezy.com/settings/api.");
  return key;
}

// --- API helpers -------------------------------------------------------------

async function lsGet<T>(apiKey: string, path: string): Promise<T> {
  const res = await fetch(`${LS_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/vnd.api+json",
    },
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const errors = data.errors as Array<{ detail?: string; title?: string }> | undefined;
    const msg = errors?.[0]?.detail ?? errors?.[0]?.title ?? `HTTP ${res.status}`;
    throw new Error(`Lemon Squeezy error: ${msg}`);
  }
  return data as T;
}

function buildQueryString(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  if (entries.length === 0) return "";
  return "?" + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`).join("&");
}

// --- Operations --------------------------------------------------------------

export async function lsListStores(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = requireKey(args);
    const qs = buildQueryString({
      "page[number]": args["page[number]"] ? String(args["page[number]"]) : undefined,
      "page[size]": args["page[size]"] ? String(args["page[size]"]) : undefined,
    });

    const response = await lsGet<LsListResponse<LsStore>>(apiKey, `/stores${qs}`);
    return {
      count: response.data.length,
      meta: response.meta,
      data: response.data.map((s) => ({
        id: s.id,
        name: s.attributes.name,
        slug: s.attributes.slug,
        domain: s.attributes.domain,
        url: s.attributes.url,
        plan: s.attributes.plan,
        country: s.attributes.country,
        currency: s.attributes.currency,
        created_at: s.attributes.created_at,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function lsListProducts(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = requireKey(args);
    const qs = buildQueryString({
      "filter[store_id]": args["filter[store_id]"] ? String(args["filter[store_id]"]) : undefined,
      "page[number]": args["page[number]"] ? String(args["page[number]"]) : undefined,
      "page[size]": args["page[size]"] ? String(args["page[size]"]) : undefined,
    });

    const response = await lsGet<LsListResponse<LsProduct>>(apiKey, `/products${qs}`);
    return {
      count: response.data.length,
      meta: response.meta,
      data: response.data.map((p) => ({
        id: p.id,
        store_id: p.attributes.store_id,
        name: p.attributes.name,
        slug: p.attributes.slug,
        status: p.attributes.status,
        price: p.attributes.price,
        price_formatted: p.attributes.price_formatted,
        buy_now_url: p.attributes.buy_now_url,
        created_at: p.attributes.created_at,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function lsListOrders(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = requireKey(args);
    const qs = buildQueryString({
      "filter[store_id]": args["filter[store_id]"] ? String(args["filter[store_id]"]) : undefined,
      "filter[user_email]": args["filter[user_email]"] ? String(args["filter[user_email]"]) : undefined,
      "page[number]": args["page[number]"] ? String(args["page[number]"]) : undefined,
      "page[size]": args["page[size]"] ? String(args["page[size]"]) : undefined,
    });

    const response = await lsGet<LsListResponse<LsOrder>>(apiKey, `/orders${qs}`);
    return {
      count: response.data.length,
      meta: response.meta,
      data: response.data.map((o) => ({
        id: o.id,
        store_id: o.attributes.store_id,
        order_number: o.attributes.order_number,
        user_name: o.attributes.user_name,
        user_email: o.attributes.user_email,
        currency: o.attributes.currency,
        total: o.attributes.total,
        total_formatted: o.attributes.total_formatted,
        status: o.attributes.status,
        status_formatted: o.attributes.status_formatted,
        created_at: o.attributes.created_at,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function lsListSubscriptions(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = requireKey(args);
    const qs = buildQueryString({
      "filter[store_id]": args["filter[store_id]"] ? String(args["filter[store_id]"]) : undefined,
      "filter[order_id]": args["filter[order_id]"] ? String(args["filter[order_id]"]) : undefined,
      "filter[status]": args["filter[status]"] ? String(args["filter[status]"]) : undefined,
      "page[number]": args["page[number]"] ? String(args["page[number]"]) : undefined,
      "page[size]": args["page[size]"] ? String(args["page[size]"]) : undefined,
    });

    const response = await lsGet<LsListResponse<LsSubscription>>(apiKey, `/subscriptions${qs}`);
    return {
      count: response.data.length,
      meta: response.meta,
      data: response.data.map((s) => ({
        id: s.id,
        store_id: s.attributes.store_id,
        order_id: s.attributes.order_id,
        product_name: s.attributes.product_name,
        variant_name: s.attributes.variant_name,
        user_name: s.attributes.user_name,
        user_email: s.attributes.user_email,
        status: s.attributes.status,
        status_formatted: s.attributes.status_formatted,
        renews_at: s.attributes.renews_at,
        ends_at: s.attributes.ends_at,
        trial_ends_at: s.attributes.trial_ends_at,
        created_at: s.attributes.created_at,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function lsGetOrder(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = requireKey(args);
    const orderId = String(args.order_id ?? "").trim();
    if (!orderId) throw new Error("order_id is required.");

    const response = await lsGet<{ data: LsOrder }>(apiKey, `/orders/${orderId}`);
    const o = response.data;
    return {
      id: o.id,
      store_id: o.attributes.store_id,
      customer_id: o.attributes.customer_id,
      identifier: o.attributes.identifier,
      order_number: o.attributes.order_number,
      user_name: o.attributes.user_name,
      user_email: o.attributes.user_email,
      currency: o.attributes.currency,
      subtotal: o.attributes.subtotal,
      discount_total: o.attributes.discount_total,
      tax: o.attributes.tax,
      total: o.attributes.total,
      total_formatted: o.attributes.total_formatted,
      status: o.attributes.status,
      status_formatted: o.attributes.status_formatted,
      created_at: o.attributes.created_at,
      updated_at: o.attributes.updated_at,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function lsListCustomers(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = requireKey(args);
    const qs = buildQueryString({
      "filter[store_id]": args["filter[store_id]"] ? String(args["filter[store_id]"]) : undefined,
      "filter[email]": args["filter[email]"] ? String(args["filter[email]"]) : undefined,
      "page[number]": args["page[number]"] ? String(args["page[number]"]) : undefined,
      "page[size]": args["page[size]"] ? String(args["page[size]"]) : undefined,
    });

    const response = await lsGet<LsListResponse<LsCustomer>>(apiKey, `/customers${qs}`);
    return {
      count: response.data.length,
      meta: response.meta,
      data: response.data.map((c) => ({
        id: c.id,
        store_id: c.attributes.store_id,
        name: c.attributes.name,
        email: c.attributes.email,
        status: c.attributes.status,
        total_revenue_currency: c.attributes.total_revenue_currency,
        mrr: c.attributes.mrr,
        created_at: c.attributes.created_at,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
