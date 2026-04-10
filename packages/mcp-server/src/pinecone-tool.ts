// Pinecone Vector DB integration for the UnClick MCP server.
// Uses the Pinecone REST API via fetch - no external dependencies.
// Users must supply an API key from app.pinecone.io.

const PINE_BASE = "https://api.pinecone.io";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? "").trim();
  if (!key) throw new Error("api_key is required. Get one at app.pinecone.io.");
  return key;
}

async function pineGet<T>(apiKey: string, path: string): Promise<T> {
  const res = await fetch(`${PINE_BASE}${path}`, {
    headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.message as string) ?? (data.error as string) ?? `HTTP ${res.status}`;
    throw new Error(`Pinecone error (${res.status}): ${msg}`);
  }
  return data as T;
}

async function pinePost<T>(apiKey: string, path: string, body: unknown, baseUrl?: string): Promise<T> {
  const url = baseUrl ? `${baseUrl}${path}` : `${PINE_BASE}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.message as string) ?? (data.error as string) ?? `HTTP ${res.status}`;
    throw new Error(`Pinecone error (${res.status}): ${msg}`);
  }
  return data as T;
}

async function pineDel<T>(apiKey: string, path: string, body?: unknown, baseUrl?: string): Promise<T> {
  const url = baseUrl ? `${baseUrl}${path}` : `${PINE_BASE}${path}`;
  const options: RequestInit = {
    method: "DELETE",
    headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  if (res.status === 200 || res.status === 204) return {} as T;
  const data = await res.json() as Record<string, unknown>;
  const msg = (data.message as string) ?? `HTTP ${res.status}`;
  throw new Error(`Pinecone error (${res.status}): ${msg}`);
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function pineconeListIndexes(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const data = await pineGet<{ indexes?: Array<{ name: string; dimension: number; metric: string; status: unknown; host: string }> }>(apiKey, "/indexes");
  const indexes = data.indexes ?? [];
  return { count: indexes.length, indexes };
}

export async function pineconeDescribeIndex(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const name = String(args.index_name ?? "").trim();
  if (!name) throw new Error("index_name is required.");
  return pineGet(apiKey, `/indexes/${encodeURIComponent(name)}`);
}

export async function pineconeQueryVectors(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const indexHost = String(args.index_host ?? "").trim();
  if (!indexHost) throw new Error("index_host is required (the full host URL from describe_index, e.g. https://my-index-xxx.svc.pinecone.io).");

  let vector: number[];
  if (Array.isArray(args.vector)) {
    vector = args.vector as number[];
  } else if (typeof args.vector === "string") {
    try { vector = JSON.parse(args.vector); }
    catch { throw new Error("vector must be a JSON array of numbers."); }
  } else {
    throw new Error("vector is required (array of numbers).");
  }

  const body: Record<string, unknown> = {
    vector,
    topK: Math.min(10000, Math.max(1, Number(args.top_k ?? 10))),
    includeValues: args.include_values === true,
    includeMetadata: args.include_metadata !== false,
  };
  if (args.namespace) body.namespace = String(args.namespace);
  if (args.filter) body.filter = args.filter;

  const host = indexHost.startsWith("http") ? indexHost : `https://${indexHost}`;
  return pinePost(apiKey, "/query", body, host);
}

export async function pineconeUpsertVectors(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const indexHost = String(args.index_host ?? "").trim();
  if (!indexHost) throw new Error("index_host is required.");

  let vectors: unknown[];
  if (Array.isArray(args.vectors)) {
    vectors = args.vectors;
  } else if (typeof args.vectors === "string") {
    try { vectors = JSON.parse(args.vectors); }
    catch { throw new Error("vectors must be a JSON array of {id, values, metadata?} objects."); }
  } else {
    throw new Error("vectors is required (array of {id, values, metadata?} objects).");
  }

  const body: Record<string, unknown> = { vectors };
  if (args.namespace) body.namespace = String(args.namespace);

  const host = indexHost.startsWith("http") ? indexHost : `https://${indexHost}`;
  return pinePost(apiKey, "/vectors/upsert", body, host);
}

export async function pineconeDeleteVectors(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const indexHost = String(args.index_host ?? "").trim();
  if (!indexHost) throw new Error("index_host is required.");

  const body: Record<string, unknown> = {};
  if (args.ids) {
    body.ids = Array.isArray(args.ids) ? args.ids : [String(args.ids)];
  } else if (args.delete_all === true) {
    body.deleteAll = true;
  } else {
    throw new Error("Either ids (array of vector IDs) or delete_all=true is required.");
  }
  if (args.namespace) body.namespace = String(args.namespace);
  if (args.filter) body.filter = args.filter;

  const host = indexHost.startsWith("http") ? indexHost : `https://${indexHost}`;
  await pineDel(apiKey, "/vectors/delete", body, host);
  return { success: true };
}
