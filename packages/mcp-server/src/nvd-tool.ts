// NIST National Vulnerability Database (NVD) integration.
// CVE data, CVSS scores, and vulnerability details. Free API.
// NVD_API_KEY is optional but recommended for higher rate limits (50 req/30s vs 5 req/30s).
// Docs: https://nvd.nist.gov/developers/vulnerabilities
// Base URL: https://services.nvd.nist.gov/rest/json/cves/2.0

const NVD_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0";

async function nvdGet(params: Record<string, string>, apiKey?: string): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams(params);
  const headers: Record<string, string> = {
    "User-Agent": "UnClickMCP/1.0 (https://unclick.io)",
  };
  if (apiKey) headers["apiKey"] = apiKey;

  const res = await fetch(`${NVD_BASE}?${qs}`, { headers });
  if (res.status === 403) throw new Error("Invalid NVD API key.");
  if (res.status === 404) throw new Error("CVE not found.");
  if (res.status === 429) throw new Error("NVD API rate limit exceeded. Consider providing an NVD_API_KEY for higher limits.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`NVD API HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

function getOptionalKey(args: Record<string, unknown>): string | undefined {
  const key = String(args.api_key ?? process.env.NVD_API_KEY ?? "").trim();
  return key || undefined;
}

function formatCve(cve: Record<string, unknown>): Record<string, unknown> {
  const cveData = cve["cve"] as Record<string, unknown> | undefined ?? cve;
  const id = cveData["id"] ?? cveData["CVE_data_meta"];
  const metrics = cveData["metrics"] as Record<string, unknown> | undefined;
  const cvssV31 = (metrics?.["cvssMetricV31"] as Array<Record<string, unknown>>)?.[0];
  const cvssV30 = (metrics?.["cvssMetricV30"] as Array<Record<string, unknown>>)?.[0];
  const cvssV2 = (metrics?.["cvssMetricV2"] as Array<Record<string, unknown>>)?.[0];
  const cvss = cvssV31 ?? cvssV30 ?? cvssV2;
  const cvssData = cvss?.["cvssData"] as Record<string, unknown> | undefined;

  const descriptions = cveData["descriptions"] as Array<Record<string, unknown>> | undefined;
  const enDesc = descriptions?.find((d) => d["lang"] === "en");

  const weaknesses = cveData["weaknesses"] as Array<Record<string, unknown>> | undefined;
  const cwes = weaknesses?.flatMap((w) =>
    (w["description"] as Array<Record<string, unknown>>)?.map((d) => d["value"])
  );

  const refs = cveData["references"] as Array<Record<string, unknown>> | undefined;

  return {
    id,
    status: cveData["vulnStatus"],
    description: enDesc?.["value"] ?? null,
    published: cveData["published"],
    last_modified: cveData["lastModified"],
    cvss_version: cvssData?.["version"],
    cvss_score: cvssData?.["baseScore"],
    cvss_severity: cvss?.["baseSeverity"] ?? cvssData?.["baseSeverity"],
    cvss_vector: cvssData?.["vectorString"],
    cwe: cwes?.filter(Boolean) ?? [],
    references: refs?.slice(0, 5).map((r) => ({ url: r["url"], tags: r["tags"] })) ?? [],
  };
}

// ─── get_cve_detail ───────────────────────────────────────────────────────────

export async function getCveDetail(args: Record<string, unknown>): Promise<unknown> {
  try {
    const cveId = String(args.cve_id ?? "").trim().toUpperCase();
    if (!cveId) return { error: "cve_id is required (e.g. CVE-2024-1234)." };
    if (!/^CVE-\d{4}-\d{4,}$/.test(cveId)) return { error: "cve_id must be in format CVE-YYYY-NNNNN." };

    const apiKey = getOptionalKey(args);
    const data = await nvdGet({ cveId }, apiKey);
    const vulns = data["vulnerabilities"] as Array<Record<string, unknown>> | undefined;

    if (!vulns?.length) return { error: `CVE "${cveId}" not found.`, cve_id: cveId };

    return formatCve(vulns[0]);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── search_cve ───────────────────────────────────────────────────────────────

export async function searchCve(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getOptionalKey(args);
    const params: Record<string, string> = {
      resultsPerPage: String(Math.min(50, Number(args.limit ?? 10))),
      startIndex: String(Number(args.offset ?? 0)),
    };

    if (args.keyword) params["keywordSearch"] = String(args.keyword);
    if (args.severity) {
      const sev = String(args.severity).toUpperCase();
      const valid = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"];
      if (!valid.includes(sev)) return { error: `severity must be one of: ${valid.join(", ")}` };
      params["cvssV3Severity"] = sev;
    }
    if (args.date_from) params["pubStartDate"] = String(args.date_from);
    if (args.date_to) params["pubEndDate"] = String(args.date_to);
    if (args.cpe_name) params["cpeName"] = String(args.cpe_name);
    if (args.has_cert_alerts) params["hasCertAlerts"] = "";
    if (args.is_kev) params["isVulnerable"] = "";

    const data = await nvdGet(params, apiKey);
    const vulns = data["vulnerabilities"] as Array<Record<string, unknown>> | undefined ?? [];

    return {
      total_results: data["totalResults"],
      results_per_page: data["resultsPerPage"],
      start_index: data["startIndex"],
      vulnerabilities: vulns.map(formatCve),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── get_recent_cves ──────────────────────────────────────────────────────────

export async function getRecentCves(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getOptionalKey(args);
    const limit = Math.min(20, Number(args.limit ?? 10));
    const daysBack = Math.min(120, Number(args.days ?? 7));

    const pubEndDate = new Date().toISOString().replace("T", " ").slice(0, 19) + ".000";
    const pubStartDate = new Date(Date.now() - daysBack * 86400 * 1000)
      .toISOString()
      .replace("T", " ")
      .slice(0, 19) + ".000";

    const params: Record<string, string> = {
      pubStartDate,
      pubEndDate,
      resultsPerPage: String(limit),
      startIndex: "0",
    };
    if (args.severity) params["cvssV3Severity"] = String(args.severity).toUpperCase();

    const data = await nvdGet(params, apiKey);
    const vulns = data["vulnerabilities"] as Array<Record<string, unknown>> | undefined ?? [];

    return {
      days_back: daysBack,
      total_results: data["totalResults"],
      showing: vulns.length,
      vulnerabilities: vulns.map(formatCve),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
