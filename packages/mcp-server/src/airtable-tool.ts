// ── Airtable REST API tool ─────────────────────────────────────────────────
// Wraps the Airtable REST API via fetch.
// Auth: personal access token (PAT) passed as access_token.
// No external dependencies.

const AIRTABLE_META_API = "https://api.airtable.com/v0/meta";
const AIRTABLE_DATA_API = "https://api.airtable.com/v0";

// ── Fetch helper ───────────────────────────────────────────────────────────────

async function airtableFetch(
  token: string,
  method: "GET" | "POST" | "PATCH",
  url: string,
  body?: unknown
): Promise<unknown> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "User-Agent":  "UnClick-MCP/1.0",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    return { error: `Network error reaching Airtable API: ${err instanceof Error ? err.message : String(err)}` };
  }

  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (response.status === 401) return { error: "Airtable token is invalid or expired. Check your access_token.", status: 401 };
  if (response.status === 403) return { error: "Insufficient permissions for this Airtable resource.", status: 403 };
  if (response.status === 404) return { error: "Base, table, or record not found.", status: 404 };
  if (response.status === 422) return { error: `Airtable validation error: ${(data as Record<string, unknown>)?.error ?? text}`, status: 422 };
  if (response.status === 429) return { error: "Airtable rate limit exceeded. Please wait and retry.", status: 429 };

  if (!response.ok) {
    const detail = (data as Record<string, unknown>)?.error ?? text;
    return { error: `Airtable API error ${response.status}: ${detail}`, status: response.status };
  }

  return data;
}

// ── Action implementations ─────────────────────────────────────────────────────

async function listBases(token: string): Promise<unknown> {
  return airtableFetch(token, "GET", `${AIRTABLE_META_API}/bases`);
}

async function listRecords(token: string, args: Record<string, unknown>): Promise<unknown> {
  const baseId    = String(args.base_id    ?? "").trim();
  const tableName = String(args.table_name ?? "").trim();
  if (!baseId)    return { error: "base_id is required." };
  if (!tableName) return { error: "table_name is required." };

  const url = new URL(`${AIRTABLE_DATA_API}/${encodeURIComponent(baseId)}/${encodeURIComponent(tableName)}`);
  if (args.max_records) url.searchParams.set("maxRecords", String(args.max_records));
  if (args.page_size)   url.searchParams.set("pageSize",   String(args.page_size));
  if (args.offset)      url.searchParams.set("offset",     String(args.offset));
  if (args.view)        url.searchParams.set("view",        String(args.view));
  if (args.sort)        url.searchParams.set("sort",        JSON.stringify(args.sort));
  if (args.fields)      url.searchParams.set("fields",      JSON.stringify(args.fields));

  return airtableFetch(token, "GET", url.toString());
}

async function getRecord(token: string, args: Record<string, unknown>): Promise<unknown> {
  const baseId    = String(args.base_id    ?? "").trim();
  const tableName = String(args.table_name ?? "").trim();
  const recordId  = String(args.record_id  ?? "").trim();
  if (!baseId)    return { error: "base_id is required." };
  if (!tableName) return { error: "table_name is required." };
  if (!recordId)  return { error: "record_id is required." };

  return airtableFetch(
    token, "GET",
    `${AIRTABLE_DATA_API}/${encodeURIComponent(baseId)}/${encodeURIComponent(tableName)}/${encodeURIComponent(recordId)}`
  );
}

async function createRecord(token: string, args: Record<string, unknown>): Promise<unknown> {
  const baseId    = String(args.base_id    ?? "").trim();
  const tableName = String(args.table_name ?? "").trim();
  if (!baseId)    return { error: "base_id is required." };
  if (!tableName) return { error: "table_name is required." };
  if (!args.fields || typeof args.fields !== "object") return { error: "fields (object) is required." };

  return airtableFetch(
    token, "POST",
    `${AIRTABLE_DATA_API}/${encodeURIComponent(baseId)}/${encodeURIComponent(tableName)}`,
    { records: [{ fields: args.fields }] }
  );
}

async function updateRecord(token: string, args: Record<string, unknown>): Promise<unknown> {
  const baseId    = String(args.base_id    ?? "").trim();
  const tableName = String(args.table_name ?? "").trim();
  const recordId  = String(args.record_id  ?? "").trim();
  if (!baseId)    return { error: "base_id is required." };
  if (!tableName) return { error: "table_name is required." };
  if (!recordId)  return { error: "record_id is required." };
  if (!args.fields || typeof args.fields !== "object") return { error: "fields (object) is required." };

  return airtableFetch(
    token, "PATCH",
    `${AIRTABLE_DATA_API}/${encodeURIComponent(baseId)}/${encodeURIComponent(tableName)}`,
    { records: [{ id: recordId, fields: args.fields }] }
  );
}

async function searchRecords(token: string, args: Record<string, unknown>): Promise<unknown> {
  const baseId    = String(args.base_id    ?? "").trim();
  const tableName = String(args.table_name ?? "").trim();
  const formula   = String(args.formula    ?? "").trim();
  if (!baseId)    return { error: "base_id is required." };
  if (!tableName) return { error: "table_name is required." };
  if (!formula)   return { error: "formula is required (Airtable formula filter string)." };

  const url = new URL(`${AIRTABLE_DATA_API}/${encodeURIComponent(baseId)}/${encodeURIComponent(tableName)}`);
  url.searchParams.set("filterByFormula", formula);
  if (args.max_records) url.searchParams.set("maxRecords", String(args.max_records));
  if (args.fields)      url.searchParams.set("fields",     JSON.stringify(args.fields));

  return airtableFetch(token, "GET", url.toString());
}

// ── Public dispatcher ──────────────────────────────────────────────────────────

export async function airtableAction(
  action: string,
  args:   Record<string, unknown>
): Promise<unknown> {
  const token = String(args.access_token ?? "").trim();
  if (!token) return { error: "access_token is required." };

  try {
    switch (action) {
      case "list_bases":     return listBases(token);
      case "list_records":   return listRecords(token, args);
      case "get_record":     return getRecord(token, args);
      case "create_record":  return createRecord(token, args);
      case "update_record":  return updateRecord(token, args);
      case "search_records": return searchRecords(token, args);
      default:
        return {
          error: `Unknown Airtable action: "${action}". Valid actions: list_bases, list_records, get_record, create_record, update_record, search_records.`,
        };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
