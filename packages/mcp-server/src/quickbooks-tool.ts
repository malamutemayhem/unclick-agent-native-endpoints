// ─── QuickBooks Online API Tool ──────────────────────────────────────────────
// Covers customers, invoices, items, and payments via QuickBooks Online Accounting API.
// Auth: OAuth 2.0 Bearer token + company realm ID.
// Base URLs:
//   Production: https://quickbooks.api.intuit.com/v3/company/{realmId}
//   Sandbox:    https://sandbox-quickbooks.api.intuit.com/v3/company/{realmId}
// No external dependencies - native fetch only.

// ─── Types ────────────────────────────────────────────────────────────────────

interface QBConfig {
  access_token: string;
  realm_id:     string;
  sandbox:      boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireConfig(args: Record<string, unknown>): QBConfig | { error: string } {
  const access_token = String(args.access_token ?? "").trim();
  const realm_id     = String(args.realm_id     ?? "").trim();
  if (!access_token) return { error: "access_token is required (QuickBooks OAuth2 access token)." };
  if (!realm_id)     return { error: "realm_id is required (QuickBooks company realm/company ID)." };
  return {
    access_token,
    realm_id,
    sandbox: args.sandbox === true || String(args.sandbox) === "true",
  };
}

function qbBase(cfg: QBConfig): string {
  const host = cfg.sandbox
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";
  return `${host}/v3/company/${encodeURIComponent(cfg.realm_id)}`;
}

async function qbFetch(
  cfg:    QBConfig,
  method: "GET" | "POST",
  path:   string,
  body?:  unknown,
): Promise<unknown> {
  const url = `${qbBase(cfg)}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization:  `Bearer ${cfg.access_token}`,
        "Content-Type": "application/json",
        "Accept":       "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    return { error: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (response.status === 429) {
    return { error: "QuickBooks rate limit reached. Wait before retrying.", status: 429 };
  }

  if (response.status === 401) {
    return { error: "QuickBooks auth failed: access token expired or invalid.", status: 401 };
  }

  let data: unknown;
  try { data = await response.json(); } catch { return { error: `Non-JSON response (HTTP ${response.status})`, status: response.status }; }

  if (!response.ok) {
    const d = data as Record<string, unknown>;
    const fault = d["Fault"] as Record<string, unknown> | undefined;
    const errs  = fault?.["Error"];
    return { error: Array.isArray(errs) ? errs : d["message"] ?? "QuickBooks API error", status: response.status };
  }

  return data;
}

async function qbQuery(cfg: QBConfig, sql: string): Promise<unknown> {
  const url = new URL(`${qbBase(cfg)}/query`);
  url.searchParams.set("query", sql);
  url.searchParams.set("minorversion", "65");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${cfg.access_token}`,
        "Accept":      "application/json",
      },
    });
  } catch (err) {
    return { error: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (response.status === 429) {
    return { error: "QuickBooks rate limit reached.", status: 429 };
  }

  if (response.status === 401) {
    return { error: "QuickBooks auth failed: access token expired or invalid.", status: 401 };
  }

  let data: unknown;
  try { data = await response.json(); } catch { return { error: `Non-JSON response (HTTP ${response.status})`, status: response.status }; }

  if (!response.ok) {
    const d = data as Record<string, unknown>;
    return { error: d["Fault"] ?? d["message"] ?? "QuickBooks query error", status: response.status };
  }

  return data;
}

// ─── quickbooks_customers ─────────────────────────────────────────────────────

export async function quickbooksCustomers(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  const limit  = Number(args.limit  ?? 100);
  const offset = Number(args.offset ?? 1);
  const where  = args.where ? ` WHERE ${String(args.where)}` : "";

  return qbQuery(cfg, `SELECT * FROM Customer${where} MAXRESULTS ${limit} STARTPOSITION ${offset}`);
}

// ─── quickbooks_invoices ──────────────────────────────────────────────────────

export async function quickbooksInvoices(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  const action = String(args.action ?? "list");

  switch (action) {
    case "list": {
      const limit  = Number(args.limit  ?? 100);
      const offset = Number(args.offset ?? 1);
      const where  = args.where ? ` WHERE ${String(args.where)}` : "";
      return qbQuery(cfg, `SELECT * FROM Invoice${where} MAXRESULTS ${limit} STARTPOSITION ${offset}`);
    }
    case "get": {
      const invoice_id = String(args.invoice_id ?? "").trim();
      if (!invoice_id) return { error: "invoice_id is required for action='get'." };
      return qbFetch(cfg, "GET", `/invoice/${encodeURIComponent(invoice_id)}?minorversion=65`);
    }
    case "create": {
      if (!args.invoice || typeof args.invoice !== "object") {
        return { error: "invoice object is required for action='create'." };
      }
      return qbFetch(cfg, "POST", "/invoice?minorversion=65", args.invoice);
    }
    default:
      return { error: `Unknown action "${action}". Valid: list, get, create.` };
  }
}

// ─── quickbooks_items ─────────────────────────────────────────────────────────

export async function quickbooksItems(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  const limit  = Number(args.limit  ?? 100);
  const offset = Number(args.offset ?? 1);
  const where  = args.where ? ` WHERE ${String(args.where)}` : "";

  return qbQuery(cfg, `SELECT * FROM Item${where} MAXRESULTS ${limit} STARTPOSITION ${offset}`);
}

// ─── quickbooks_payments ──────────────────────────────────────────────────────

export async function quickbooksPayments(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  const limit  = Number(args.limit  ?? 100);
  const offset = Number(args.offset ?? 1);
  const where  = args.where ? ` WHERE ${String(args.where)}` : "";

  return qbQuery(cfg, `SELECT * FROM Payment${where} MAXRESULTS ${limit} STARTPOSITION ${offset}`);
}
