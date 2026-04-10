// DeepL Translation API integration for the UnClick MCP server.
// Uses the DeepL REST API via fetch - no external dependencies.
// Users must supply an auth key from deepl.com. Free keys end with :fx.

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireKey(args: Record<string, unknown>): { key: string; base: string } {
  const key = String(args.auth_key ?? "").trim();
  if (!key) throw new Error("auth_key is required. Get one at deepl.com/pro-api. Free keys end with :fx.");
  // Free tier uses api-free.deepl.com, paid uses api.deepl.com
  const base = key.endsWith(":fx") ? "https://api-free.deepl.com/v2" : "https://api.deepl.com/v2";
  return { key, base };
}

async function dlPost<T>(key: string, base: string, path: string, body: Record<string, string | string[]>): Promise<T> {
  const form = new URLSearchParams();
  Object.entries(body).forEach(([k, v]) => {
    if (Array.isArray(v)) v.forEach((item) => form.append(k, item));
    else form.set(k, v);
  });
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "DeepL-Auth-Key": key,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.message as string) ?? `HTTP ${res.status}`;
    throw new Error(`DeepL error (${res.status}): ${msg}`);
  }
  return data as T;
}

async function dlGet<T>(key: string, base: string, path: string): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    headers: { "DeepL-Auth-Key": key },
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.message as string) ?? `HTTP ${res.status}`;
    throw new Error(`DeepL error (${res.status}): ${msg}`);
  }
  return data as T;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function deeplTranslateText(args: Record<string, unknown>): Promise<unknown> {
  const { key, base } = requireKey(args);
  const targetLang = String(args.target_lang ?? "").trim().toUpperCase();
  if (!targetLang) throw new Error("target_lang is required (e.g. EN-US, DE, FR, JA).");

  let texts: string[];
  if (Array.isArray(args.text)) {
    texts = args.text.map(String);
  } else if (typeof args.text === "string" && args.text.trim()) {
    texts = [args.text.trim()];
  } else {
    throw new Error("text is required (a string or array of strings to translate).");
  }
  if (texts.length > 50) throw new Error("Maximum 50 texts per call.");

  const body: Record<string, string | string[]> = {
    text: texts,
    target_lang: targetLang,
  };
  if (args.source_lang) body.source_lang = String(args.source_lang).toUpperCase();
  if (args.formality)   body.formality   = String(args.formality);
  if (args.preserve_formatting !== undefined) body.preserve_formatting = args.preserve_formatting ? "1" : "0";
  if (args.tag_handling) body.tag_handling = String(args.tag_handling);

  const data = await dlPost<{ translations: Array<{ detected_source_language: string; text: string }> }>(key, base, "/translate", body);
  return {
    target_lang: targetLang,
    translations: data.translations.map((t) => ({
      detected_source_language: t.detected_source_language,
      text: t.text,
    })),
  };
}

export async function deeplGetUsage(args: Record<string, unknown>): Promise<unknown> {
  const { key, base } = requireKey(args);
  return dlGet(key, base, "/usage");
}

export async function deeplListLanguages(args: Record<string, unknown>): Promise<unknown> {
  const { key, base } = requireKey(args);
  const type = String(args.type ?? "target");
  const res = await fetch(`${base}/languages?type=${encodeURIComponent(type)}`, {
    headers: { "DeepL-Auth-Key": key },
  });
  const data = await res.json() as unknown[];
  if (!res.ok) throw new Error(`DeepL error (${res.status})`);
  return { type, count: data.length, languages: data };
}

export async function deeplTranslateDocument(args: Record<string, unknown>): Promise<unknown> {
  const { key, base } = requireKey(args);
  const documentUrl = String(args.document_url ?? "").trim();
  const targetLang  = String(args.target_lang ?? "").trim().toUpperCase();
  if (!documentUrl) throw new Error("document_url is required (publicly accessible URL of the document to translate).");
  if (!targetLang)  throw new Error("target_lang is required.");

  // Fetch the document
  const docRes = await fetch(documentUrl);
  if (!docRes.ok) throw new Error(`Failed to fetch document_url: HTTP ${docRes.status}`);
  const docBlob = await docRes.blob();
  const filename = args.filename ? String(args.filename) : documentUrl.split("/").pop() ?? "document.pdf";

  const form = new FormData();
  form.append("file", docBlob, filename);
  form.append("target_lang", targetLang);
  if (args.source_lang) form.append("source_lang", String(args.source_lang).toUpperCase());
  if (args.formality)   form.append("formality", String(args.formality));

  const uploadRes = await fetch(`${base}/document`, {
    method: "POST",
    headers: { "DeepL-Auth-Key": key },
    body: form,
  });
  const uploadData = await uploadRes.json() as { document_id?: string; document_key?: string; message?: string };
  if (!uploadRes.ok) throw new Error(`DeepL document upload error (${uploadRes.status}): ${uploadData.message ?? "unknown error"}`);

  return {
    document_id: uploadData.document_id,
    document_key: uploadData.document_key,
    target_lang: targetLang,
    note: "Use the document_id and document_key to poll /document/{document_id} for status and download the result.",
  };
}
