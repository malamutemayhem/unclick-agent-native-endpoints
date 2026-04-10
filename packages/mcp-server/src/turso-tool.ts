// Turso SQLite Edge DB API integration for the UnClick MCP server.
// Uses the Turso REST API via fetch - no external dependencies.
// Users must supply an API key from app.turso.tech.

const TURSO_API_BASE = "https://api.turso.tech/v1";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TursoSqlArg {
  type: string;
  value: string;
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function tursoFetch(
  apiKey: string,
  method: "GET" | "POST" | "DELETE",
  url: string,
  body?: unknown
): Promise<unknown> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
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
    return { error: `Network error reaching Turso API: ${err instanceof Error ? err.message : String(err)}` };
  }

  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (response.status === 401) return { error: "Turso API key is invalid or expired. Check your api_key.", status: 401 };
  if (response.status === 403) return { error: "Turso API: insufficient permissions.", status: 403 };
  if (response.status === 404) return { error: "Resource not found. Check the org, database name, or group.", status: 404 };

  if (!response.ok) {
    const errData = data as Record<string, unknown>;
    const detail = errData?.error ?? errData?.message ?? text;
    return { error: `Turso API error ${response.status}: ${detail}`, status: response.status };
  }

  return data;
}

// ── Operations ────────────────────────────────────────────────────────────────

export async function tursoListDatabases(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = String(args.api_key ?? process.env.TURSO_API_KEY ?? "").trim();
  if (!apiKey) return { error: "api_key is required. Get one at app.turso.tech." };
  const org = String(args.org ?? "").trim();
  if (!org) return { error: "org is required (your Turso organization name or username)." };

  try {
    return tursoFetch(apiKey, "GET", `${TURSO_API_BASE}/organizations/${encodeURIComponent(org)}/databases`);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function tursoCreateDatabase(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = String(args.api_key ?? process.env.TURSO_API_KEY ?? "").trim();
  if (!apiKey) return { error: "api_key is required. Get one at app.turso.tech." };
  const org = String(args.org ?? "").trim();
  if (!org) return { error: "org is required." };
  const name = String(args.name ?? "").trim();
  if (!name) return { error: "name is required (the database name)." };
  const group = String(args.group ?? "").trim();
  if (!group) return { error: "group is required (the placement group, e.g. 'default')." };

  try {
    return tursoFetch(
      apiKey,
      "POST",
      `${TURSO_API_BASE}/organizations/${encodeURIComponent(org)}/databases`,
      { name, group }
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function tursoListGroups(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = String(args.api_key ?? process.env.TURSO_API_KEY ?? "").trim();
  if (!apiKey) return { error: "api_key is required. Get one at app.turso.tech." };
  const org = String(args.org ?? "").trim();
  if (!org) return { error: "org is required." };

  try {
    return tursoFetch(apiKey, "GET", `${TURSO_API_BASE}/organizations/${encodeURIComponent(org)}/groups`);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function tursoGetDatabase(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = String(args.api_key ?? process.env.TURSO_API_KEY ?? "").trim();
  if (!apiKey) return { error: "api_key is required. Get one at app.turso.tech." };
  const org = String(args.org ?? "").trim();
  if (!org) return { error: "org is required." };
  const name = String(args.name ?? "").trim();
  if (!name) return { error: "name is required (the database name)." };

  try {
    return tursoFetch(
      apiKey,
      "GET",
      `${TURSO_API_BASE}/organizations/${encodeURIComponent(org)}/databases/${encodeURIComponent(name)}`
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function tursoExecuteSql(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = String(args.api_key ?? process.env.TURSO_API_KEY ?? "").trim();
  if (!apiKey) return { error: "api_key is required. Get one at app.turso.tech." };
  const org = String(args.org ?? "").trim();
  if (!org) return { error: "org is required." };
  const dbName = String(args.db_name ?? "").trim();
  if (!dbName) return { error: "db_name is required." };
  const sql = String(args.sql ?? "").trim();
  if (!sql) return { error: "sql is required." };

  // Parse optional args array (positional query parameters)
  let sqlArgs: TursoSqlArg[] | undefined;
  if (args.args !== undefined) {
    if (Array.isArray(args.args)) {
      sqlArgs = args.args as TursoSqlArg[];
    } else if (typeof args.args === "string") {
      try { sqlArgs = JSON.parse(args.args); }
      catch { return { error: "args must be a JSON array of {type, value} objects." }; }
    }
  }

  try {
    // Build the database URL: {db_name}-{org}.turso.io
    const dbHost = `https://${dbName}-${org}.turso.io`;
    const pipelineUrl = `${dbHost}/v2/pipeline`;

    const stmt: Record<string, unknown> = { sql };
    if (sqlArgs) stmt.args = sqlArgs;

    const pipelineBody = {
      requests: [
        { type: "execute", stmt },
        { type: "close" },
      ],
    };

    return tursoFetch(apiKey, "POST", pipelineUrl, pipelineBody);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
