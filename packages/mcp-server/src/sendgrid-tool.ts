// SendGrid v3 API integration for the UnClick MCP server.
// Uses the SendGrid REST API via fetch - no external dependencies.
// Users must supply an API key from app.sendgrid.com.

const SG_BASE = "https://api.sendgrid.com/v3";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? "").trim();
  if (!key) throw new Error("api_key is required. Get one at app.sendgrid.com/settings/api-keys.");
  return key;
}

async function sgGet<T>(apiKey: string, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${SG_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (res.status === 204) return {} as T;
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const errs = data.errors as Array<{ message: string }> | undefined;
    const msg = errs?.[0]?.message ?? `HTTP ${res.status}`;
    throw new Error(`SendGrid error (${res.status}): ${msg}`);
  }
  return data as T;
}

async function sgPost<T>(apiKey: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${SG_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 202 || res.status === 204) return { success: true, status: res.status } as T;
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const errs = data.errors as Array<{ message: string }> | undefined;
    const msg = errs?.[0]?.message ?? `HTTP ${res.status}`;
    throw new Error(`SendGrid error (${res.status}): ${msg}`);
  }
  return data as T;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function sendgridSendEmail(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const to = String(args.to ?? "").trim();
  const from = String(args.from ?? "").trim();
  const subject = String(args.subject ?? "").trim();
  if (!to) throw new Error("to is required (recipient email address).");
  if (!from) throw new Error("from is required (sender email address).");
  if (!subject) throw new Error("subject is required.");
  if (!args.text && !args.html) throw new Error("Either text or html content is required.");

  const content: Array<{ type: string; value: string }> = [];
  if (args.text) content.push({ type: "text/plain", value: String(args.text) });
  if (args.html) content.push({ type: "text/html", value: String(args.html) });

  const body: Record<string, unknown> = {
    personalizations: [{ to: [{ email: to, name: args.to_name ? String(args.to_name) : undefined }] }],
    from: { email: from, name: args.from_name ? String(args.from_name) : undefined },
    subject,
    content,
  };
  if (args.template_id) body.template_id = String(args.template_id);
  if (args.reply_to) body.reply_to = { email: String(args.reply_to) };

  return sgPost(apiKey, "/mail/send", body);
}

export async function sendgridListTemplates(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const params: Record<string, string> = { generations: "dynamic" };
  if (args.page_size) params.page_size = String(Math.min(200, Math.max(1, Number(args.page_size))));
  return sgGet(apiKey, "/templates", params);
}

export async function sendgridGetTemplate(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const id = String(args.template_id ?? "").trim();
  if (!id) throw new Error("template_id is required.");
  return sgGet(apiKey, `/templates/${encodeURIComponent(id)}`);
}

export async function sendgridListContacts(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  return sgGet(apiKey, "/marketing/contacts");
}

export async function sendgridAddContact(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const email = String(args.email ?? "").trim();
  if (!email) throw new Error("email is required.");

  const contact: Record<string, unknown> = { email };
  if (args.first_name) contact.first_name = String(args.first_name);
  if (args.last_name) contact.last_name = String(args.last_name);
  if (args.phone_number) contact.phone_number = String(args.phone_number);

  const body: Record<string, unknown> = { contacts: [contact] };
  if (args.list_ids) body.list_ids = args.list_ids;

  return sgPost(apiKey, "/marketing/contacts", body);
}

export async function sendgridGetStats(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const startDate = String(args.start_date ?? new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]);
  const params: Record<string, string> = { start_date: startDate };
  if (args.end_date) params.end_date = String(args.end_date);
  if (args.aggregated_by) params.aggregated_by = String(args.aggregated_by);
  return sgGet(apiKey, "/stats", params);
}
