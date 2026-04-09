// WhatsApp Business Cloud API integration for the UnClick MCP server.
// Uses the WhatsApp Cloud API via fetch - no external dependencies.
// Users must supply a Bearer token and phone number ID from Meta for Developers.

const WA_API_BASE = "https://graph.facebook.com/v19.0";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WaMessageResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string; message_status?: string }>;
}

interface WaMediaResponse {
  id: string;
  url?: string;
  mime_type?: string;
  sha256?: string;
  file_size?: number;
  messaging_product?: string;
}

// ─── Auth validation ──────────────────────────────────────────────────────────

function requireAuth(args: Record<string, unknown>): { token: string; phoneNumberId: string } {
  const token = String(args.bearer_token ?? "").trim();
  const phoneNumberId = String(args.phone_number_id ?? "").trim();
  if (!token) throw new Error("bearer_token is required. Get it from Meta for Developers.");
  if (!phoneNumberId) throw new Error("phone_number_id is required. Find it in your Meta Business account.");
  return { token, phoneNumberId };
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function waPost<T>(token: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${WA_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as Record<string, unknown> | undefined;
    const msg = err?.message ?? `HTTP ${res.status}`;
    const code = err?.code ? ` (code ${err.code})` : "";
    throw new Error(`WhatsApp API error${code}: ${msg}`);
  }
  return data as T;
}

async function waGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${WA_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as Record<string, unknown> | undefined;
    const msg = err?.message ?? `HTTP ${res.status}`;
    throw new Error(`WhatsApp API error: ${msg}`);
  }
  return data as T;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function whatsappSendText(args: Record<string, unknown>): Promise<unknown> {
  const { token, phoneNumberId } = requireAuth(args);
  const to = String(args.to ?? "").trim();
  const body = String(args.body ?? "").trim();
  if (!to) throw new Error("to is required (recipient phone number in E.164 format).");
  if (!body) throw new Error("body is required (message text).");

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body, preview_url: args.preview_url === true },
  };

  const result = await waPost<WaMessageResponse>(token, `/${phoneNumberId}/messages`, payload);
  return {
    success: true,
    message_id: result.messages[0]?.id ?? null,
    wa_id: result.contacts[0]?.wa_id ?? to,
    to,
  };
}

export async function whatsappSendTemplate(args: Record<string, unknown>): Promise<unknown> {
  const { token, phoneNumberId } = requireAuth(args);
  const to = String(args.to ?? "").trim();
  const templateName = String(args.template_name ?? "").trim();
  const language = String(args.language ?? "en_US").trim();
  if (!to) throw new Error("to is required.");
  if (!templateName) throw new Error("template_name is required.");

  let components: unknown[] = [];
  if (args.components) {
    if (typeof args.components === "string") {
      try { components = JSON.parse(args.components); }
      catch { throw new Error("components must be valid JSON (array of template component objects)."); }
    } else if (Array.isArray(args.components)) {
      components = args.components;
    }
  }

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      components: components.length > 0 ? components : undefined,
    },
  };

  const result = await waPost<WaMessageResponse>(token, `/${phoneNumberId}/messages`, payload);
  return {
    success: true,
    message_id: result.messages[0]?.id ?? null,
    wa_id: result.contacts[0]?.wa_id ?? to,
    template_name: templateName,
    to,
  };
}

export async function whatsappSendMedia(args: Record<string, unknown>): Promise<unknown> {
  const { token, phoneNumberId } = requireAuth(args);
  const to = String(args.to ?? "").trim();
  const mediaType = String(args.media_type ?? "").toLowerCase().trim();
  if (!to) throw new Error("to is required.");

  const validTypes = ["image", "video", "audio", "document", "sticker"];
  if (!validTypes.includes(mediaType)) {
    throw new Error(`media_type must be one of: ${validTypes.join(", ")}.`);
  }

  const mediaId = String(args.media_id ?? "").trim();
  const mediaLink = String(args.media_link ?? "").trim();
  if (!mediaId && !mediaLink) throw new Error("Either media_id or media_link is required.");

  const mediaObject: Record<string, unknown> = {};
  if (mediaId) mediaObject.id = mediaId;
  if (mediaLink) mediaObject.link = mediaLink;
  if (args.caption && mediaType !== "audio" && mediaType !== "sticker") {
    mediaObject.caption = String(args.caption);
  }
  if (args.filename && mediaType === "document") {
    mediaObject.filename = String(args.filename);
  }

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to,
    type: mediaType,
    [mediaType]: mediaObject,
  };

  const result = await waPost<WaMessageResponse>(token, `/${phoneNumberId}/messages`, payload);
  return {
    success: true,
    message_id: result.messages[0]?.id ?? null,
    wa_id: result.contacts[0]?.wa_id ?? to,
    media_type: mediaType,
    to,
  };
}

export async function whatsappGetMedia(args: Record<string, unknown>): Promise<unknown> {
  const token = String(args.bearer_token ?? "").trim();
  if (!token) throw new Error("bearer_token is required.");
  const mediaId = String(args.media_id ?? "").trim();
  if (!mediaId) throw new Error("media_id is required.");

  const result = await waGet<WaMediaResponse>(token, `/${mediaId}`);
  return {
    id: result.id,
    url: result.url ?? null,
    mime_type: result.mime_type ?? null,
    file_size: result.file_size ?? null,
    sha256: result.sha256 ?? null,
  };
}

export async function whatsappUploadMedia(args: Record<string, unknown>): Promise<unknown> {
  const { token, phoneNumberId } = requireAuth(args);
  const mediaUrl = String(args.media_url ?? "").trim();
  const mimeType = String(args.mime_type ?? "").trim();
  if (!mediaUrl) throw new Error("media_url is required (URL to fetch the media from).");
  if (!mimeType) throw new Error("mime_type is required (e.g. image/jpeg, video/mp4).");

  // Fetch the media and upload it as a blob
  const mediaRes = await fetch(mediaUrl);
  if (!mediaRes.ok) throw new Error(`Failed to fetch media from URL: HTTP ${mediaRes.status}`);
  const mediaBlob = await mediaRes.blob();

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mimeType);
  form.append("file", mediaBlob, args.filename ? String(args.filename) : "upload");

  const res = await fetch(`${WA_API_BASE}/${phoneNumberId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as Record<string, unknown> | undefined;
    throw new Error(`WhatsApp upload error: ${err?.message ?? `HTTP ${res.status}`}`);
  }
  return {
    success: true,
    media_id: data.id,
  };
}
