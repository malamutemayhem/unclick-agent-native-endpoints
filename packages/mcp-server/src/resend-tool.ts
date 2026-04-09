// Resend transactional email API.
// Docs: https://resend.com/docs/api-reference
// Auth: RESEND_API_KEY (Bearer token)
// Base: https://api.resend.com/

const RESEND_BASE = "https://api.resend.com";

function getApiKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.RESEND_API_KEY ?? "").trim();
  if (!key) throw new Error("api_key is required (or set RESEND_API_KEY env var).");
  return key;
}

async function resendGet(
  apiKey: string,
  path: string
): Promise<Record<string, unknown>> {
  const res = await fetch(`${RESEND_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (res.status === 401) throw new Error("Invalid Resend API key.");
  if (res.status === 404) throw new Error(`Resend: resource not found at ${path}.`);
  if (res.status === 429) throw new Error("Resend rate limit exceeded.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend HTTP ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

async function resendPost(
  apiKey: string,
  path: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(`${RESEND_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Invalid Resend API key.");
  if (res.status === 422) {
    const b = await res.text().catch(() => "");
    throw new Error(`Resend validation error: ${b || res.statusText}`);
  }
  if (res.status === 429) throw new Error("Resend rate limit exceeded.");
  if (!res.ok) {
    const b = await res.text().catch(() => "");
    throw new Error(`Resend HTTP ${res.status}: ${b || res.statusText}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

// send_email_resend
export async function sendEmailResend(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const from = String(args.from ?? "").trim();
    const to = args.to;
    const subject = String(args.subject ?? "").trim();
    if (!from) return { error: "from is required (e.g. 'you@yourdomain.com')." };
    if (!to) return { error: "to is required (email string or array of emails)." };
    if (!subject) return { error: "subject is required." };
    if (!args.html && !args.text) return { error: "html or text body is required." };

    const body: Record<string, unknown> = { from, to, subject };
    if (args.html) body.html = String(args.html);
    if (args.text) body.text = String(args.text);
    if (args.reply_to) body.reply_to = args.reply_to;
    if (args.cc) body.cc = args.cc;
    if (args.bcc) body.bcc = args.bcc;
    if (args.tags) body.tags = args.tags;

    const data = await resendPost(apiKey, "/emails", body);
    return {
      id: data.id,
      sent: true,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// get_email_resend
export async function getEmailResend(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const id = String(args.id ?? "").trim();
    if (!id) return { error: "id is required." };
    const data = await resendGet(apiKey, `/emails/${id}`);
    return {
      id: data.id,
      from: data.from,
      to: data.to,
      subject: data.subject,
      status: data.last_event,
      created_at: data.created_at,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// list_domains_resend
export async function listDomainsResend(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const data = await resendGet(apiKey, "/domains");
    const domains = (data.data as Array<Record<string, unknown>>) ?? [];
    return {
      count: domains.length,
      domains: domains.map((d) => ({
        id: d.id,
        name: d.name,
        status: d.status,
        region: d.region,
        created_at: d.created_at,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
