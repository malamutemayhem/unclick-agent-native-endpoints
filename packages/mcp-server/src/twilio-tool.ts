// Twilio REST API integration for the UnClick MCP server.
// Uses the Twilio REST API via fetch - no external dependencies.
// Users must supply their Account SID and Auth Token from the Twilio Console.

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TwilioMessage {
  sid: string;
  status: string;
  from: string;
  to: string;
  body: string;
  date_created: string;
  date_sent: string | null;
  direction: string;
  error_code: string | null;
  error_message: string | null;
  price: string | null;
  price_unit: string;
}

interface TwilioCall {
  sid: string;
  status: string;
  from: string;
  to: string;
  direction: string;
  duration: string;
  start_time: string | null;
  end_time: string | null;
  price: string | null;
  price_unit: string;
}

interface TwilioListResponse<T> {
  [key: string]: T[] | unknown;
  next_page_uri: string | null;
}

interface TwilioVerifyResponse {
  sid: string;
  service_sid: string;
  to: string;
  channel: string;
  status: string;
  valid: boolean;
}

interface TwilioVerifyCheckResponse {
  sid: string;
  to: string;
  channel: string;
  status: string;
  valid: boolean;
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

function requireAuth(args: Record<string, unknown>): { accountSid: string; authToken: string } {
  const accountSid = String(args.account_sid ?? "").trim();
  const authToken = String(args.auth_token ?? "").trim();
  if (!accountSid) throw new Error("account_sid is required. Find it at console.twilio.com.");
  if (!authToken) throw new Error("auth_token is required. Find it at console.twilio.com.");
  return { accountSid, authToken };
}

function basicAuth(accountSid: string, authToken: string): string {
  return "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function twilioPost<T>(
  accountSid: string,
  authToken: string,
  path: string,
  params: Record<string, string>
): Promise<T> {
  const url = `${TWILIO_API_BASE}/Accounts/${accountSid}${path}.json`;
  const body = new URLSearchParams(params).toString();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: basicAuth(accountSid, authToken),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const code = data.code ? ` (code ${data.code})` : "";
    throw new Error(`Twilio error${code}: ${data.message ?? `HTTP ${res.status}`}`);
  }
  return data as T;
}

