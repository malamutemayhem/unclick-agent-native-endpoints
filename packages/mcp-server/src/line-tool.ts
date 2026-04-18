// LINE Messaging API integration for the UnClick MCP server.
// Uses the official LINE Messaging API via fetch - no external dependencies.
// Users must create a LINE channel and obtain a Channel Access Token.

const LINE_API_BASE = "https://api.line.me/v2/bot";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

interface LineGroupSummary {
  groupId: string;
  groupName: string;
  pictureUrl?: string;
}

interface LineSendResponse {
  sentMessages?: Array<{ id: string; quoteToken?: string }>;
}

// ─── API helper ───────────────────────────────────────────────────────────────

async function linePost<T>(
  token: string,
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${LINE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  // LINE returns 200 for success; error bodies have message field
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(text); } catch { /* empty response is fine for 200 */ }

  if (!res.ok) {
    const msg = (data.message as string) ?? `HTTP ${res.status}`;
    const detail = (data.details as Array<{ message: string }> | undefined)
      ?.map((d) => d.message)
      .join("; ");
    throw new Error(`LINE API error: ${msg}${detail ? ` - ${detail}` : ""}`);
  }

  return data as T;
}

async function lineGet<T>(
  token: string,
  path: string
): Promise<T> {
  const res = await fetch(`${LINE_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(text); } catch { /* empty */ }

  if (!res.ok) {
    const msg = (data.message as string) ?? `HTTP ${res.status}`;
    throw new Error(`LINE API error: ${msg}`);
  }

  return data as T;
}

// ─── Token validation ─────────────────────────────────────────────────────────

function requireToken(token: unknown): string {
  const t = String(token ?? "").trim();
  if (!t) throw new Error("channel_access_token is required. Create a LINE channel at developers.line.biz.");
  return t;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function lineSendMessage(args: Record<string, unknown>): Promise<unknown> {
  const token = requireToken(args.channel_access_token);
  const to = String(args.to ?? "").trim();
  if (!to) throw new Error("to is required (user ID, group ID, or room ID).");
  const message = String(args.message ?? "").trim();
  if (!message) throw new Error("message is required.");

  const result = await linePost<LineSendResponse>(token, "/message/push", {
    to,
    messages: [{ type: "text", text: message }],
  });

  return {
    success: true,
    to,
    message,
    sentMessages: result.sentMessages ?? [],
  };
}

export async function lineSendFlexMessage(args: Record<string, unknown>): Promise<unknown> {
  const token = requireToken(args.channel_access_token);
  const to = String(args.to ?? "").trim();
  if (!to) throw new Error("to is required.");
  const altText = String(args.alt_text ?? "").trim();
  if (!altText) throw new Error("alt_text is required (fallback text for notifications).");

  let contents: unknown;
  if (typeof args.contents === "string") {
    try { contents = JSON.parse(args.contents); }
    catch { throw new Error("contents must be valid JSON (a Flex Message container object)."); }
  } else if (args.contents && typeof args.contents === "object") {
    contents = args.contents;
  } else {
    throw new Error("contents is required (Flex Message container as JSON object or string).");
  }

  const result = await linePost<LineSendResponse>(token, "/message/push", {
    to,
    messages: [{ type: "flex", altText, contents }],
  });

  return {
    success: true,
    to,
    alt_text: altText,
    sentMessages: result.sentMessages ?? [],
  };
}

export async function lineGetProfile(args: Record<string, unknown>): Promise<unknown> {
  const token = requireToken(args.channel_access_token);
  const userId = String(args.user_id ?? "").trim();
  if (!userId) throw new Error("user_id is required.");

  const profile = await lineGet<LineProfile>(token, `/profile/${encodeURIComponent(userId)}`);

  return {
    user_id: profile.userId,
    display_name: profile.displayName,
    picture_url: profile.pictureUrl ?? null,
    status_message: profile.statusMessage ?? null,
  };
}

export async function lineGetGroupSummary(args: Record<string, unknown>): Promise<unknown> {
  const token = requireToken(args.channel_access_token);
  const groupId = String(args.group_id ?? "").trim();
  if (!groupId) throw new Error("group_id is required.");

  const summary = await lineGet<LineGroupSummary>(token, `/group/${encodeURIComponent(groupId)}/summary`);

  return {
    group_id: summary.groupId,
    group_name: summary.groupName,
    picture_url: summary.pictureUrl ?? null,
  };
}

export async function lineReplyMessage(args: Record<string, unknown>): Promise<unknown> {
  const token = requireToken(args.channel_access_token);
  const replyToken = String(args.reply_token ?? "").trim();
  if (!replyToken) throw new Error("reply_token is required (obtained from a webhook event).");

  // messages can be a JSON string array or array of message objects
  let messages: unknown[];
  if (Array.isArray(args.messages)) {
    messages = args.messages;
  } else if (typeof args.messages === "string") {
    try { messages = JSON.parse(args.messages); }
    catch { throw new Error("messages must be a JSON array of message objects."); }
  } else if (args.message) {
    // Convenience: single text message via 'message' param
    messages = [{ type: "text", text: String(args.message) }];
  } else {
    throw new Error("messages is required (array of LINE message objects, max 5).");
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("messages must be a non-empty array.");
  }
  if (messages.length > 5) throw new Error("LINE reply allows a maximum of 5 messages.");

  const result = await linePost<LineSendResponse>(token, "/message/reply", {
    replyToken,
    messages,
  });

  return {
    success: true,
    reply_token: replyToken,
    message_count: messages.length,
    sentMessages: result.sentMessages ?? [],
  };
}

export async function lineBroadcast(args: Record<string, unknown>): Promise<unknown> {
  const token = requireToken(args.channel_access_token);
  const message = String(args.message ?? "").trim();
  if (!message) throw new Error("message is required.");

  await linePost<Record<string, unknown>>(token, "/message/broadcast", {
    messages: [{ type: "text", text: message }],
  });

  return {
    success: true,
    message,
    note: "Broadcast sent to all users who have followed your LINE Official Account.",
  };
}
