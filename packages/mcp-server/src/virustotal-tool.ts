// VirusTotal malware/URL/file/IP/domain scanner.
// Docs: https://developers.virustotal.com/reference
// Auth: VIRUSTOTAL_API_KEY (x-apikey header)
// Base: https://www.virustotal.com/api/v3/

const VT_BASE = "https://www.virustotal.com/api/v3";

function getApiKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.VIRUSTOTAL_API_KEY ?? "").trim();
  if (!key) throw new Error("api_key is required (or set VIRUSTOTAL_API_KEY env var).");
  return key;
}

async function vtGet(
  apiKey: string,
  path: string,
  params?: Record<string, string>
): Promise<Record<string, unknown>> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await fetch(`${VT_BASE}${path}${qs}`, {
    headers: { "x-apikey": apiKey },
  });
  if (res.status === 401) throw new Error("Invalid VirusTotal API key.");
  if (res.status === 404) throw new Error(`VirusTotal: resource not found at ${path}.`);
  if (res.status === 429) throw new Error("VirusTotal rate limit exceeded. Wait and retry.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`VirusTotal HTTP ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

async function vtPost(
  apiKey: string,
  path: string,
  body: URLSearchParams
): Promise<Record<string, unknown>> {
  const res = await fetch(`${VT_BASE}${path}`, {
    method: "POST",
    headers: {
      "x-apikey": apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (res.status === 401) throw new Error("Invalid VirusTotal API key.");
  if (res.status === 429) throw new Error("VirusTotal rate limit exceeded. Wait and retry.");
  if (!res.ok) {
    const body2 = await res.text().catch(() => "");
    throw new Error(`VirusTotal HTTP ${res.status}: ${body2 || res.statusText}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

function extractStats(data: Record<string, unknown>): Record<string, unknown> {
  const attrs = (data.data as Record<string, unknown>)?.attributes as Record<string, unknown> | undefined;
  return {
    stats: attrs?.last_analysis_stats,
    reputation: attrs?.reputation,
    last_analysis_date: attrs?.last_analysis_date,
    tags: attrs?.tags,
  };
}

// scan_url_virustotal
export async function scanUrlVirustotal(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const url = String(args.url ?? "").trim();
    if (!url) return { error: "url is required." };
    const body = new URLSearchParams({ url });
    const data = await vtPost(apiKey, "/urls", body);
    const id = (data.data as Record<string, unknown>)?.id ?? null;
    return {
      submitted: true,
      analysis_id: id,
      note: "Use get_url_report with the base64url-encoded URL to fetch results.",
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// get_url_report
export async function getUrlReport(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const url = String(args.url ?? "").trim();
    if (!url) return { error: "url is required." };
    // Encode to base64url without padding
    const encoded = Buffer.from(url).toString("base64").replace(/=/g, "");
    const data = await vtGet(apiKey, `/urls/${encoded}`);
    const attrs = (data.data as Record<string, unknown>)?.attributes as Record<string, unknown> | undefined;
    return {
      url,
      final_url: attrs?.last_final_url,
      title: attrs?.title,
      stats: attrs?.last_analysis_stats,
      reputation: attrs?.reputation,
      last_analysis_date: attrs?.last_analysis_date,
      categories: attrs?.categories,
      tags: attrs?.tags,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// scan_ip_virustotal
export async function scanIpVirustotal(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const ip = String(args.ip ?? "").trim();
    if (!ip) return { error: "ip is required." };
    const data = await vtGet(apiKey, `/ip_addresses/${ip}`);
    const attrs = (data.data as Record<string, unknown>)?.attributes as Record<string, unknown> | undefined;
    return {
      ip,
      country: attrs?.country,
      asn: attrs?.asn,
      as_owner: attrs?.as_owner,
      stats: attrs?.last_analysis_stats,
      reputation: attrs?.reputation,
      last_analysis_date: attrs?.last_analysis_date,
      tags: attrs?.tags,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// scan_domain_virustotal
export async function scanDomainVirustotal(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const domain = String(args.domain ?? "").trim();
    if (!domain) return { error: "domain is required." };
    const data = await vtGet(apiKey, `/domains/${domain}`);
    const attrs = (data.data as Record<string, unknown>)?.attributes as Record<string, unknown> | undefined;
    return {
      domain,
      registrar: attrs?.registrar,
      creation_date: attrs?.creation_date,
      stats: attrs?.last_analysis_stats,
      reputation: attrs?.reputation,
      last_analysis_date: attrs?.last_analysis_date,
      categories: attrs?.categories,
      tags: attrs?.tags,
      whois: attrs?.whois ? String(attrs.whois).slice(0, 500) : null,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// Keep extractStats accessible to avoid unused warning
void extractStats;
