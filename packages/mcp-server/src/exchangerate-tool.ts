// ExchangeRate-API currency conversion and rates.
// Docs: https://www.exchangerate-api.com/docs/overview
// Auth: EXCHANGERATE_API_KEY (embedded in URL path)
// Base: https://v6.exchangerate-api.com/v6/{api_key}
// Free tier (no key): https://open.er-api.com/v6 (latest rates only)

const EXCHANGERATE_BASE = "https://v6.exchangerate-api.com/v6";
const EXCHANGERATE_FREE_BASE = "https://open.er-api.com/v6";

function getApiKey(args: Record<string, unknown>): string | null {
  return String(args.api_key ?? process.env.EXCHANGERATE_API_KEY ?? "").trim() || null;
}

async function erGet(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(path, {
    headers: { Accept: "application/json" },
  });
  if (res.status === 403) throw new Error("Invalid ExchangeRate-API key.");
  if (res.status === 404) throw new Error("ExchangeRate-API: resource not found. Check your base currency code.");
  if (res.status === 429) throw new Error("ExchangeRate-API rate limit exceeded. Upgrade your plan or wait.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ExchangeRate-API HTTP ${res.status}: ${body || res.statusText}`);
  }
  const json = await res.json() as Record<string, unknown>;
  if (json.result === "error") {
    throw new Error(`ExchangeRate-API error: ${json["error-type"] ?? "unknown error"}`);
  }
  return json;
}

// exchangerate_latest
export async function exchangerateLatest(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const base = String(args.base ?? "USD").toUpperCase();
    const url = apiKey
      ? `${EXCHANGERATE_BASE}/${apiKey}/latest/${base}`
      : `${EXCHANGERATE_FREE_BASE}/latest/${base}`;

    const json = await erGet(url);
    return {
      base_code: json.base_code,
      time_last_update_utc: json.time_last_update_utc,
      time_next_update_utc: json.time_next_update_utc,
      rates: json.conversion_rates,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// exchangerate_convert
export async function exchangerateConvert(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const from = String(args.from ?? "").toUpperCase().trim();
    if (!from) return { error: "from is required (e.g. USD)." };
    const to = String(args.to ?? "").toUpperCase().trim();
    if (!to) return { error: "to is required (e.g. EUR)." };
    const amount = Number(args.amount ?? 1);

    if (apiKey) {
      const url = `${EXCHANGERATE_BASE}/${apiKey}/pair/${from}/${to}/${amount}`;
      const json = await erGet(url);
      return {
        base_code: json.base_code,
        target_code: json.target_code,
        conversion_rate: json.conversion_rate,
        conversion_result: json.conversion_result,
        time_last_update_utc: json.time_last_update_utc,
      };
    } else {
      // Free tier: fetch latest from base and compute
      const url = `${EXCHANGERATE_FREE_BASE}/latest/${from}`;
      const json = await erGet(url);
      const rates = json.conversion_rates as Record<string, number> | undefined;
      const rate = rates?.[to];
      if (rate === undefined) return { error: `Currency code "${to}" not found.` };
      return {
        base_code: from,
        target_code: to,
        conversion_rate: rate,
        conversion_result: amount * rate,
        input_amount: amount,
        time_last_update_utc: json.time_last_update_utc,
      };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// exchangerate_historical
export async function exchangerateHistorical(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    if (!apiKey) return { error: "api_key is required for historical rates (not available on free tier)." };
    const base = String(args.base ?? "USD").toUpperCase();
    const year = String(args.year ?? "").trim();
    const month = String(args.month ?? "").trim();
    const day = String(args.day ?? "").trim();
    if (!year || !month || !day) return { error: "year, month, and day are required." };

    const url = `${EXCHANGERATE_BASE}/${apiKey}/history/${base}/${year}/${month}/${day}`;
    const json = await erGet(url);
    return {
      base_code: json.base_code,
      year: json.year,
      month: json.month,
      day: json.day,
      rates: json.conversion_rates,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// exchangerate_codes
export async function exchangerateCodes(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    if (!apiKey) return { error: "api_key is required to list supported currencies." };

    const url = `${EXCHANGERATE_BASE}/${apiKey}/codes`;
    const json = await erGet(url);
    const supported = (json.supported_codes ?? []) as Array<[string, string]>;
    return {
      count: supported.length,
      currencies: supported.map(([code, name]) => ({ code, name })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
