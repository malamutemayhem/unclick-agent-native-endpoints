// ── ABN Lookup - Australian Business Register ──────────────────────────────────
// Free open JSON (JSONP) API, no auth required for basic entity lookups.
// Docs: https://abr.business.gov.au/json/
//
// Optional: register a free GUID at https://abr.business.gov.au/Tools/WebServicesAgreement
// to unlock state/postcode fields. Pass it as the `guid` argument.

const ABN_BASE = "https://abr.business.gov.au/json";

async function abnFetch(
  endpoint: string,
  params: Record<string, string>
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({ ...params, callback: "callback" });
  const res = await fetch(`${ABN_BASE}/${endpoint}?${qs}`);
  if (!res.ok) throw new Error(`ABN API HTTP ${res.status}: ${res.statusText}`);
  const text = await res.text();
  // Strip JSONP wrapper: callback({...})
  const match = text.match(/^callback\(([\s\S]*)\)\s*;?\s*$/);
  if (!match) throw new Error(`Unexpected ABN API response format`);
  return JSON.parse(match[1]) as Record<string, unknown>;
}

export async function abnLookup(args: Record<string, unknown>): Promise<unknown> {
  const abn = String(args.abn ?? "").replace(/\s/g, "");
  if (!abn) return { error: "abn is required." };
  const params: Record<string, string> = { abn };
  if (args.guid) params.guid = String(args.guid);
  try {
    const data = await abnFetch("AbnDetails.aspx", params);
    if (data.Message) return { error: String(data.Message) };
    return {
      abn:          data.Abn,
      abn_status:   data.AbnStatus,
      abn_status_from_date: data.AbnStatusEffectiveFrom,
      entity_name:  data.EntityName,
      entity_type:  data.EntityTypeName ?? data.EntityTypeCode,
      gst_registered: data.Gst === "Y" || data.Gst === "y",
      gst_from_date: data.GstStatusEffectiveFrom,
      postcode:     data.AddressPostcode,
      state:        data.AddressState,
      last_updated: data.RecordLastUpdatedDate,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function abnSearch(args: Record<string, unknown>): Promise<unknown> {
  const name = String(args.name ?? "").trim();
  if (!name) return { error: "name is required." };
  const maxResults = Math.min(Number(args.max_results ?? 10), 20);
  const params: Record<string, string> = { name, maxResults: String(maxResults) };
  if (args.guid) params.guid = String(args.guid);
  try {
    const data = await abnFetch("MatchingNames.aspx", params);
    if (data.Message) return { error: String(data.Message) };
    const names = data.Names as Array<Record<string, unknown>> | undefined;
    if (!names || names.length === 0) return { results: [], count: 0 };
    return {
      count: names.length,
      results: names.map((n) => ({
        name:         n.Name,
        abn:          n.Abn,
        state:        n.State,
        postcode:     n.Postcode,
        status:       n.Status,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
