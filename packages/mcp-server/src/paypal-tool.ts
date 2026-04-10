// ─── PayPal REST API Tool ────────────────────────────────────────────────────
// Covers orders, payments, and invoices.
// Auth: OAuth 2.0 client credentials (client_id + client_secret).
//   Access token is fetched automatically per request.
// Base URLs:
//   Live:    https://api-m.paypal.com
//   Sandbox: https://api-m.sandbox.paypal.com
// No external dependencies - native fetch only.

// ─── Types ────────────────────────────────────────────────────────────────────

interface PayPalConfig {
  client_id:     string;
  client_secret: string;
  sandbox:       boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireConfig(args: Record<string, unknown>): PayPalConfig | { error: string } {
  const client_id     = String(args.client_id     ?? "").trim();
  const client_secret = String(args.client_secret ?? "").trim();
  if (!client_id)     return { error: "client_id is required (PayPal application Client ID)." };
  if (!client_secret) return { error: "client_secret is required (PayPal application Client Secret)." };
  return {
    client_id,
    client_secret,
    sandbox: args.sandbox === true || String(args.sandbox) === "true",
  };
}

function baseUrl(cfg: PayPalConfig): string {
  return cfg.sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}

async function getPayPalToken(cfg: PayPalConfig): Promise<string | { error: string }> {
  const credentials = Buffer.from(`${cfg.client_id}:${cfg.client_secret}`).toString("base64");
  let response: Response;
  try {
    response = await fetch(`${baseUrl(cfg)}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization:  `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept":       "application/json",
      },
      body: "grant_type=client_credentials",
    });
  } catch (err) {
    return { error: `Network error fetching PayPal token: ${err instanceof Error ? err.message : String(err)}` };
  }

  let data: unknown;
  try { data = await response.json(); } catch { return { error: "Non-JSON response from PayPal token endpoint." }; }

  if (!response.ok) {
    const d = data as Record<string, unknown>;
    return { error: `PayPal auth failed (${response.status}): ${d["error_description"] ?? d["message"] ?? "unknown"}` };
  }

  return String((data as Record<string, unknown>)["access_token"] ?? "");
}

async function paypalFetch(
  cfg:    PayPalConfig,
  method: "GET" | "POST",
  path:   string,
  body?:  unknown,
  query?: Record<string, string | number | undefined>,
): Promise<unknown> {
  const tokenResult = await getPayPalToken(cfg);
  if (typeof tokenResult === "object" && "error" in tokenResult) return tokenResult;

  const url = new URL(`${baseUrl(cfg)}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization:  `Bearer ${tokenResult}`,
        "Content-Type": "application/json",
        "Accept":       "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    return { error: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (response.status === 429) {
    return { error: "PayPal rate limit reached. Wait before retrying.", status: 429 };
  }

  if (response.status === 204) {
    return { success: true };
  }

  let data: unknown;
  try { data = await response.json(); } catch { return { error: `Non-JSON response (HTTP ${response.status})`, status: response.status }; }

  if (!response.ok) {
    const d = data as Record<string, unknown>;
    return { error: d["message"] ?? d["error_description"] ?? "PayPal API error", status: response.status, detail: d };
  }

  return data;
}

// ─── paypal_orders ────────────────────────────────────────────────────────────

export async function paypalOrders(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  const action = String(args.action ?? "get");

  switch (action) {
    case "create": {
      const intent        = String(args.intent       ?? "CAPTURE");
      const purchase_units = args.purchase_units;
      if (!purchase_units || !Array.isArray(purchase_units)) {
        return { error: "purchase_units (array) is required for action='create'." };
      }
      return paypalFetch(cfg, "POST", "/v2/checkout/orders", { intent, purchase_units });
    }
    case "get": {
      const order_id = String(args.order_id ?? "").trim();
      if (!order_id) return { error: "order_id is required for action='get'." };
      return paypalFetch(cfg, "GET", `/v2/checkout/orders/${encodeURIComponent(order_id)}`);
    }
    default:
      return { error: `Unknown action "${action}". Valid: create, get.` };
  }
}

// ─── paypal_invoices ──────────────────────────────────────────────────────────

export async function paypalInvoices(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  const action = String(args.action ?? "list");

  switch (action) {
    case "list": {
      return paypalFetch(cfg, "GET", "/v2/invoicing/invoices", undefined, {
        page:      args.page      ? Number(args.page)      : 1,
        page_size: args.page_size ? Number(args.page_size) : 20,
      });
    }
    case "create": {
      if (!args.invoice || typeof args.invoice !== "object") {
        return { error: "invoice object is required for action='create'." };
      }
      return paypalFetch(cfg, "POST", "/v2/invoicing/invoices", args.invoice);
    }
    case "send": {
      const invoice_id = String(args.invoice_id ?? "").trim();
      if (!invoice_id) return { error: "invoice_id is required for action='send'." };
      return paypalFetch(cfg, "POST", `/v2/invoicing/invoices/${encodeURIComponent(invoice_id)}/send`, {
        send_to_invoicer: args.send_to_invoicer !== false,
      });
    }
    default:
      return { error: `Unknown action "${action}". Valid: list, create, send.` };
  }
}
