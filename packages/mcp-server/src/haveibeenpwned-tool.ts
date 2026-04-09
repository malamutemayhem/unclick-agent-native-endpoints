// Have I Been Pwned integration.
// Check accounts against data breaches and verify password exposure.
// Docs: https://haveibeenpwned.com/API/v3
// Auth: HIBP_API_KEY env var (hibp-api-key header). Password check uses k-anonymity (no auth needed).
// Base URL: https://haveibeenpwned.com/api/v3/
// Password API: https://api.pwnedpasswords.com/range/{prefix}

const HIBP_BASE = "https://haveibeenpwned.com/api/v3";
const HIBP_PASS_BASE = "https://api.pwnedpasswords.com";

function getApiKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.HIBP_API_KEY ?? "").trim();
  if (!key) throw new Error("api_key is required (or set HIBP_API_KEY env var).");
  return key;
}

async function hibpGet(apiKey: string, path: string, params?: Record<string, string>): Promise<unknown> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await fetch(`${HIBP_BASE}${path}${qs}`, {
    headers: {
      "hibp-api-key": apiKey,
      "User-Agent": "UnClickMCP/1.0 (https://unclick.io)",
    },
  });
  if (res.status === 401) throw new Error("Invalid HIBP API key.");
  if (res.status === 403) throw new Error("HIBP API key does not have permission for this endpoint.");
  if (res.status === 404) return null;
  if (res.status === 429) {
    const retryAfter = res.headers.get("retry-after");
    throw new Error(`HIBP rate limit exceeded${retryAfter ? `. Retry after ${retryAfter}s` : ""}.`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HIBP API HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  return res.json() as Promise<unknown>;
}

// ─── check_account_breaches ───────────────────────────────────────────────────

export async function checkAccountBreaches(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const account = String(args.account ?? args.email ?? "").trim().toLowerCase();
    if (!account) return { error: "account (email address) is required." };

    const params: Record<string, string> = {};
    if (args.domain) params["domain"] = String(args.domain);
    if (args.include_unverified) params["includeUnverified"] = "true";
    if (args.truncate === false) params["truncateResponse"] = "false";

    const data = await hibpGet(apiKey, `/breachedaccount/${encodeURIComponent(account)}`, params);

    if (data === null) {
      return {
        account,
        pwned: false,
        breach_count: 0,
        message: "No breaches found for this account.",
      };
    }

    const breaches = data as Array<Record<string, unknown>>;
    return {
      account,
      pwned: true,
      breach_count: breaches.length,
      breaches: breaches.map((b) => ({
        name: b["Name"],
        title: b["Title"],
        domain: b["Domain"],
        breach_date: b["BreachDate"],
        added_date: b["AddedDate"],
        pwn_count: b["PwnCount"],
        description: b["Description"],
        data_classes: b["DataClasses"],
        is_verified: b["IsVerified"],
        is_fabricated: b["IsFabricated"],
        is_sensitive: b["IsSensitive"],
        is_spam_list: b["IsSpamList"],
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── get_all_breaches ─────────────────────────────────────────────────────────

export async function getAllBreaches(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const params: Record<string, string> = {};
    if (args.domain) params["domain"] = String(args.domain);
    if (args.is_spam_list !== undefined) params["isSpamList"] = String(args.is_spam_list);

    const data = await hibpGet(apiKey, "/breaches", params) as Array<Record<string, unknown>>;

    const breaches = (data ?? []).map((b) => ({
      name: b["Name"],
      title: b["Title"],
      domain: b["Domain"],
      breach_date: b["BreachDate"],
      pwn_count: b["PwnCount"],
      data_classes: b["DataClasses"],
      is_verified: b["IsVerified"],
      is_sensitive: b["IsSensitive"],
    }));

    return {
      total_breaches: breaches.length,
      breaches,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── check_password ───────────────────────────────────────────────────────────
// Uses k-anonymity model: only sends first 5 chars of SHA-1 hash. No auth needed.

export async function checkPassword(args: Record<string, unknown>): Promise<unknown> {
  try {
    const password = String(args.password ?? "").trim();
    if (!password) return { error: "password is required." };

    // Compute SHA-1 hash using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();

    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const res = await fetch(`${HIBP_PASS_BASE}/range/${prefix}`, {
      headers: {
        "User-Agent": "UnClickMCP/1.0 (https://unclick.io)",
        "Add-Padding": "true",
      },
    });
    if (!res.ok) {
      throw new Error(`HIBP password API HTTP ${res.status}`);
    }

    const text = await res.text();
    const lines = text.trim().split("\n");

    let pwnCount = 0;
    for (const line of lines) {
      const [hashSuffix, count] = line.trim().split(":");
      if (hashSuffix?.toUpperCase() === suffix) {
        pwnCount = parseInt(count ?? "0", 10);
        break;
      }
    }

    return {
      pwned: pwnCount > 0,
      times_seen: pwnCount,
      message: pwnCount > 0
        ? `This password has been seen ${pwnCount.toLocaleString()} time(s) in data breaches. Do not use it.`
        : "This password has not been found in any known data breach.",
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
