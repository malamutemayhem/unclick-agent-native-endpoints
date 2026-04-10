// Postmark Transactional Email API.
// Docs: https://postmarkapp.com/developer/api/overview
// Auth: X-Postmark-Server-Token header
// Base: https://api.postmarkapp.com

const POSTMARK_API_BASE = "https://api.postmarkapp.com";

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? "").trim();
  if (!key) throw new Error("api_key is required. Get your Server Token from account.postmarkapp.com.");
  return key;
}

async function pmGet<T>(apiKey: string, path: string, query?: Record<string, string>): Promise<T> {
  const url = new URL(`${POSTMARK_API_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: {
      "X-Postmark-Server-Token": apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.Message as string) ?? `HTTP ${res.status}`;
    throw new Error(`Postmark error (${res.status}): ${msg}`);
  }
  return data as T;
}

async function pmPost<T>(apiKey: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${POSTMARK_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "X-Postmark-Server-Token": apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.Message as string) ?? `HTTP ${res.status}`;
    throw new Error(`Postmark error (${res.status}): ${msg}`);
  }
  return data as T;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function postmark_send_email(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const from = String(args.from ?? "").trim();
  const to = String(args.to ?? "").trim();
  const subject = String(args.subject ?? "").trim();
  if (!from) throw new Error("from is required.");
  if (!to) throw new Error("to is required.");
  if (!subject) throw new Error("subject is required.");
  if (!args.html_body && !args.text_body) throw new Error("html_body or text_body is required.");

  const body: Record<string, unknown> = { From: from, To: to, Subject: subject };
  if (args.html_body) body.HtmlBody = String(args.html_body);
  if (args.text_body) body.TextBody = String(args.text_body);
  if (args.reply_to) body.ReplyTo = String(args.reply_to);
  if (args.cc) body.Cc = String(args.cc);
  if (args.bcc) body.Bcc = String(args.bcc);
  if (args.tag) body.Tag = String(args.tag);
  if (args.message_stream) body.MessageStream = String(args.message_stream);

  const data = await pmPost<Record<string, unknown>>(apiKey, "/email", body);
  return {
    message_id: data.MessageID,
    submitted_at: data.SubmittedAt,
    to: data.To,
    error_code: data.ErrorCode,
    message: data.Message,
  };
}

export async function postmark_send_batch(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const messages = args.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("messages must be a non-empty array of email objects.");
  }

  const data = await pmPost<unknown[]>(apiKey, "/email/batch", { Messages: messages });
  return {
    count: Array.isArray(data) ? data.length : 0,
    results: data,
  };
}

export async function postmark_get_delivery_stats(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  return pmGet<unknown>(apiKey, "/deliverystats");
}

export async function postmark_list_templates(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const query: Record<string, string> = {};
  if (args.count) query.Count = String(args.count);
  if (args.offset) query.Offset = String(args.offset);

  const data = await pmGet<{ Templates: unknown[]; TotalCount: number }>(
    apiKey, "/templates", query
  );
  return {
    total: data.TotalCount,
    count: data.Templates?.length ?? 0,
    templates: data.Templates ?? [],
  };
}

export async function postmark_get_template(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const id = String(args.template_id ?? "").trim();
  if (!id) throw new Error("template_id is required.");
  return pmGet<unknown>(apiKey, `/templates/${id}`);
}

export async function postmark_search_messages(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const query: Record<string, string> = {};
  if (args.count) query.count = String(args.count);
  if (args.offset) query.offset = String(args.offset);
  if (args.recipient) query.recipient = String(args.recipient);
  if (args.from_email) query.fromEmail = String(args.from_email);
  if (args.tag) query.tag = String(args.tag);
  if (args.status) query.status = String(args.status);

  const data = await pmGet<{ Messages: unknown[]; TotalCount: number }>(
    apiKey, "/messages/outbound", query
  );
  return {
    total: data.TotalCount,
    count: data.Messages?.length ?? 0,
    messages: data.Messages ?? [],
  };
}
