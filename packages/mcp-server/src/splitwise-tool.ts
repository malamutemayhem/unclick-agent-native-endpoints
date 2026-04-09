// ── Splitwise API tool ─────────────────────────────────────────────────────────
// Wraps the Splitwise REST API (https://secure.splitwise.com/api/v3.0/) via fetch.
// Auth: Bearer token (SPLITWISE_API_KEY).
//
// Credentials are auto-resolved via vault-bridge:
//   1. Inline args   (api_key passed directly)
//   2. Env var       UNCLICK_SPLITWISE_API_KEY
//   3. Local vault   key "splitwise/api_key"
//   4. Supabase      via UNCLICK_API_KEY + unclick.world/api/credentials
//
// No external dependencies.

import { resolveCredentials } from "./vault-bridge.js";

const SPLITWISE_BASE = "https://secure.splitwise.com/api/v3.0";

// ── Shared fetch helper ────────────────────────────────────────────────────────

async function splitwiseFetch(
  token: string,
  method: "GET" | "POST",
  path: string,
  query?: Record<string, string | number | undefined>,
  body?: unknown
): Promise<unknown> {
  const url = new URL(`${SPLITWISE_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept:        "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    return { error: `Network error reaching Splitwise API: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (response.status === 401) return { error: "Splitwise API key is invalid or expired. Check your SPLITWISE_API_KEY.", status: 401 };
  if (response.status === 404) return { error: "Resource not found. Check the group or expense ID.", status: 404 };
  if (response.status === 429) return { error: "Splitwise rate limit exceeded. Please wait and retry.", status: 429 };

  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!response.ok) {
    const detail = (data as Record<string, unknown>)?.error ?? (data as Record<string, unknown>)?.errors ?? text;
    return { error: `Splitwise API error ${response.status}: ${JSON.stringify(detail)}`, status: response.status };
  }

  return data;
}

// ── Action implementations ─────────────────────────────────────────────────────

async function getGroups(token: string, _args: Record<string, unknown>): Promise<unknown> {
  return splitwiseFetch(token, "GET", "/get_groups");
}

async function getExpenses(token: string, args: Record<string, unknown>): Promise<unknown> {
  const group_id = String(args.group_id ?? "").trim();
  if (!group_id) return { error: "group_id is required." };

  return splitwiseFetch(token, "GET", "/get_expenses", {
    group_id,
    limit:  args.limit ? Number(args.limit) : 20,
    offset: args.offset ? Number(args.offset) : 0,
    dated_after:  args.dated_after  ? String(args.dated_after)  : undefined,
    dated_before: args.dated_before ? String(args.dated_before) : undefined,
  });
}

async function getBalances(token: string, _args: Record<string, unknown>): Promise<unknown> {
  return splitwiseFetch(token, "GET", "/get_main_data");
}

async function createExpense(token: string, args: Record<string, unknown>): Promise<unknown> {
  const cost        = String(args.cost ?? "").trim();
  const description = String(args.description ?? "").trim();
  if (!cost)        return { error: "cost is required (e.g. '10.00')." };
  if (!description) return { error: "description is required." };

  const body: Record<string, unknown> = { cost, description };
  if (args.group_id)            body.group_id            = Number(args.group_id);
  if (args.currency_code)       body.currency_code       = String(args.currency_code);
  if (args.date)                body.date                = String(args.date);
  if (args.split_equally !== undefined) body.split_equally = Boolean(args.split_equally);

  // Support passing users array for custom splits
  if (args.users && Array.isArray(args.users)) {
    (args.users as Array<Record<string, unknown>>).forEach((u, i) => {
      body[`users__${i}__user_id`]    = u.user_id;
      body[`users__${i}__paid_share`] = u.paid_share ?? "0.00";
      body[`users__${i}__owed_share`] = u.owed_share ?? "0.00";
    });
  }

  return splitwiseFetch(token, "POST", "/create_expense", undefined, body);
}

async function getFriends(token: string, _args: Record<string, unknown>): Promise<unknown> {
  return splitwiseFetch(token, "GET", "/get_friends");
}

// ── Public dispatcher ──────────────────────────────────────────────────────────

export async function splitwiseAction(
  action: string,
  args:   Record<string, unknown>
): Promise<unknown> {
  const resolved = await resolveCredentials("splitwise", args);
  if ("error" in resolved) return resolved;

  const token = String(resolved.api_key ?? "").trim();
  if (!token) return { error: "Splitwise api_key could not be resolved." };

  try {
    switch (action) {
      case "get_groups":    return getGroups(token, args);
      case "get_expenses":  return getExpenses(token, args);
      case "get_balances":  return getBalances(token, args);
      case "create_expense": return createExpense(token, args);
      case "get_friends":   return getFriends(token, args);
      default:
        return {
          error: `Unknown Splitwise action: "${action}". Valid actions: get_groups, get_expenses, get_balances, create_expense, get_friends.`,
        };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
