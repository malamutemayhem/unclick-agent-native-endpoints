// Upstash Redis/Kafka API integration for the UnClick MCP server.
// Uses the Upstash REST API via fetch - no external dependencies.
// Auth: Basic auth (email:api_key base64 encoded).
// Users must supply credentials from console.upstash.com.

const UPSTASH_API_BASE = "https://api.upstash.com/v2";

// ── Auth helper ───────────────────────────────────────────────────────────────

function buildBasicAuth(email: string, apiKey: string): string {
  const credentials = `${email}:${apiKey}`;
  // btoa is available in Node 16+ and all modern runtimes
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

function requireAuth(args: Record<string, unknown>): { email: string; apiKey: string } {
  const apiKey = String(args.api_key ?? process.env.UPSTASH_API_KEY ?? "").trim();
  if (!apiKey) throw new Error("api_key is required. Get one at console.upstash.com.");
  const email = String(args.email ?? process.env.UPSTASH_EMAIL ?? "").trim();
  if (!email) throw new Error("email is required (your Upstash account email).");
  return { email, apiKey };
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function upstashFetch(
  auth: string,
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown
): Promise<unknown> {
  const headers: Record<string, string> = {
    Authorization: auth,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${UPSTASH_API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    return { error: `Network error reaching Upstash API: ${err instanceof Error ? err.message : String(err)}` };
  }

  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (response.status === 401) return { error: "Upstash credentials invalid. Check your email and api_key.", status: 401 };
  if (response.status === 403) return { error: "Upstash API: insufficient permissions.", status: 403 };
  if (response.status === 404) return { error: "Resource not found. Check the db_id, cluster_id, or topic.", status: 404 };

  if (!response.ok) {
    const detail = (data as Record<string, unknown>)?.message ?? (data as Record<string, unknown>)?.error ?? text;
    return { error: `Upstash API error ${response.status}: ${detail}`, status: response.status };
  }

  return data;
}

// ── Redis operations ──────────────────────────────────────────────────────────

export async function upstashRedisGet(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { email, apiKey } = requireAuth(args);
    const dbId = String(args.db_id ?? "").trim();
    if (!dbId) return { error: "db_id is required." };
    const key = String(args.key ?? "").trim();
    if (!key) return { error: "key is required." };

    const auth = buildBasicAuth(email, apiKey);
    return upstashFetch(auth, "GET", `/redis/databases/${encodeURIComponent(dbId)}/get/${encodeURIComponent(key)}`);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function upstashRedisSet(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { email, apiKey } = requireAuth(args);
    const dbId = String(args.db_id ?? "").trim();
    if (!dbId) return { error: "db_id is required." };
    const key = String(args.key ?? "").trim();
    if (!key) return { error: "key is required." };
    if (args.value === undefined || args.value === null) return { error: "value is required." };
    const value = String(args.value);

    const auth = buildBasicAuth(email, apiKey);
    const body: Record<string, unknown> = { key, value };
    if (args.ex !== undefined) body.ex = Number(args.ex);

    return upstashFetch(auth, "POST", `/redis/databases/${encodeURIComponent(dbId)}/set`, body);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function upstashRedisDel(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { email, apiKey } = requireAuth(args);
    const dbId = String(args.db_id ?? "").trim();
    if (!dbId) return { error: "db_id is required." };
    const key = String(args.key ?? "").trim();
    if (!key) return { error: "key is required." };

    const auth = buildBasicAuth(email, apiKey);
    return upstashFetch(auth, "POST", `/redis/databases/${encodeURIComponent(dbId)}/del`, { key });
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function upstashRedisListKeys(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { email, apiKey } = requireAuth(args);
    const dbId = String(args.db_id ?? "").trim();
    if (!dbId) return { error: "db_id is required." };
    const pattern = String(args.pattern ?? "*");

    const auth = buildBasicAuth(email, apiKey);
    return upstashFetch(auth, "POST", `/redis/databases/${encodeURIComponent(dbId)}/keys`, { pattern });
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function upstashRedisIncr(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { email, apiKey } = requireAuth(args);
    const dbId = String(args.db_id ?? "").trim();
    if (!dbId) return { error: "db_id is required." };
    const key = String(args.key ?? "").trim();
    if (!key) return { error: "key is required." };

    const auth = buildBasicAuth(email, apiKey);
    return upstashFetch(auth, "POST", `/redis/databases/${encodeURIComponent(dbId)}/incr`, { key });
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Kafka operations ──────────────────────────────────────────────────────────

export async function upstashKafkaProduce(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { email, apiKey } = requireAuth(args);
    const clusterId = String(args.cluster_id ?? "").trim();
    if (!clusterId) return { error: "cluster_id is required." };
    const topic = String(args.topic ?? "").trim();
    if (!topic) return { error: "topic is required." };

    let messages: unknown[];
    if (Array.isArray(args.messages)) {
      messages = args.messages;
    } else if (typeof args.messages === "string") {
      try { messages = JSON.parse(args.messages); }
      catch { return { error: "messages must be a JSON array or a valid JSON string representing an array." }; }
    } else {
      return { error: "messages is required (array of message objects or a JSON string)." };
    }

    const auth = buildBasicAuth(email, apiKey);
    const path = `/kafka/clusters/${encodeURIComponent(clusterId)}/topics/${encodeURIComponent(topic)}/produce`;
    return upstashFetch(auth, "POST", path, { messages });
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function upstashKafkaListTopics(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { email, apiKey } = requireAuth(args);
    const clusterId = String(args.cluster_id ?? "").trim();
    if (!clusterId) return { error: "cluster_id is required." };

    const auth = buildBasicAuth(email, apiKey);
    return upstashFetch(auth, "GET", `/kafka/clusters/${encodeURIComponent(clusterId)}/topics`);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
