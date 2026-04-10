// PagerDuty Incident Management API.
// Docs: https://developer.pagerduty.com/api-reference
// Auth: Token token=API_KEY (Authorization header)
// Base: https://api.pagerduty.com

const PD_API_BASE = "https://api.pagerduty.com";

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? "").trim();
  if (!key) throw new Error("api_key is required. Get one at app.pagerduty.com/api_keys.");
  return key;
}

async function pdGet<T>(apiKey: string, path: string, query?: Record<string, string>): Promise<T> {
  const url = new URL(`${PD_API_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Token token=${apiKey}`,
      Accept: "application/vnd.pagerduty+json;version=2",
      "Content-Type": "application/json",
    },
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.error as Record<string, unknown>)?.message as string ?? `HTTP ${res.status}`;
    throw new Error(`PagerDuty error (${res.status}): ${msg}`);
  }
  return data as T;
}

async function pdPost<T>(apiKey: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${PD_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Token token=${apiKey}`,
      Accept: "application/vnd.pagerduty+json;version=2",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.error as Record<string, unknown>)?.message as string ?? `HTTP ${res.status}`;
    throw new Error(`PagerDuty error (${res.status}): ${msg}`);
  }
  return data as T;
}

async function pdPut<T>(apiKey: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${PD_API_BASE}${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Token token=${apiKey}`,
      Accept: "application/vnd.pagerduty+json;version=2",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.error as Record<string, unknown>)?.message as string ?? `HTTP ${res.status}`;
    throw new Error(`PagerDuty error (${res.status}): ${msg}`);
  }
  return data as T;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function pagerduty_list_incidents(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const query: Record<string, string> = {};
  if (args.status) query["statuses[]"] = String(args.status);
  if (args.limit) query.limit = String(args.limit);
  if (args.offset) query.offset = String(args.offset);
  if (args.service_ids) query["service_ids[]"] = String(args.service_ids);

  const data = await pdGet<{ incidents: unknown[]; total: number }>(apiKey, "/incidents", query);
  return {
    total: data.total,
    count: data.incidents.length,
    incidents: data.incidents,
  };
}

export async function pagerduty_get_incident(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const id = String(args.incident_id ?? "").trim();
  if (!id) throw new Error("incident_id is required.");
  const data = await pdGet<{ incident: unknown }>(apiKey, `/incidents/${id}`);
  return data.incident;
}

export async function pagerduty_create_incident(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const title = String(args.title ?? "").trim();
  const serviceId = String(args.service_id ?? "").trim();
  if (!title) throw new Error("title is required.");
  if (!serviceId) throw new Error("service_id is required.");

  const body: Record<string, unknown> = {
    incident: {
      type: "incident",
      title,
      service: { id: serviceId, type: "service_reference" },
    },
  };
  if (args.urgency) (body.incident as Record<string, unknown>).urgency = String(args.urgency);
  if (args.body_details) {
    (body.incident as Record<string, unknown>).body = {
      type: "incident_body",
      details: String(args.body_details),
    };
  }
  if (args.from) {
    // PagerDuty requires From header for incident creation
    const res = await fetch(`${PD_API_BASE}/incidents`, {
      method: "POST",
      headers: {
        Authorization: `Token token=${apiKey}`,
        Accept: "application/vnd.pagerduty+json;version=2",
        "Content-Type": "application/json",
        From: String(args.from),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      const msg = (data.error as Record<string, unknown>)?.message as string ?? `HTTP ${res.status}`;
      throw new Error(`PagerDuty error (${res.status}): ${msg}`);
    }
    return (data as { incident: unknown }).incident;
  }

  const data = await pdPost<{ incident: unknown }>(apiKey, "/incidents", body);
  return data.incident;
}

export async function pagerduty_acknowledge_incident(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const id = String(args.incident_id ?? "").trim();
  if (!id) throw new Error("incident_id is required.");

  const body = { incident: { type: "incident", status: "acknowledged" } };
  const data = await pdPut<{ incident: unknown }>(apiKey, `/incidents/${id}`, body);
  return { incident_id: id, status: "acknowledged", raw: data.incident };
}

export async function pagerduty_resolve_incident(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const id = String(args.incident_id ?? "").trim();
  if (!id) throw new Error("incident_id is required.");

  const body = { incident: { type: "incident", status: "resolved" } };
  const data = await pdPut<{ incident: unknown }>(apiKey, `/incidents/${id}`, body);
  return { incident_id: id, status: "resolved", raw: data.incident };
}

export async function pagerduty_list_services(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const query: Record<string, string> = {};
  if (args.query) query.query = String(args.query);
  if (args.limit) query.limit = String(args.limit);

  const data = await pdGet<{ services: unknown[]; total: number }>(apiKey, "/services", query);
  return {
    total: data.total,
    count: data.services.length,
    services: data.services,
  };
}

export async function pagerduty_list_oncalls(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const query: Record<string, string> = {};
  if (args.schedule_ids) query["schedule_ids[]"] = String(args.schedule_ids);
  if (args.user_ids) query["user_ids[]"] = String(args.user_ids);

  const data = await pdGet<{ oncalls: unknown[] }>(apiKey, "/oncalls", query);
  return {
    count: data.oncalls.length,
    oncalls: data.oncalls,
  };
}
