// ── Instapaper API tool ────────────────────────────────────────────────────────
// Wraps the Instapaper API v1 (https://www.instapaper.com/api/1/) via fetch.
// Auth: xAuth (OAuth 1.0a simplified flow). Requires INSTAPAPER_CONSUMER_KEY,
//   INSTAPAPER_CONSUMER_SECRET, INSTAPAPER_USERNAME, and INSTAPAPER_PASSWORD.
//   The tool exchanges credentials for an OAuth access token on first use
//   (xAuth: POST to /api/1/oauth/access_token).
//
// Credentials are auto-resolved via vault-bridge:
//   1. Inline args   (consumer_key, consumer_secret, username, password passed directly)
//   2. Env vars      UNCLICK_INSTAPAPER_CONSUMER_KEY, etc.
//   3. Local vault   keys "instapaper/consumer_key", etc.
//   4. Supabase      via UNCLICK_API_KEY + unclick.world/api/credentials
//
// No external dependencies.

import { resolveCredentials } from "./vault-bridge.js";

const INSTAPAPER_BASE = "https://www.instapaper.com/api/1";

// ── OAuth 1.0a xAuth helper ────────────────────────────────────────────────────
// Instapaper uses xAuth: trade username + password for an access token.
// This requires signing the request with HMAC-SHA1, which is available via
// Node's built-in crypto module.

import { createHmac } from "crypto";

function oauthSign(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret = ""
): string {
  const encoded = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const base = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(encoded),
  ].join("&");

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return createHmac("sha1", signingKey).update(base).digest("base64");
}

function buildOAuthHeader(
  consumerKey: string,
  consumerSecret: string,
  token: string,
  tokenSecret: string,
  method: string,
  url: string,
  extraParams: Record<string, string> = {}
): string {
  const nonce     = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key:     consumerKey,
    oauth_nonce:            nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp:        timestamp,
    oauth_token:            token,
    oauth_version:          "1.0",
  };

  const allParams = { ...oauthParams, ...extraParams };
  if (!token) delete allParams.oauth_token;

  const signature = oauthSign(method, url, allParams, consumerSecret, tokenSecret);
  oauthParams.oauth_signature = signature;
  if (!token) delete oauthParams.oauth_token;

  const headerParts = Object.entries(oauthParams)
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(", ");

  return `OAuth ${headerParts}`;
}

// ── Obtain access token via xAuth ──────────────────────────────────────────────

interface XAuthToken {
  oauth_token: string;
  oauth_token_secret: string;
}

async function getXAuthToken(
  consumerKey: string,
  consumerSecret: string,
  username: string,
  password: string
): Promise<XAuthToken | { error: string }> {
  const url = "https://www.instapaper.com/api/1/oauth/access_token";
  const method = "POST";

  const formParams: Record<string, string> = {
    x_auth_username:   username,
    x_auth_password:   password,
    x_auth_mode:       "client_auth",
  };

  const nonce     = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const allParams: Record<string, string> = {
    oauth_consumer_key:     consumerKey,
    oauth_nonce:            nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp:        timestamp,
    oauth_version:          "1.0",
    ...formParams,
  };

  const signature = oauthSign(method, url, allParams, consumerSecret);

  const oauthHeader = [
    `OAuth oauth_consumer_key="${encodeURIComponent(consumerKey)}"`,
    `oauth_nonce="${encodeURIComponent(nonce)}"`,
    `oauth_signature="${encodeURIComponent(signature)}"`,
    `oauth_signature_method="HMAC-SHA1"`,
    `oauth_timestamp="${timestamp}"`,
    `oauth_version="1.0"`,
  ].join(", ");

  const body = new URLSearchParams(formParams).toString();

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: oauthHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  } catch (err) {
    return { error: `Network error reaching Instapaper: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (response.status === 401) {
    return { error: "Instapaper authentication failed. Check your consumer key/secret and username/password." };
  }

  if (!response.ok) {
    return { error: `Instapaper xAuth error ${response.status}: ${response.statusText}` };
  }

  const text = await response.text();
  const parsed = Object.fromEntries(new URLSearchParams(text).entries());

  if (!parsed.oauth_token || !parsed.oauth_token_secret) {
    return { error: `Instapaper xAuth did not return tokens. Response: ${text}` };
  }

  return {
    oauth_token:        parsed.oauth_token,
    oauth_token_secret: parsed.oauth_token_secret,
  };
}

// ── Authenticated API call ─────────────────────────────────────────────────────

async function instapaperPost(
  consumerKey: string,
  consumerSecret: string,
  token: string,
  tokenSecret: string,
  path: string,
  formData: Record<string, string> = {}
): Promise<unknown> {
  const url    = `${INSTAPAPER_BASE}${path}`;
  const method = "POST";

  const nonce     = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const allParams: Record<string, string> = {
    oauth_consumer_key:     consumerKey,
    oauth_nonce:            nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp:        timestamp,
    oauth_token:            token,
    oauth_version:          "1.0",
    ...formData,
  };

  const signature = oauthSign(method, url, allParams, consumerSecret, tokenSecret);

  const oauthHeader = [
    `OAuth oauth_consumer_key="${encodeURIComponent(consumerKey)}"`,
    `oauth_nonce="${encodeURIComponent(nonce)}"`,
    `oauth_signature="${encodeURIComponent(signature)}"`,
    `oauth_signature_method="HMAC-SHA1"`,
    `oauth_timestamp="${timestamp}"`,
    `oauth_token="${encodeURIComponent(token)}"`,
    `oauth_version="1.0"`,
  ].join(", ");

  const body = new URLSearchParams(formData).toString();

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:  oauthHeader,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept:         "application/json",
      },
      body,
    });
  } catch (err) {
    return { error: `Network error reaching Instapaper API: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (response.status === 401) return { error: "Instapaper authentication failed. Re-check your credentials.", status: 401 };
  if (response.status === 404) return { error: "Instapaper resource not found.", status: 404 };

  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!response.ok) {
    return { error: `Instapaper API error ${response.status}: ${text}`, status: response.status };
  }

  return data;
}

