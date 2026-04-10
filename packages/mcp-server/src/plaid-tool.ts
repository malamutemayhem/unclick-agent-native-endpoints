// ─── Plaid API Tool ──────────────────────────────────────────────────────────
// Covers accounts, transactions, balances, identity, and link token creation.
// Auth: client_id + secret in request body (Plaid API convention).
// Environments: sandbox, development, production.
// Base URL: https://{env}.plaid.com
// No external dependencies - native fetch only.

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlaidConfig {
  client_id:   string;
  secret:      string;
  environment: string; // sandbox, development, production
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireConfig(args: Record<string, unknown>): PlaidConfig | { error: string } {
  const client_id   = String(args.client_id   ?? "").trim();
  const secret      = String(args.secret      ?? "").trim();
  const environment = String(args.environment ?? "sandbox").trim();
  if (!client_id) return { error: "client_id is required (Plaid client ID)." };
  if (!secret)    return { error: "secret is required (Plaid secret key)." };
  const validEnvs = ["sandbox", "development", "production"];
  if (!validEnvs.includes(environment)) {
    return { error: `environment must be one of: ${validEnvs.join(", ")}.` };
  }
  return { client_id, secret, environment };
}

async function plaidFetch(
  cfg:  PlaidConfig,
  path: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const url = `https://${cfg.environment}.plaid.com${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Plaid-Version": "2020-09-14",
      },
      body: JSON.stringify({
        client_id: cfg.client_id,
        secret:    cfg.secret,
        ...body,
      }),
    });
  } catch (err) {
    return { error: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (response.status === 429) {
    return { error: "Plaid rate limit reached. Wait before retrying.", status: 429 };
  }

  let data: unknown;
  try { data = await response.json(); } catch { return { error: `Non-JSON response (HTTP ${response.status})`, status: response.status }; }

  if (!response.ok) {
    const d = data as Record<string, unknown>;
    return {
      error:         d["error_message"] ?? d["message"] ?? "Plaid API error",
      error_code:    d["error_code"],
      error_type:    d["error_type"],
      display_message: d["display_message"],
      status:        response.status,
    };
  }

  return data;
}

// ─── plaid_accounts ───────────────────────────────────────────────────────────

export async function plaidAccounts(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  const access_token = String(args.access_token ?? "").trim();
  if (!access_token) return { error: "access_token is required (Plaid item access token)." };

  return plaidFetch(cfg, "/accounts/get", {
    access_token,
    options: args.account_ids ? { account_ids: args.account_ids } : undefined,
  });
}

// ─── plaid_transactions ───────────────────────────────────────────────────────

export async function plaidTransactions(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  const access_token = String(args.access_token ?? "").trim();
  const start_date   = String(args.start_date   ?? "").trim();
  const end_date     = String(args.end_date     ?? "").trim();
  if (!access_token) return { error: "access_token is required." };
  if (!start_date)   return { error: "start_date is required (YYYY-MM-DD)." };
  if (!end_date)     return { error: "end_date is required (YYYY-MM-DD)." };

  return plaidFetch(cfg, "/transactions/get", {
    access_token,
    start_date,
    end_date,
    options: {
      count:  args.count  ? Number(args.count)  : 100,
      offset: args.offset ? Number(args.offset) : 0,
      account_ids: args.account_ids ?? undefined,
    },
  });
}

// ─── plaid_balances ───────────────────────────────────────────────────────────

export async function plaidBalances(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  const access_token = String(args.access_token ?? "").trim();
  if (!access_token) return { error: "access_token is required." };

  return plaidFetch(cfg, "/accounts/balance/get", {
    access_token,
    options: args.account_ids ? { account_ids: args.account_ids } : undefined,
  });
}

// ─── plaid_identity ───────────────────────────────────────────────────────────

export async function plaidIdentity(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  const access_token = String(args.access_token ?? "").trim();
  if (!access_token) return { error: "access_token is required." };

  return plaidFetch(cfg, "/identity/get", { access_token });
}

// ─── plaid_link_token_create ──────────────────────────────────────────────────

export async function plaidLinkTokenCreate(args: Record<string, unknown>): Promise<unknown> {
  const cfg = requireConfig(args);
  if ("error" in cfg) return cfg;

  const user_client_user_id = String(args.user_client_user_id ?? "").trim();
  if (!user_client_user_id) return { error: "user_client_user_id is required (unique ID for the user)." };

  const products = args.products && Array.isArray(args.products)
    ? args.products as string[]
    : ["transactions"];

  const country_codes = args.country_codes && Array.isArray(args.country_codes)
    ? args.country_codes as string[]
    : ["US"];

  return plaidFetch(cfg, "/link/token/create", {
    user:          { client_user_id: user_client_user_id },
    client_name:   args.client_name    ? String(args.client_name)    : "UnClick Agent",
    products,
    country_codes,
    language:      args.language       ? String(args.language)       : "en",
    webhook:       args.webhook        ? String(args.webhook)        : undefined,
    access_token:  args.access_token   ? String(args.access_token)   : undefined,
  });
}
