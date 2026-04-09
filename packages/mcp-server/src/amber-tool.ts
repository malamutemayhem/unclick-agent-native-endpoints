// Amber Electric AU integration.
// Real-time electricity spot prices and renewables percentage.
// Docs: https://app.amber.com.au/developers/
// Auth: Bearer token via AMBER_API_KEY env var.
// Base URL: https://api.amber.com.au/v1/

const AMBER_BASE = "https://api.amber.com.au/v1";

function getApiKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.AMBER_API_KEY ?? "").trim();
  if (!key) throw new Error("api_key is required (or set AMBER_API_KEY env var).");
  return key;
}

async function amberGet(apiKey: string, path: string, params?: Record<string, string>): Promise<unknown> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await fetch(`${AMBER_BASE}${path}${qs}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  if (res.status === 401) throw new Error("Invalid Amber API key.");
  if (res.status === 404) throw new Error("Resource not found.");
  if (res.status === 429) throw new Error("Amber API rate limit exceeded.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Amber API HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  return res.json() as Promise<unknown>;
}

// ─── get_amber_sites ──────────────────────────────────────────────────────────

export async function getAmberSites(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const sites = await amberGet(apiKey, "/sites") as Array<Record<string, unknown>>;
    return {
      count: sites.length,
      sites: sites.map((s) => ({
        id: s["id"],
        nmi: s["nmi"],
        status: s["status"],
        network: s["network"],
        loss_factor: s["lossFactor"],
        channels: s["channels"],
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── get_amber_current_price ─────────────────────────────────────────────────

export async function getAmberCurrentPrice(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const siteId = String(args.site_id ?? "").trim();
    if (!siteId) return { error: "site_id is required. Call get_amber_sites to find yours." };

    const prices = await amberGet(apiKey, `/sites/${siteId}/prices/current`) as Array<Record<string, unknown>>;

    return {
      site_id: siteId,
      prices: prices.map((p) => ({
        type: p["channelType"],
        start_time: p["startTime"],
        end_time: p["endTime"],
        duration_minutes: p["duration"],
        spot_per_kwh: p["spotPerKwh"],
        per_kwh: p["perKwh"],
        renewables_pct: p["renewables"],
        spike_status: p["spikeStatus"],
        descriptor: p["descriptor"],
        estimate: p["estimate"] ?? false,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── get_amber_forecast ───────────────────────────────────────────────────────

export async function getAmberForecast(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const siteId = String(args.site_id ?? "").trim();
    if (!siteId) return { error: "site_id is required. Call get_amber_sites to find yours." };

    const next = Math.min(48, Math.max(1, Number(args.next ?? 12)));
    const prices = await amberGet(apiKey, `/sites/${siteId}/prices`, {
      next: String(next),
      resolution: "30",
    }) as Array<Record<string, unknown>>;

    return {
      site_id: siteId,
      intervals_requested: next,
      forecast: prices.map((p) => ({
        type: p["channelType"],
        start_time: p["startTime"],
        end_time: p["endTime"],
        spot_per_kwh: p["spotPerKwh"],
        per_kwh: p["perKwh"],
        renewables_pct: p["renewables"],
        spike_status: p["spikeStatus"],
        descriptor: p["descriptor"],
        estimate: p["estimate"] ?? false,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