// ── Auth helper ────────────────────────────────────────────────────────────────

interface InstapaperCreds {
  consumerKey:    string;
  consumerSecret: string;
  token:          string;
  tokenSecret:    string;
}

async function authenticate(resolved: Record<string, unknown>): Promise<InstapaperCreds | { error: string }> {
  const consumerKey    = String(resolved.consumer_key    ?? "").trim();
  const consumerSecret = String(resolved.consumer_secret ?? "").trim();
  const username       = String(resolved.username        ?? "").trim();
  const password       = String(resolved.password        ?? "");

  if (!consumerKey)    return { error: "consumer_key is required." };
  if (!consumerSecret) return { error: "consumer_secret is required." };
  if (!username)       return { error: "username is required." };

  const tokenResult = await getXAuthToken(consumerKey, consumerSecret, username, password);
  if ("error" in tokenResult) return tokenResult;

  return {
    consumerKey,
    consumerSecret,
    token:       tokenResult.oauth_token,
    tokenSecret: tokenResult.oauth_token_secret,
  };
}

// ── Action implementations ─────────────────────────────────────────────────────

async function getBookmarks(creds: InstapaperCreds, args: Record<string, unknown>): Promise<unknown> {
  const params: Record<string, string> = {
    limit: String(args.limit ? Number(args.limit) : 20),
  };
  if (args.folder_id) params.folder_id = String(args.folder_id);

  return instapaperPost(creds.consumerKey, creds.consumerSecret, creds.token, creds.tokenSecret, "/bookmarks/list", params);
}

async function addBookmark(creds: InstapaperCreds, args: Record<string, unknown>): Promise<unknown> {
  const url = String(args.url ?? "").trim();
  if (!url) return { error: "url is required." };

  const params: Record<string, string> = { url };
  if (args.title)       params.title       = String(args.title);
  if (args.description) params.description = String(args.description);
  if (args.folder_id)   params.folder_id   = String(args.folder_id);

  return instapaperPost(creds.consumerKey, creds.consumerSecret, creds.token, creds.tokenSecret, "/bookmarks/add", params);
}

async function archiveBookmark(creds: InstapaperCreds, args: Record<string, unknown>): Promise<unknown> {
  const bookmark_id = String(args.bookmark_id ?? "").trim();
  if (!bookmark_id) return { error: "bookmark_id is required." };
  return instapaperPost(creds.consumerKey, creds.consumerSecret, creds.token, creds.tokenSecret, "/bookmarks/archive", { bookmark_id });
}

async function deleteBookmark(creds: InstapaperCreds, args: Record<string, unknown>): Promise<unknown> {
  const bookmark_id = String(args.bookmark_id ?? "").trim();
  if (!bookmark_id) return { error: "bookmark_id is required." };
  return instapaperPost(creds.consumerKey, creds.consumerSecret, creds.token, creds.tokenSecret, "/bookmarks/delete", { bookmark_id });
}

async function getFolders(creds: InstapaperCreds, _args: Record<string, unknown>): Promise<unknown> {
  return instapaperPost(creds.consumerKey, creds.consumerSecret, creds.token, creds.tokenSecret, "/folders/list");
}

// ── Public dispatcher ──────────────────────────────────────────────────────────

export async function instapaperAction(
  action: string,
  args:   Record<string, unknown>
): Promise<unknown> {
  const resolved = await resolveCredentials("instapaper", args);
  if ("error" in resolved) return resolved;

  const creds = await authenticate(resolved);
  if ("error" in creds) return creds;

  try {
    switch (action) {
      case "get_instapaper_bookmarks": return getBookmarks(creds, args);
      case "add_instapaper_bookmark":  return addBookmark(creds, args);
      case "archive_bookmark":         return archiveBookmark(creds, args);
      case "delete_bookmark":          return deleteBookmark(creds, args);
      case "get_instapaper_folders":   return getFolders(creds, args);
      default:
        return {
          error: `Unknown Instapaper action: "${action}". Valid actions: get_instapaper_bookmarks, add_instapaper_bookmark, archive_bookmark, delete_bookmark, get_instapaper_folders.`,
        };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
