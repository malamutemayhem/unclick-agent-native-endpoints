// Hunter.io integration.
// Find and verify professional email addresses by company domain.
// Docs: https://hunter.io/api-documentation
// Auth: HUNTER_API_KEY env var (api_key query param).
// Base URL: https://api.hunter.io/v2/

const HUNTER_BASE = "https://api.hunter.io/v2";

function getApiKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.HUNTER_API_KEY ?? "").trim();
  if (!key) throw new Error("api_key is required (or set HUNTER_API_KEY env var).");
  return key;
}

async function hunterGet(apiKey: string, path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({ ...params, api_key: apiKey });
  const res = await fetch(`${HUNTER_BASE}${path}?${qs}`, {
    headers: { "User-Agent": "UnClickMCP/1.0 (https://unclick.io)" },
  });
  if (res.status === 401 || res.status === 403) throw new Error("Invalid Hunter.io API key.");
  if (res.status === 404) throw new Error("Resource not found.");
  if (res.status === 429) throw new Error("Hunter.io rate limit exceeded.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Hunter.io API HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  const json = await res.json() as Record<string, unknown>;
  const errors = json["errors"] as Array<Record<string, unknown>> | undefined;
  if (errors?.length) {
    throw new Error(`Hunter.io error: ${errors.map((e) => e["details"] ?? e["id"]).join(", ")}`);
  }
  return (json["data"] as Record<string, unknown>) ?? json;
}

// ─── find_email ───────────────────────────────────────────────────────────────

export async function findEmail(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const domain = String(args.domain ?? "").trim().toLowerCase();
    if (!domain) return { error: "domain is required (e.g. stripe.com)." };

    const params: Record<string, string> = { domain };
    if (args.first_name) params["first_name"] = String(args.first_name);
    if (args.last_name) params["last_name"] = String(args.last_name);
    if (args.company) params["company"] = String(args.company);
    if (args.limit) params["limit"] = String(Math.min(100, Number(args.limit)));
    if (args.skip) params["skip"] = String(args.skip);
    if (args.department) params["department"] = String(args.department);
    if (args.seniority) params["seniority"] = String(args.seniority);

    const data = await hunterGet(apiKey, "/domain-search", params);

    return {
      domain: data["domain"],
      organization: data["organization"],
      description: data["description"],
      twitter: data["twitter"],
      linkedin: data["linkedin"],
      facebook: data["facebook"],
      instagram: data["instagram"],
      youtube: data["youtube"],
      company_size: data["company_size"],
      country: data["country"],
      pattern: data["pattern"],
      email_count: data["emails_count"],
      emails: (data["emails"] as Array<Record<string, unknown>> | undefined)?.map((e) => ({
        value: e["value"],
        type: e["type"],
        confidence: e["confidence"],
        first_name: e["first_name"],
        last_name: e["last_name"],
        position: e["position"],
        department: e["department"],
        seniority: e["seniority"],
        linkedin: e["linkedin"],
        twitter: e["twitter"],
        phone: e["phone_number"],
        verification_status: (e["verification"] as Record<string, unknown>)?.["status"],
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── verify_email ─────────────────────────────────────────────────────────────

export async function verifyEmail(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const email = String(args.email ?? "").trim().toLowerCase();
    if (!email) return { error: "email is required." };

    const data = await hunterGet(apiKey, "/email-verifier", { email });

    return {
      email: data["email"],
      status: data["status"],
      result: data["result"],
      score: data["score"],
      regexp: data["regexp"],
      gibberish: data["gibberish"],
      disposable: data["disposable"],
      webmail: data["webmail"],
      mx_records: data["mx_records"],
      smtp_server: data["smtp_server"],
      smtp_check: data["smtp_check"],
      accept_all: data["accept_all"],
      block: data["block"],
      sources: data["sources"],
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── get_domain_info ─────────────────────────────────────────────────────────

export async function getDomainInfo(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const domain = String(args.domain ?? "").trim().toLowerCase();
    if (!domain) return { error: "domain is required (e.g. stripe.com)." };

    const data = await hunterGet(apiKey, "/domain-search", { domain, limit: "1" });

    return {
      domain: data["domain"],
      organization: data["organization"],
      description: data["description"],
      country: data["country"],
      company_size: data["company_size"],
      industry: data["industry"],
      technology: data["technology"],
      pattern: data["pattern"],
      website: data["website"],
      twitter: data["twitter"],
      linkedin: data["linkedin"],
      facebook: data["facebook"],
      email_count: data["emails_count"],
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
