// IP Australia integration.
// Search and retrieve trademarks, patents, and designs from the Australian register.
// Docs: https://api.ipaustralia.gov.au/
// Auth: IPAUSTRALIA_API_KEY env var (Authorization Bearer header).
// Base URL: https://api.ipaustralia.gov.au/

const IPAU_BASE = "https://api.ipaustralia.gov.au";

function getApiKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.IPAUSTRALIA_API_KEY ?? "").trim();
  if (!key) throw new Error("api_key is required (or set IPAUSTRALIA_API_KEY env var).");
  return key;
}

async function ipauGet(
  apiKey: string,
  path: string,
  params?: Record<string, string>
): Promise<unknown> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await fetch(`${IPAU_BASE}${path}${qs}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  if (res.status === 401 || res.status === 403) throw new Error("Invalid IP Australia API key.");
  if (res.status === 404) throw new Error("Resource not found.");
  if (res.status === 429) throw new Error("IP Australia API rate limit exceeded.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`IP Australia API HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  return res.json() as Promise<unknown>;
}

// ─── search_trademarks ────────────────────────────────────────────────────────

export async function searchTrademarks(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const keyword = String(args.keyword ?? args.query ?? "").trim();
    if (!keyword) return { error: "keyword is required." };

    const params: Record<string, string> = {
      q: keyword,
      size: String(Math.min(50, Number(args.limit ?? 10))),
      start: String(Number(args.offset ?? 0)),
    };
    if (args.status) params["status"] = String(args.status);
    if (args.class) params["class"] = String(args.class);
    if (args.type) params["type"] = String(args.type);

    const data = await ipauGet(apiKey, "/public/v1/trademarks/search", params) as Record<string, unknown>;

    const results = data["results"] as Array<Record<string, unknown>> | undefined ?? [];

    return {
      query: keyword,
      total: data["total"] ?? results.length,
      results: results.map((t) => ({
        number: t["applicationNumber"] ?? t["number"],
        status: t["status"],
        type: t["type"],
        mark: t["mark"] ?? t["wordMark"],
        owner: t["owners"],
        classes: t["classes"],
        filing_date: t["filingDate"],
        registration_date: t["registrationDate"],
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── get_trademark_details ────────────────────────────────────────────────────

export async function getTrademarkDetails(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const number = String(args.number ?? args.trademark_number ?? "").trim();
    if (!number) return { error: "number is required (trademark application number)." };

    const data = await ipauGet(apiKey, `/public/v1/trademarks/${encodeURIComponent(number)}`) as Record<string, unknown>;

    return {
      number: data["applicationNumber"] ?? data["number"],
      status: data["status"],
      type: data["type"],
      mark: data["mark"] ?? data["wordMark"],
      description: data["goodsAndServices"],
      owners: data["owners"],
      classes: data["classes"],
      filing_date: data["filingDate"],
      registration_date: data["registrationDate"],
      expiry_date: data["expiryDate"],
      attorney: data["attorney"],
      image_url: data["imageUrl"],
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── search_patents ───────────────────────────────────────────────────────────

export async function searchPatents(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const keyword = String(args.keyword ?? args.query ?? "").trim();
    if (!keyword) return { error: "keyword is required." };

    const params: Record<string, string> = {
      q: keyword,
      size: String(Math.min(50, Number(args.limit ?? 10))),
      start: String(Number(args.offset ?? 0)),
    };
    if (args.status) params["status"] = String(args.status);
    if (args.type) params["type"] = String(args.type);

    const data = await ipauGet(apiKey, "/public/v1/patents/search", params) as Record<string, unknown>;

    const results = data["results"] as Array<Record<string, unknown>> | undefined ?? [];

    return {
      query: keyword,
      total: data["total"] ?? results.length,
      results: results.map((p) => ({
        number: p["applicationNumber"] ?? p["number"],
        status: p["status"],
        type: p["type"],
        title: p["title"],
        applicants: p["applicants"],
        inventors: p["inventors"],
        filing_date: p["filingDate"],
        publication_date: p["publicationDate"],
        grant_date: p["grantDate"],
        ipc_classes: p["ipcClasses"],
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
