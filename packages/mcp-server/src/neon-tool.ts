// Neon Serverless Postgres API integration for the UnClick MCP server.
// Uses the Neon REST API via fetch - no external dependencies.
// Users must supply an API key from console.neon.tech.

const NEON_API_BASE = "https://console.neon.tech/api/v2";

// ── Types ─────────────────────────────────────────────────────────────────────

interface NeonProject {
  id: string;
  name: string;
  region_id: string;
  created_at: string;
  updated_at: string;
}

interface NeonBranch {
  id: string;
  project_id: string;
  name: string;
  primary: boolean;
  created_at: string;
  updated_at: string;
}

interface NeonDatabase {
  id: number;
  branch_id: string;
  name: string;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function neonFetch(
  apiKey: string,
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
  query?: Record<string, string | number | undefined>
): Promise<unknown> {
  const url = new URL(`${NEON_API_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    return { error: `Network error reaching Neon API: ${err instanceof Error ? err.message : String(err)}` };
  }

  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (response.status === 401) return { error: "Neon API key is invalid or expired. Check your api_key.", status: 401 };
  if (response.status === 403) return { error: "Neon API: insufficient permissions.", status: 403 };
  if (response.status === 404) return { error: "Resource not found. Check the project_id, branch_id, or endpoint_id.", status: 404 };

  if (!response.ok) {
    const detail = (data as Record<string, unknown>)?.message ?? text;
    return { error: `Neon API error ${response.status}: ${detail}`, status: response.status };
  }

  return data;
}

// ── Operations ────────────────────────────────────────────────────────────────

export async function neonListProjects(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = String(args.api_key ?? process.env.NEON_API_KEY ?? "").trim();
  if (!apiKey) return { error: "api_key is required. Get one at console.neon.tech." };

  try {
    return neonFetch(apiKey, "GET", "/projects", undefined, {
      limit: args.limit ? Number(args.limit) : undefined,
      cursor: args.cursor ? String(args.cursor) : undefined,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function neonGetProject(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = String(args.api_key ?? process.env.NEON_API_KEY ?? "").trim();
  if (!apiKey) return { error: "api_key is required. Get one at console.neon.tech." };
  const projectId = String(args.project_id ?? "").trim();
  if (!projectId) return { error: "project_id is required." };

  try {
    return neonFetch(apiKey, "GET", `/projects/${encodeURIComponent(projectId)}`);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function neonListBranches(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = String(args.api_key ?? process.env.NEON_API_KEY ?? "").trim();
  if (!apiKey) return { error: "api_key is required. Get one at console.neon.tech." };
  const projectId = String(args.project_id ?? "").trim();
  if (!projectId) return { error: "project_id is required." };

  try {
    return neonFetch(apiKey, "GET", `/projects/${encodeURIComponent(projectId)}/branches`);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function neonCreateBranch(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = String(args.api_key ?? process.env.NEON_API_KEY ?? "").trim();
  if (!apiKey) return { error: "api_key is required. Get one at console.neon.tech." };
  const projectId = String(args.project_id ?? "").trim();
  if (!projectId) return { error: "project_id is required." };

  try {
    const branchBody: Record<string, unknown> = {
      branch: args.branch_name ? { name: String(args.branch_name) } : {},
      endpoints: [{ type: "read_write" }],
    };
    return neonFetch(apiKey, "POST", `/projects/${encodeURIComponent(projectId)}/branches`, branchBody);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function neonListDatabases(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = String(args.api_key ?? process.env.NEON_API_KEY ?? "").trim();
  if (!apiKey) return { error: "api_key is required. Get one at console.neon.tech." };
  const projectId = String(args.project_id ?? "").trim();
  if (!projectId) return { error: "project_id is required." };
  const branchId = String(args.branch_id ?? "").trim();
  if (!branchId) return { error: "branch_id is required." };

  try {
    return neonFetch(
      apiKey,
      "GET",
      `/projects/${encodeURIComponent(projectId)}/branches/${encodeURIComponent(branchId)}/databases`
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function neonExecuteSql(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = String(args.api_key ?? process.env.NEON_API_KEY ?? "").trim();
  if (!apiKey) return { error: "api_key is required. Get one at console.neon.tech." };
  const projectId = String(args.project_id ?? "").trim();
  if (!projectId) return { error: "project_id is required." };
  const branchId = String(args.branch_id ?? "").trim();
  if (!branchId) return { error: "branch_id is required." };
  const endpointId = String(args.endpoint_id ?? "").trim();
  if (!endpointId) return { error: "endpoint_id is required." };
  const query = String(args.query ?? "").trim();
  if (!query) return { error: "query is required." };
  const databaseName = String(args.database_name ?? "").trim();
  if (!databaseName) return { error: "database_name is required." };

  try {
    const path = `/projects/${encodeURIComponent(projectId)}/branches/${encodeURIComponent(branchId)}/endpoints/${encodeURIComponent(endpointId)}/query`;
    return neonFetch(apiKey, "POST", path, { query, database_name: databaseName });
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
