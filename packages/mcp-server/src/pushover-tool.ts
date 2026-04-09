// Pushover API integration for the UnClick MCP server.
// Uses the Pushover REST API via fetch - no external dependencies.
// Users must supply an app token (from pushover.net/apps) and a user/group key.

const PUSHOVER_API_BASE = "https://api.pushover.net/1";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PushoverSendResponse {
  status: number;
  request: string;
  receipt?: string;
  errors?: string[];
}

interface PushoverReceiptResponse {
  status: number;
  acknowledged: number;
  acknowledged_at: number;
  acknowledged_by: string;
  acknowledged_by_device: string;
  last_delivered_at: number;
  expired: number;
  expires_at: number;
  called_back: number;
  called_back_at: number;
  request: string;
  errors?: string[];
}

interface PushoverSoundsResponse {
  status: number;
  sounds: Record<string, string>;
  request: string;
}

interface PushoverValidateResponse {
  status: number;
  group: number;
  devices: string[];
  licenses: string[];
  request: string;
  errors?: string[];
}

// ─── Auth validation ──────────────────────────────────────────────────────────

function requireAuth(args: Record<string, unknown>): { token: string; user: string } {
  const token = String(args.app_token ?? "").trim();
  const user = String(args.user_key ?? "").trim();
  if (!token) throw new Error("app_token is required. Create an app at pushover.net/apps.");
  if (!user) throw new Error("user_key is required. Find it on your Pushover dashboard.");
  return { token, user };
}

// ─── API helper ───────────────────────────────────────────────────────────────

async function pushoverPost<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const res = await fetch(`${PUSHOVER_API_BASE}${path}.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await res.json() as Record<string, unknown>;
  if ((data.status as number) !== 1) {
    const errors = Array.isArray(data.errors) ? (data.errors as string[]).join("; ") : `HTTP ${res.status}`;
    throw new Error(`Pushover error: ${errors}`);
  }
  return data as T;
}

async function pushoverGet<T>(path: string, query: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams(query).toString();
  const res = await fetch(`${PUSHOVER_API_BASE}${path}.json${qs ? `?${qs}` : ""}`, {
    headers: { "Content-Type": "application/json" },
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok && (data.status as number) !== 1) {
    const errors = Array.isArray(data.errors) ? (data.errors as string[]).join("; ") : `HTTP ${res.status}`;
    throw new Error(`Pushover error: ${errors}`);
  }
  return data as T;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function pushoverSendNotification(args: Record<string, unknown>): Promise<unknown> {
  const { token, user } = requireAuth(args);
  const message = String(args.message ?? "").trim();
  if (!message) throw new Error("message is required.");

  const params: Record<string, string | number> = { token, user, message };

  if (args.title) params.title = String(args.title);
  if (args.url) params.url = String(args.url);
  if (args.url_title) params.url_title = String(args.url_title);
  if (args.sound) params.sound = String(args.sound);
  if (args.device) params.device = String(args.device);

  // Priority: -2 (lowest), -1 (low), 0 (normal), 1 (high), 2 (emergency)
  const priority = args.priority !== undefined ? Number(args.priority) : 0;
  if (priority < -2 || priority > 2) throw new Error("priority must be -2, -1, 0, 1, or 2.");
  params.priority = priority;

  // Emergency priority requires retry and expire
  if (priority === 2) {
    const retry = Number(args.retry ?? 60);
    const expire = Number(args.expire ?? 3600);
    if (retry < 30) throw new Error("retry must be at least 30 seconds for emergency notifications.");
    if (expire > 10800) throw new Error("expire must be at most 10800 seconds (3 hours).");
    params.retry = retry;
    params.expire = expire;
    if (args.callback) params.callback = String(args.callback);
  }

  if (args.html === true || args.html === 1) params.html = 1;
  if (args.monospace === true || args.monospace === 1) params.monospace = 1;
  if (args.timestamp) params.timestamp = Number(args.timestamp);

  const result = await pushoverPost<PushoverSendResponse>("/messages", params);
  return {
    success: true,
    request_id: result.request,
    receipt: result.receipt ?? null,
    priority,
  };
}

export async function pushoverGetReceipt(args: Record<string, unknown>): Promise<unknown> {
  const token = String(args.app_token ?? "").trim();
  if (!token) throw new Error("app_token is required.");
  const receipt = String(args.receipt ?? "").trim();
  if (!receipt) throw new Error("receipt is required (returned from an emergency notification).");

  const result = await pushoverGet<PushoverReceiptResponse>(
    `/receipts/${encodeURIComponent(receipt)}`,
    { token }
  );
  return {
    acknowledged: result.acknowledged === 1,
    acknowledged_at: result.acknowledged_at ? new Date(result.acknowledged_at * 1000).toISOString() : null,
    acknowledged_by: result.acknowledged_by || null,
    acknowledged_by_device: result.acknowledged_by_device || null,
    last_delivered_at: result.last_delivered_at ? new Date(result.last_delivered_at * 1000).toISOString() : null,
    expired: result.expired === 1,
    expires_at: result.expires_at ? new Date(result.expires_at * 1000).toISOString() : null,
  };
}

export async function pushoverCancelEmergency(args: Record<string, unknown>): Promise<unknown> {
  const { token } = requireAuth(args);
  const receipt = String(args.receipt ?? "").trim();
  if (!receipt) throw new Error("receipt is required (returned from an emergency notification).");

  const res = await fetch(`${PUSHOVER_API_BASE}/receipts/${encodeURIComponent(receipt)}/cancel.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  const data = await res.json() as Record<string, unknown>;
  if ((data.status as number) !== 1) {
    const errors = Array.isArray(data.errors) ? (data.errors as string[]).join("; ") : `HTTP ${res.status}`;
    throw new Error(`Pushover error: ${errors}`);
  }
  return { success: true, receipt, cancelled: true };
}

export async function pushoverListSounds(args: Record<string, unknown>): Promise<unknown> {
  const token = String(args.app_token ?? "").trim();
  if (!token) throw new Error("app_token is required.");

  const result = await pushoverGet<PushoverSoundsResponse>("/sounds", { token });
  const sounds = Object.entries(result.sounds).map(([id, name]) => ({ id, name }));
  return { count: sounds.length, sounds };
}

export async function pushoverValidateUser(args: Record<string, unknown>): Promise<unknown> {
  const { token, user } = requireAuth(args);
  const params: Record<string, string | number> = { token, user };
  if (args.device) params.device = String(args.device);

  const result = await pushoverPost<PushoverValidateResponse>("/users/validate", params);
  return {
    valid: result.status === 1,
    is_group: result.group === 1,
    devices: result.devices ?? [],
    licenses: result.licenses ?? [],
  };
}
