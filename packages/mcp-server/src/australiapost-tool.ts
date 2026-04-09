// Australia Post integration.
// Parcel tracking, postcode lookup, and delivery time estimates.
// Docs: https://developers.auspost.com.au/apis
// Auth: AUSPOST_API_KEY env var (AUTH-KEY header).
// Base URL: https://digitalapi.auspost.com.au/

const AUSPOST_BASE = "https://digitalapi.auspost.com.au";

function getApiKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.AUSPOST_API_KEY ?? "").trim();
  if (!key) throw new Error("api_key is required (or set AUSPOST_API_KEY env var).");
  return key;
}

async function auspostGet(apiKey: string, path: string, params?: Record<string, string>): Promise<unknown> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await fetch(`${AUSPOST_BASE}${path}${qs}`, {
    headers: {
      "AUTH-KEY": apiKey,
      Accept: "application/json",
    },
  });
  if (res.status === 401 || res.status === 403) throw new Error("Invalid Australia Post API key.");
  if (res.status === 404) throw new Error("Resource not found.");
  if (res.status === 429) throw new Error("Australia Post API rate limit exceeded.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Australia Post API HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  return res.json() as Promise<unknown>;
}

// ─── track_auspost_parcel ─────────────────────────────────────────────────────

export async function trackAuspostParcel(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const trackingId = String(args.tracking_id ?? "").trim();
    if (!trackingId) return { error: "tracking_id is required." };

    const data = await auspostGet(apiKey, `/shipping/v1/track`, { "tracking_ids": trackingId }) as Record<string, unknown>;
    const tracking = data["tracking_results"] as Array<Record<string, unknown>> | undefined;

    if (!tracking?.length) return { error: "No tracking data found for that ID.", tracking_id: trackingId };

    return {
      tracking_id: trackingId,
      results: tracking.map((r) => ({
        tracking_id: r["tracking_id"],
        status: r["status"],
        consignment: r["consignment"],
        events: (r["events"] as Array<Record<string, unknown>> | undefined)?.map((e) => ({
          date: e["date"],
          time: e["time"],
          description: e["description"],
          location: e["location"],
        })),
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── get_auspost_postcode ─────────────────────────────────────────────────────

export async function getAuspostPostcode(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const query = String(args.query ?? args.suburb ?? args.postcode ?? "").trim();
    if (!query) return { error: "query is required (suburb name or postcode)." };

    const data = await auspostGet(apiKey, "/postcode/search.json", { q: query }) as Record<string, unknown>;
    const localities = data["localities"] as Record<string, unknown> | undefined;
    const list = Array.isArray(localities?.["locality"])
      ? localities?.["locality"] as Array<Record<string, unknown>>
      : localities?.["locality"]
      ? [localities?.["locality"] as Record<string, unknown>]
      : [];

    return {
      query,
      count: list.length,
      localities: list.map((l) => ({
        postcode: l["postcode"],
        suburb: l["location"],
        state: l["state"],
        latitude: l["latitude"],
        longitude: l["longitude"],
        category: l["category"],
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── get_auspost_delivery_times ───────────────────────────────────────────────

export async function getAuspostDeliveryTimes(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const fromPostcode = String(args.from_postcode ?? "").trim();
    const toPostcode = String(args.to_postcode ?? "").trim();
    if (!fromPostcode) return { error: "from_postcode is required." };
    if (!toPostcode) return { error: "to_postcode is required." };

    const data = await auspostGet(apiKey, "/postage/letter/domestic/service.json", {
      "from_postcode": fromPostcode,
      "to_postcode": toPostcode,
    }) as Record<string, unknown>;

    const services = data["services"] as Record<string, unknown> | undefined;
    const serviceList = Array.isArray(services?.["service"])
      ? services?.["service"] as Array<Record<string, unknown>>
      : services?.["service"]
      ? [services?.["service"] as Record<string, unknown>]
      : [];

    return {
      from_postcode: fromPostcode,
      to_postcode: toPostcode,
      services: serviceList.map((s) => ({
        code: s["code"],
        name: s["name"],
        max_weight_kg: s["max_weight"],
        price: s["price"],
        delivery_time: s["delivery_time"],
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
