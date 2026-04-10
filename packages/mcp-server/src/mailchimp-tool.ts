// Mailchimp Marketing API integration for the UnClick MCP server.
// Uses the Mailchimp REST API via fetch - no external dependencies.
// Users must supply an API key from mailchimp.com (format: key-dc e.g. abc123-us21).

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireKey(args: Record<string, unknown>): { key: string; dc: string } {
  const key = String(args.api_key ?? "").trim();
  if (!key) throw new Error("api_key is required. Get one at mailchimp.com/account/api-keys. Format: key-dc (e.g. abc123-us21).");
  const dc = key.split("-").pop() ?? "";
  if (!dc || dc === key) throw new Error("api_key must include the datacenter suffix (e.g. abc123-us21).");
  return { key, dc };
}

function base(dc: string): string {
  return `https://${dc}.api.mailchimp.com/3.0`;
}

async function mcGet<T>(key: string, dc: string, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${base(dc)}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Basic ${Buffer.from(`anystring:${key}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const detail = (data.detail as string) ?? (data.title as string) ?? `HTTP ${res.status}`;
    throw new Error(`Mailchimp error (${res.status}): ${detail}`);
  }
  return data as T;
}

async function mcPost<T>(key: string, dc: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${base(dc)}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`anystring:${key}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const detail = (data.detail as string) ?? (data.title as string) ?? `HTTP ${res.status}`;
    throw new Error(`Mailchimp error (${res.status}): ${detail}`);
  }
  return data as T;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function mailchimpListAudiences(args: Record<string, unknown>): Promise<unknown> {
  const { key, dc } = requireKey(args);
  const count = String(Math.min(1000, Math.max(1, Number(args.count ?? 10))));
  const data = await mcGet<{ lists: unknown[]; total_items: number }>(key, dc, "/lists", { count, fields: "lists.id,lists.name,lists.stats,lists.status,total_items" });
  return { total: data.total_items, audiences: data.lists };
}

export async function mailchimpListCampaigns(args: Record<string, unknown>): Promise<unknown> {
  const { key, dc } = requireKey(args);
  const count = String(Math.min(1000, Math.max(1, Number(args.count ?? 10))));
  const params: Record<string, string> = { count };
  if (args.status) params.status = String(args.status);
  if (args.list_id) params.list_id = String(args.list_id);
  const data = await mcGet<{ campaigns: unknown[]; total_items: number }>(key, dc, "/campaigns", params);
  return { total: data.total_items, campaigns: data.campaigns };
}

export async function mailchimpGetCampaign(args: Record<string, unknown>): Promise<unknown> {
  const { key, dc } = requireKey(args);
  const id = String(args.campaign_id ?? "").trim();
  if (!id) throw new Error("campaign_id is required.");
  return mcGet(key, dc, `/campaigns/${encodeURIComponent(id)}`);
}

export async function mailchimpCreateCampaign(args: Record<string, unknown>): Promise<unknown> {
  const { key, dc } = requireKey(args);
  const type = String(args.type ?? "regular");
  const listId = String(args.list_id ?? "").trim();
  if (!listId) throw new Error("list_id is required.");
  const subject = String(args.subject_line ?? "").trim();
  if (!subject) throw new Error("subject_line is required.");

  const body: Record<string, unknown> = {
    type,
    recipients: { list_id: listId },
    settings: {
      subject_line: subject,
      from_name: args.from_name ? String(args.from_name) : undefined,
      reply_to: args.reply_to ? String(args.reply_to) : undefined,
    },
  };
  return mcPost(key, dc, "/campaigns", body);
}

export async function mailchimpListMembers(args: Record<string, unknown>): Promise<unknown> {
  const { key, dc } = requireKey(args);
  const listId = String(args.list_id ?? "").trim();
  if (!listId) throw new Error("list_id is required.");
  const count = String(Math.min(1000, Math.max(1, Number(args.count ?? 10))));
  const params: Record<string, string> = { count };
  if (args.status) params.status = String(args.status);
  const data = await mcGet<{ members: unknown[]; total_items: number }>(key, dc, `/lists/${encodeURIComponent(listId)}/members`, params);
  return { total: data.total_items, members: data.members };
}

export async function mailchimpAddMember(args: Record<string, unknown>): Promise<unknown> {
  const { key, dc } = requireKey(args);
  const listId = String(args.list_id ?? "").trim();
  const email = String(args.email ?? "").trim();
  if (!listId) throw new Error("list_id is required.");
  if (!email) throw new Error("email is required.");

  const body: Record<string, unknown> = {
    email_address: email,
    status: String(args.status ?? "subscribed"),
  };
  if (args.first_name || args.last_name) {
    body.merge_fields = {
      FNAME: args.first_name ? String(args.first_name) : "",
      LNAME: args.last_name ? String(args.last_name) : "",
    };
  }
  return mcPost(key, dc, `/lists/${encodeURIComponent(listId)}/members`, body);
}

export async function mailchimpSearchMembers(args: Record<string, unknown>): Promise<unknown> {
  const { key, dc } = requireKey(args);
  const query = String(args.query ?? "").trim();
  if (!query) throw new Error("query is required.");
  const params: Record<string, string> = { query };
  if (args.list_id) params.list_id = String(args.list_id);
  const data = await mcGet<{ exact_matches: unknown; full_search: unknown }>(key, dc, "/search-members", params);
  return data;
}
