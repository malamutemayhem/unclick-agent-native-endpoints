// AbuseIPDB IP reputation database.
// Docs: https://docs.abuseipdb.com/
// Auth: ABUSEIPDB_API_KEY (Key header)
// Base: https://api.abuseipdb.com/api/v2/

const ABUSEIPDB_BASE = "https://api.abuseipdb.com/api/v2";

function getApiKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.ABUSEIPDB_API_KEY ?? "").trim();
  if (!key) throw new Error("api_key is required (or set ABUSEIPDB_API_KEY env var).");
  return key;
}

async function abuseGet(
  apiKey: string,
  path: string,
  params: Record<string, string>
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${ABUSEIPDB_BASE}${path}?${qs}`, {
    headers: {
      Key: apiKey,
      Accept: "application/json",
    },
  });
  if (res.status === 401) throw new Error("Invalid AbuseIPDB API key.");
  if (res.status === 429) throw new Error("AbuseIPDB rate limit exceeded. Upgrade your plan or wait.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AbuseIPDB HTTP ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

async function abusePost(
  apiKey: string,
  path: string,
  params: Record<string, string>
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams(params);
  const res = await fetch(`${ABUSEIPDB_BASE}${path}`, {
    method: "POST",
    headers: {
      Key: apiKey,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (res.status === 401) throw new Error("Invalid AbuseIPDB API key.");
  if (res.status === 429) throw new Error("AbuseIPDB rate limit exceeded.");
  if (!res.ok) {
    const body2 = await res.text().catch(() => "");
    throw new Error(`AbuseIPDB HTTP ${res.status}: ${body2 || res.statusText}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

// check_ip_abuse
export async function checkIpAbuse(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const ip = String(args.ip ?? "").trim();
    if (!ip) return { error: "ip is required." };
    const params: Record<string, string> = { ipAddress: ip };
    if (args.max_age_in_days) params.maxAgeInDays = String(args.max_age_in_days);
    if (args.verbose) params.verbose = "true";
    const json = await abuseGet(apiKey, "/check", params);
    const d = json.data as Record<string, unknown> | undefined;
    return {
      ip_address: d?.ipAddress,
      is_public: d?.isPublic,
      abuse_confidence_score: d?.abuseConfidenceScore,
      country_code: d?.countryCode,
      usage_type: d?.usageType,
      isp: d?.isp,
      domain: d?.domain,
      is_tor: d?.isTor,
      total_reports: d?.totalReports,
      num_distinct_users: d?.numDistinctUsers,
      last_reported_at: d?.lastReportedAt,
      reports: d?.reports ?? [],
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// report_ip_abuse
export async function reportIpAbuse(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const ip = String(args.ip ?? "").trim();
    const categories = String(args.categories ?? "").trim();
    if (!ip) return { error: "ip is required." };
    if (!categories) return { error: "categories is required (comma-separated category IDs, e.g. 18,22)." };
    const params: Record<string, string> = { ip, categories };
    if (args.comment) params.comment = String(args.comment);
    const json = await abusePost(apiKey, "/report", params);
    const d = json.data as Record<string, unknown> | undefined;
    return {
      ip_address: d?.ipAddress,
      abuse_confidence_score: d?.abuseConfidenceScore,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// get_blacklist_abuseipdb
export async function getBlacklistAbuseipdb(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const params: Record<string, string> = {};
    if (args.confidence_minimum) params.confidenceMinimum = String(args.confidence_minimum);
    if (args.limit) params.limit = String(args.limit);
    const json = await abuseGet(apiKey, "/blacklist", params);
    const data = json.data as Array<Record<string, unknown>> | undefined;
    return {
      count: data?.length ?? 0,
      generated_at: json.meta ? (json.meta as Record<string, unknown>).generatedAt : null,
      blacklist: data ?? [],
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
