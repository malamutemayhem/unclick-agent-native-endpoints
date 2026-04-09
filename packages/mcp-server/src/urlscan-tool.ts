// URLScan.io website scanner.
// Docs: https://urlscan.io/docs/api/
// Auth: URLSCAN_API_KEY (API-Key header)
// Base: https://urlscan.io/api/v1/

const URLSCAN_BASE = "https://urlscan.io/api/v1";

function getApiKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.URLSCAN_API_KEY ?? "").trim();
  if (!key) throw new Error("api_key is required (or set URLSCAN_API_KEY env var).");
  return key;
}

async function urlscanPost(
  apiKey: string,
  path: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(`${URLSCAN_BASE}${path}`, {
    method: "POST",
    headers: {
      "API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Invalid URLScan API key.");
  if (res.status === 429) throw new Error("URLScan rate limit exceeded. Wait and retry.");
  if (!res.ok) {
    const b = await res.text().catch(() => "");
    throw new Error(`URLScan HTTP ${res.status}: ${b || res.statusText}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

async function urlscanGet(
  path: string,
  params?: Record<string, string>,
  apiKey?: string
): Promise<Record<string, unknown>> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const headers: Record<string, string> = {};
  if (apiKey) headers["API-Key"] = apiKey;
  const res = await fetch(`${URLSCAN_BASE}${path}${qs}`, { headers });
  if (res.status === 401) throw new Error("Invalid URLScan API key.");
  if (res.status === 404) throw new Error("URLScan: scan result not found. It may still be processing.");
  if (res.status === 429) throw new Error("URLScan rate limit exceeded.");
  if (!res.ok) {
    const b = await res.text().catch(() => "");
    throw new Error(`URLScan HTTP ${res.status}: ${b || res.statusText}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

// scan_url_urlscan
export async function scanUrlUrlscan(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const url = String(args.url ?? "").trim();
    if (!url) return { error: "url is required." };
    const body: Record<string, unknown> = { url };
    if (args.visibility) body.visibility = String(args.visibility);
    else body.visibility = "public";
    if (args.tags) body.tags = args.tags;
    const data = await urlscanPost(apiKey, "/scan/", body);
    return {
      uuid: data.uuid,
      api: data.api,
      result: data.result,
      visibility: data.visibility,
      message: data.message,
      note: "Scan is queued. Use get_scan_result with the uuid to retrieve results (may take 10-30 seconds).",
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// get_scan_result
export async function getScanResult(args: Record<string, unknown>): Promise<unknown> {
  try {
    const uuid = String(args.uuid ?? "").trim();
    if (!uuid) return { error: "uuid is required." };
    const apiKey = String(args.api_key ?? process.env.URLSCAN_API_KEY ?? "").trim();
    const data = await urlscanGet(`/result/${uuid}/`, undefined, apiKey || undefined);
    const page = data.page as Record<string, unknown> | undefined;
    const stats = data.stats as Record<string, unknown> | undefined;
    const meta = data.meta as Record<string, unknown> | undefined;
    return {
      uuid,
      url: page?.url,
      domain: page?.domain,
      ip: page?.ip,
      country: page?.country,
      server: page?.server,
      title: page?.title,
      status: page?.status,
      screenshot: `https://urlscan.io/screenshots/${uuid}.png`,
      malicious: (meta as Record<string, unknown> | undefined)?.processors
        ? undefined
        : data.verdicts
          ? (data.verdicts as Record<string, unknown>).overall
          : null,
      verdicts: data.verdicts,
      stats: {
        requests: stats?.requests,
        domains: stats?.domains,
        ips: stats?.uniqIPs,
        countries: stats?.uniqCountries,
      },
      lists: {
        ips: (data.lists as Record<string, unknown> | undefined)?.ips,
        domains: (data.lists as Record<string, unknown> | undefined)?.domains,
        urls: (data.lists as Record<string, unknown> | undefined)?.urls,
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// search_urlscan
export async function searchUrlscan(args: Record<string, unknown>): Promise<unknown> {
  try {
    const query = String(args.query ?? "").trim();
    if (!query) return { error: "query is required (e.g. 'domain:example.com' or 'page.ip:1.2.3.4')." };
    const params: Record<string, string> = { q: query };
    if (args.size) params.size = String(args.size);
    if (args.sort) params.sort = String(args.sort);
    const apiKey = String(args.api_key ?? process.env.URLSCAN_API_KEY ?? "").trim();
    const data = await urlscanGet("/search/", params, apiKey || undefined);
    const results = (data.results as Array<Record<string, unknown>>) ?? [];
    return {
      total: data.total,
      count: results.length,
      results: results.map((r) => ({
        uuid: (r.task as Record<string, unknown>)?.uuid,
        url: (r.page as Record<string, unknown>)?.url,
        domain: (r.page as Record<string, unknown>)?.domain,
        ip: (r.page as Record<string, unknown>)?.ip,
        country: (r.page as Record<string, unknown>)?.country,
        time: (r.task as Record<string, unknown>)?.time,
        screenshot: r.screenshot,
        malicious: (r.verdicts as Record<string, unknown> | undefined)?.overall,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
