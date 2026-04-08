// Australian Business Registry (ABN Lookup) integration.
// Uses the free ABR JSONP API — no authentication required.
// Base URL: https://abr.business.gov.au/json/

const ABN_BASE = "https://abr.business.gov.au/json";

// ─── JSONP helper ─────────────────────────────────────────────────────────────

async function fetchJsonp(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": "UnClickMCP/1.0 (https://unclick.io)" },
  });
  if (!res.ok) {
    throw new Error(`ABR API HTTP ${res.status}`);
  }
  const text = await res.text();
  // Strip JSONP wrapper: callback({...}) or callback([...])
  const match = text.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(([\s\S]*)\)\s*;?\s*$/);
  if (!match) {
    throw new Error("Unexpected ABR API response format (not JSONP).");
  }
  return JSON.parse(match[1]) as unknown;
}

// ─── abn_lookup ───────────────────────────────────────────────────────────────
// GET /AbnDetails.aspx?abn={abn}&callback=callback
// Returns entity name, type, ABN status, GST status, main business location.

export async function abnLookup(args: Record<string, unknown>): Promise<unknown> {
  const abn = String(args.abn ?? "").trim().replace(/\s/g, "");
  if (!abn) return { error: "abn is required (11-digit Australian Business Number)." };

  const url = `${ABN_BASE}/AbnDetails.aspx?abn=${encodeURIComponent(abn)}&callback=callback`;
  const data = await fetchJsonp(url) as Record<string, unknown>;

  if (data["Message"]) {
    const msg = String(data["Message"]);
    if (msg && msg.toLowerCase() !== "no record found") {
      return { error: msg };
    }
  }

  if (!data["Abn"]) {
    return { error: "No business found for that ABN.", abn };
  }

  return {
    abn: data["Abn"],
    entity_name: data["EntityName"] ?? null,
    entity_type_code: data["EntityTypeCode"] ?? null,
    entity_type: data["EntityTypeName"] ?? null,
    abn_status: data["AbnStatus"] ?? null,
    abn_status_effective_from: data["AbnStatusEffectiveFrom"] ?? null,
    gst_registered_from: data["Gst"] ?? null,
    gst_status: data["Gst"] ? "Registered" : "Not registered",
    acn: data["Acn"] || null,
    address_state: data["AddressState"] ?? null,
    address_postcode: data["AddressPostcode"] ?? null,
    business_names: Array.isArray(data["BusinessName"])
      ? (data["BusinessName"] as Array<Record<string, unknown>>).map(
          (b) => ({ name: b["OrganisationName"], effective_from: b["EffectiveFrom"] })
        )
      : [],
  };
}

// ─── abn_search ───────────────────────────────────────────────────────────────
// GET /Search.aspx?name={name}&callback=callback
// Returns list of matching businesses with ABNs.

export async function abnSearch(args: Record<string, unknown>): Promise<unknown> {
  const name = String(args.name ?? "").trim();
  if (!name) return { error: "name is required." };

  const params = new URLSearchParams({ name, callback: "callback" });
  if (args.postcode) params.set("postcode", String(args.postcode));

  const url = `${ABN_BASE}/Search.aspx?${params}`;
  const data = await fetchJsonp(url) as Record<string, unknown>;

  if (data["Message"]) {
    const msg = String(data["Message"]);
    if (msg) return { error: msg };
  }

  const names = Array.isArray(data["Names"]) ? data["Names"] as Array<Record<string, unknown>> : [];

  return {
    query: name,
    count: names.length,
    results: names.map((n) => ({
      abn: n["Abn"],
      name: n["Name"],
      name_type: n["NameType"],
      abn_status: n["AbnStatus"],
      is_current: n["IsCurrent"],
      state: n["State"] ?? null,
      postcode: n["Postcode"] ?? null,
      score: n["Score"] ?? null,
    })),
  };
}
