// ─── Square REST API Tool ────────────────────────────────────────────────────
// Covers payments, orders, customers, and catalog.
// Auth: Access token (Bearer token).
// Base URL: https://connect.squareup.com/v2
// No external dependencies - native fetch only.

const SQUARE_BASE = "https://connect.squareup.com/v2";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SquareConfig {
  access_token: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireConfig(args: Record<string, unknown>): SquareConfig | { error: string } {
  const access_token = String(args.access_token ?? "").trim();
  if (!access_token) return { error: "access_token is required (Square access token)." };
  return { access_token };
}

async function squareFetch(
  cfg:    SquareConfig,
  method: "GET" | "POST",
  path:   string,
  body?:  unknown,
  query?: Record<string, string | number | boolean | undefined>,
): Promise<unknown> {
  const url = new URL(`${SQUARE_BASE}${path}`);
  if (method === "GET" && query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization:   `Bearer ${cfg.access_token}`,
        "Square-Version": "2024-01-17",
        "Content-Type":   "application/json",
        "Accept":         "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    return { error: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (response.status === 429) {
    return { error: "Square rate limit reached. Wait before retrying.", status: 429 };
  }

  if (response.status === 401) {
    return { error: "Square auth failed: invalid or missing access token.", status: 401 };
  }

  let data: unknown;
  try { data = await response.json(); } catch { return { error: `Non-JSON response (HTTP ${response.status})`, status: response.status }; }

  if (!response.ok) {
    const d = data as Record<string, unknown>;
    return { error: d["errors"] ?? d["message"] ?? "Square API error", status: response.status };
  }

  return data;
}

// ─── square_payments ──────────────────────────────────────────────────────────

export async function squarePayments(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  const action = String(args.action ?? "list");

  switch (action) {
    case "list": {
      return squareFetch(cfg, "GET", "/payments", undefined, {
        begin_time: args.begin_time ? String(args.begin_time) : undefined,
        end_time:   args.end_time   ? String(args.end_time)   : undefined,
        cursor:     args.cursor     ? String(args.cursor)     : undefined,
        limit:      args.limit      ? Number(args.limit)      : 20,
      });
    }
    case "create": {
      const source_id = String(args.source_id ?? "").trim();
      const idempotency_key = String(args.idempotency_key ?? crypto.randomUUID());
      if (!source_id) return { error: "source_id is required for action='create'." };
      if (!args.amount_money || typeof args.amount_money !== "object") {
        return { error: "amount_money object is required for action='create' (e.g. {amount: 100, currency: 'USD'})." };
      }
      return squareFetch(cfg, "POST", "/payments", {
        source_id,
        idempotency_key,
        amount_money: args.amount_money,
        note:         args.note         ? String(args.note)         : undefined,
        customer_id:  args.customer_id  ? String(args.customer_id)  : undefined,
      });
    }
    default:
      return { error: `Unknown action "${action}". Valid: list, create.` };
  }
}

// ─── square_customers ─────────────────────────────────────────────────────────

export async function squareCustomers(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  return squareFetch(cfg, "GET", "/customers", undefined, {
    cursor:     args.cursor     ? String(args.cursor)     : undefined,
    limit:      args.limit      ? Number(args.limit)      : 20,
    sort_field: args.sort_field ? String(args.sort_field) : undefined,
    sort_order: args.sort_order ? String(args.sort_order) : undefined,
  });
}

// ─── square_catalog_list ──────────────────────────────────────────────────────

export async function squareCatalogList(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  return squareFetch(cfg, "GET", "/catalog/list", undefined, {
    cursor:   args.cursor   ? String(args.cursor)   : undefined,
    types:    args.types    ? String(args.types)    : undefined,
    limit:    args.limit    ? Number(args.limit)    : 100,
  });
}

// ─── square_catalog_search ────────────────────────────────────────────────────

export async function squareCatalogSearch(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  const text_filter = String(args.text_filter ?? "").trim();
  if (!text_filter) return { error: "text_filter (search text) is required." };

  const objectTypes = args.object_types && Array.isArray(args.object_types)
    ? args.object_types as string[]
    : ["ITEM"];

  return squareFetch(cfg, "POST", "/catalog/search", {
    text_filter:  { keyword: text_filter },
    object_types: objectTypes,
    limit:        args.limit ? Number(args.limit) : 20,
    cursor:       args.cursor ? String(args.cursor) : undefined,
  });
}
