// Segment Customer Data Platform API.
// Docs: https://segment.com/docs/connections/sources/catalog/libraries/server/http-api/
//       https://docs.segmentapis.com/
// Auth: write_key (Basic auth, base64 encoded) for tracking; api_token (Bearer) for management
// Base: https://api.segment.io/v1 (tracking) / https://api.segmentapis.com (management)

const SEGMENT_TRACK_BASE = "https://api.segment.io/v1";
const SEGMENT_MGMT_BASE = "https://api.segmentapis.com";

function requireWriteKey(args: Record<string, unknown>): string {
  const key = String(args.write_key ?? args.api_key ?? "").trim();
  if (!key) throw new Error("write_key is required. Get one from your Segment source settings.");
  return key;
}

function requireApiToken(args: Record<string, unknown>): string {
  const token = String(args.api_token ?? args.api_key ?? "").trim();
  if (!token) throw new Error("api_token is required. Get one from app.segment.com/goto-my-workspace/settings/access-management.");
  return token;
}

async function segmentTrackPost(writeKey: string, path: string, body: unknown): Promise<Record<string, unknown>> {
  const encoded = Buffer.from(`${writeKey}:`).toString("base64");
  const res = await fetch(`${SEGMENT_TRACK_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encoded}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Segment tracking error (${res.status}): ${text || res.statusText}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

async function segmentMgmtGet<T>(apiToken: string, path: string, query?: Record<string, string>): Promise<T> {
  const url = new URL(`${SEGMENT_MGMT_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = (data.errors as Array<Record<string, unknown>>)?.[0];
    const msg = err?.message as string ?? `HTTP ${res.status}`;
    throw new Error(`Segment management error (${res.status}): ${msg}`);
  }
  return data as T;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function segment_track_event(args: Record<string, unknown>): Promise<unknown> {
  const writeKey = requireWriteKey(args);
  const event = String(args.event ?? "").trim();
  const userId = String(args.user_id ?? "").trim();
  const anonymousId = String(args.anonymous_id ?? "").trim();
  if (!event) throw new Error("event is required.");
  if (!userId && !anonymousId) throw new Error("user_id or anonymous_id is required.");

  const body: Record<string, unknown> = {
    event,
    timestamp: args.timestamp ?? new Date().toISOString(),
  };
  if (userId) body.userId = userId;
  if (anonymousId) body.anonymousId = anonymousId;
  if (args.properties && typeof args.properties === "object") body.properties = args.properties;
  if (args.context && typeof args.context === "object") body.context = args.context;

  const data = await segmentTrackPost(writeKey, "/track", body);
  return { success: true, raw: data };
}

export async function segment_identify_user(args: Record<string, unknown>): Promise<unknown> {
  const writeKey = requireWriteKey(args);
  const userId = String(args.user_id ?? "").trim();
  const anonymousId = String(args.anonymous_id ?? "").trim();
  if (!userId && !anonymousId) throw new Error("user_id or anonymous_id is required.");

  const body: Record<string, unknown> = {
    timestamp: args.timestamp ?? new Date().toISOString(),
  };
  if (userId) body.userId = userId;
  if (anonymousId) body.anonymousId = anonymousId;
  if (args.traits && typeof args.traits === "object") body.traits = args.traits;
  if (args.context && typeof args.context === "object") body.context = args.context;

  const data = await segmentTrackPost(writeKey, "/identify", body);
  return { success: true, raw: data };
}

export async function segment_list_sources(args: Record<string, unknown>): Promise<unknown> {
  const apiToken = requireApiToken(args);
  const workspaceId = String(args.workspace_id ?? "").trim();
  if (!workspaceId) throw new Error("workspace_id is required.");

  const data = await segmentMgmtGet<{ data: { sources: unknown[] } }>(
    apiToken, `/workspaces/${workspaceId}/sources`
  );
  const sources = data.data?.sources ?? [];
  return { count: sources.length, sources };
}

export async function segment_list_destinations(args: Record<string, unknown>): Promise<unknown> {
  const apiToken = requireApiToken(args);
  const sourceId = String(args.source_id ?? "").trim();
  if (!sourceId) throw new Error("source_id is required.");

  const data = await segmentMgmtGet<{ data: { destinations: unknown[] } }>(
    apiToken, `/sources/${sourceId}/destinations`
  );
  const destinations = data.data?.destinations ?? [];
  return { count: destinations.length, destinations };
}

export async function segment_get_source(args: Record<string, unknown>): Promise<unknown> {
  const apiToken = requireApiToken(args);
  const sourceId = String(args.source_id ?? "").trim();
  if (!sourceId) throw new Error("source_id is required.");

  const data = await segmentMgmtGet<{ data: { source: unknown } }>(
    apiToken, `/sources/${sourceId}`
  );
  return data.data?.source ?? data;
}
