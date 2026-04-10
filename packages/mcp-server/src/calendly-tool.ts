// Calendly scheduling and event management API.
// Docs: https://developer.calendly.com/api-docs
// Auth: CALENDLY_API_KEY (Personal Access Token, Bearer)
// Base: https://api.calendly.com

const CALENDLY_BASE = "https://api.calendly.com";

function getApiKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.CALENDLY_API_KEY ?? "").trim();
  if (!key) throw new Error("api_key is required (or set CALENDLY_API_KEY env var).");
  return key;
}

async function calendlyGet(
  apiKey: string,
  path: string,
  params?: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${CALENDLY_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });
  if (res.status === 401) throw new Error("Invalid Calendly API key.");
  if (res.status === 403) throw new Error("Calendly: access forbidden.");
  if (res.status === 404) throw new Error(`Calendly: resource not found at ${path}.`);
  if (res.status === 429) throw new Error("Calendly rate limit exceeded.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Calendly HTTP ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<unknown>;
}

// get_calendly_user
export async function getCalendlyUser(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const json = await calendlyGet(apiKey, "/users/me") as Record<string, unknown>;
    const r = json.resource as Record<string, unknown> | undefined;
    return {
      uri: r?.uri,
      name: r?.name,
      email: r?.email,
      timezone: r?.timezone,
      scheduling_url: r?.scheduling_url,
      created_at: r?.created_at,
      current_organization: r?.current_organization,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// list_calendly_event_types
export async function listCalendlyEventTypes(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    // Resolve user URI first if not provided
    let userUri = String(args.user_uri ?? "").trim();
    if (!userUri) {
      const me = await calendlyGet(apiKey, "/users/me") as Record<string, unknown>;
      userUri = String((me.resource as Record<string, unknown>)?.uri ?? "");
    }
    const params: Record<string, string> = { user: userUri };
    if (args.active !== undefined) params.active = String(args.active);
    if (args.count) params.count = String(args.count);

    const json = await calendlyGet(apiKey, "/event_types", params) as Record<string, unknown>;
    const collection = (json.collection ?? []) as Array<Record<string, unknown>>;
    return {
      count: collection.length,
      event_types: collection.map((e) => ({
        uri: e.uri,
        name: e.name,
        slug: e.slug,
        active: e.active,
        duration: e.duration,
        kind: e.kind,
        scheduling_url: e.scheduling_url,
        description_plain: e.description_plain,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// list_calendly_events
export async function listCalendlyEvents(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    let userUri = String(args.user_uri ?? "").trim();
    if (!userUri) {
      const me = await calendlyGet(apiKey, "/users/me") as Record<string, unknown>;
      userUri = String((me.resource as Record<string, unknown>)?.uri ?? "");
    }
    const params: Record<string, string> = { user: userUri };
    if (args.status) params.status = String(args.status);
    if (args.min_start_time) params.min_start_time = String(args.min_start_time);
    if (args.max_start_time) params.max_start_time = String(args.max_start_time);
    if (args.count) params.count = String(args.count);
    if (args.sort) params.sort = String(args.sort);

    const json = await calendlyGet(apiKey, "/scheduled_events", params) as Record<string, unknown>;
    const collection = (json.collection ?? []) as Array<Record<string, unknown>>;
    return {
      count: collection.length,
      events: collection.map((e) => ({
        uri: e.uri,
        name: e.name,
        status: e.status,
        start_time: e.start_time,
        end_time: e.end_time,
        event_type: e.event_type,
        location: e.location,
        created_at: e.created_at,
        updated_at: e.updated_at,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// get_calendly_event
export async function getCalendlyEvent(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const eventUuid = String(args.event_uuid ?? "").trim();
    if (!eventUuid) return { error: "event_uuid is required." };
    const json = await calendlyGet(apiKey, `/scheduled_events/${eventUuid}`) as Record<string, unknown>;
    return json.resource;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// list_calendly_invitees
export async function listCalendlyInvitees(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const eventUuid = String(args.event_uuid ?? "").trim();
    if (!eventUuid) return { error: "event_uuid is required." };
    const params: Record<string, string> = {};
    if (args.status) params.status = String(args.status);
    if (args.count) params.count = String(args.count);

    const json = await calendlyGet(apiKey, `/scheduled_events/${eventUuid}/invitees`, params) as Record<string, unknown>;
    const collection = (json.collection ?? []) as Array<Record<string, unknown>>;
    return {
      count: collection.length,
      invitees: collection.map((i) => ({
        uri: i.uri,
        email: i.email,
        name: i.name,
        status: i.status,
        timezone: i.timezone,
        created_at: i.created_at,
        cancel_url: i.cancel_url,
        reschedule_url: i.reschedule_url,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