async function twilioGet<T>(
  accountSid: string,
  authToken: string,
  path: string,
  query: Record<string, string> = {}
): Promise<T> {
  const qs = new URLSearchParams(query).toString();
  const url = `${TWILIO_API_BASE}/Accounts/${accountSid}${path}.json${qs ? `?${qs}` : ""}`;

  const res = await fetch(url, {
    headers: { Authorization: basicAuth(accountSid, authToken) },
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const code = data.code ? ` (code ${data.code})` : "";
    throw new Error(`Twilio error${code}: ${data.message ?? `HTTP ${res.status}`}`);
  }
  return data as T;
}

async function twilioVerifyPost<T>(
  accountSid: string,
  authToken: string,
  path: string,
  params: Record<string, string>
): Promise<T> {
  const url = `https://verify.twilio.com/v2${path}`;
  const body = new URLSearchParams(params).toString();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: basicAuth(accountSid, authToken),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const code = data.code ? ` (code ${data.code})` : "";
    throw new Error(`Twilio Verify error${code}: ${data.message ?? `HTTP ${res.status}`}`);
  }
  return data as T;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function twilioSendSms(args: Record<string, unknown>): Promise<unknown> {
  const { accountSid, authToken } = requireAuth(args);
  const to = String(args.to ?? "").trim();
  const from = String(args.from ?? "").trim();
  const body = String(args.body ?? "").trim();
  if (!to) throw new Error("to is required (E.164 phone number, e.g. +61400000000).");
  if (!from) throw new Error("from is required (your Twilio phone number or messaging service SID).");
  if (!body) throw new Error("body is required (message text).");

  const params: Record<string, string> = { To: to, From: from, Body: body };
  if (args.status_callback) params.StatusCallback = String(args.status_callback);

  const msg = await twilioPost<TwilioMessage>(accountSid, authToken, "/Messages", params);
  return {
    success: true,
    sid: msg.sid,
    status: msg.status,
    to: msg.to,
    from: msg.from,
    body: msg.body,
    date_created: msg.date_created,
  };
}

export async function twilioListMessages(args: Record<string, unknown>): Promise<unknown> {
  const { accountSid, authToken } = requireAuth(args);
  const query: Record<string, string> = {};
  if (args.to) query.To = String(args.to);
  if (args.from) query.From = String(args.from);
  if (args.date_sent) query.DateSent = String(args.date_sent);
  const pageSize = Math.min(100, Math.max(1, Number(args.page_size ?? 20)));
  query.PageSize = String(pageSize);

  const data = await twilioGet<TwilioListResponse<TwilioMessage>>(accountSid, authToken, "/Messages", query);
  const messages = (data.messages as TwilioMessage[] | undefined) ?? [];
  return {
    count: messages.length,
    messages: messages.map((m) => ({
      sid: m.sid,
      status: m.status,
      from: m.from,
      to: m.to,
      body: m.body,
      direction: m.direction,
      date_created: m.date_created,
      date_sent: m.date_sent,
      error_code: m.error_code,
    })),
    next_page_uri: data.next_page_uri ?? null,
  };
}

export async function twilioGetMessage(args: Record<string, unknown>): Promise<unknown> {
  const { accountSid, authToken } = requireAuth(args);
  const messageSid = String(args.message_sid ?? "").trim();
  if (!messageSid) throw new Error("message_sid is required.");

  const msg = await twilioGet<TwilioMessage>(accountSid, authToken, `/Messages/${encodeURIComponent(messageSid)}`);
  return {
    sid: msg.sid,
    status: msg.status,
    from: msg.from,
    to: msg.to,
    body: msg.body,
    direction: msg.direction,
    date_created: msg.date_created,
    date_sent: msg.date_sent,
    error_code: msg.error_code,
    error_message: msg.error_message,
    price: msg.price,
    price_unit: msg.price_unit,
  };
}

export async function twilioMakeCall(args: Record<string, unknown>): Promise<unknown> {
  const { accountSid, authToken } = requireAuth(args);
  const to = String(args.to ?? "").trim();
  const from = String(args.from ?? "").trim();
  const twiml = String(args.twiml ?? "").trim();
  const url = String(args.url ?? "").trim();
  if (!to) throw new Error("to is required (E.164 phone number).");
  if (!from) throw new Error("from is required (your Twilio phone number).");
  if (!twiml && !url) throw new Error("Either twiml or url is required to specify call instructions.");

  const params: Record<string, string> = { To: to, From: from };
  if (twiml) params.Twiml = twiml;
  if (url) params.Url = url;
  if (args.status_callback) params.StatusCallback = String(args.status_callback);

  const call = await twilioPost<TwilioCall>(accountSid, authToken, "/Calls", params);
  return {
    success: true,
    sid: call.sid,
    status: call.status,
    to: call.to,
    from: call.from,
    direction: call.direction,
  };
}

export async function twilioListCalls(args: Record<string, unknown>): Promise<unknown> {
  const { accountSid, authToken } = requireAuth(args);
  const query: Record<string, string> = {};
  if (args.to) query.To = String(args.to);
  if (args.from) query.From = String(args.from);
  if (args.status) query.Status = String(args.status);
  const pageSize = Math.min(100, Math.max(1, Number(args.page_size ?? 20)));
  query.PageSize = String(pageSize);

  const data = await twilioGet<TwilioListResponse<TwilioCall>>(accountSid, authToken, "/Calls", query);
  const calls = (data.calls as TwilioCall[] | undefined) ?? [];
  return {
    count: calls.length,
    calls: calls.map((c) => ({
      sid: c.sid,
      status: c.status,
      from: c.from,
      to: c.to,
      direction: c.direction,
      duration: c.duration,
      start_time: c.start_time,
      end_time: c.end_time,
      price: c.price,
    })),
    next_page_uri: data.next_page_uri ?? null,
  };
}

export async function twilioSendVerify(args: Record<string, unknown>): Promise<unknown> {
  const { accountSid, authToken } = requireAuth(args);
  const serviceSid = String(args.service_sid ?? "").trim();
  const to = String(args.to ?? "").trim();
  const channel = String(args.channel ?? "sms").toLowerCase();
  if (!serviceSid) throw new Error("service_sid is required (Twilio Verify Service SID).");
  if (!to) throw new Error("to is required (E.164 phone number).");

  const validChannels = ["sms", "call", "email", "whatsapp"];
  if (!validChannels.includes(channel)) {
    throw new Error(`Invalid channel "${channel}". Valid: ${validChannels.join(", ")}.`);
  }

  const result = await twilioVerifyPost<TwilioVerifyResponse>(
    accountSid, authToken,
    `/Services/${encodeURIComponent(serviceSid)}/Verifications`,
    { To: to, Channel: channel }
  );
  return {
    success: true,
    sid: result.sid,
    to: result.to,
    channel: result.channel,
    status: result.status,
  };
}

export async function twilioCheckVerify(args: Record<string, unknown>): Promise<unknown> {
  const { accountSid, authToken } = requireAuth(args);
  const serviceSid = String(args.service_sid ?? "").trim();
  const to = String(args.to ?? "").trim();
  const code = String(args.code ?? "").trim();
  if (!serviceSid) throw new Error("service_sid is required.");
  if (!to) throw new Error("to is required (E.164 phone number).");
  if (!code) throw new Error("code is required (the OTP entered by the user).");

  const result = await twilioVerifyPost<TwilioVerifyCheckResponse>(
    accountSid, authToken,
    `/Services/${encodeURIComponent(serviceSid)}/VerificationCheck`,
    { To: to, Code: code }
  );
  return {
    valid: result.valid,
    status: result.status,
    to: result.to,
    channel: result.channel,
  };
}
