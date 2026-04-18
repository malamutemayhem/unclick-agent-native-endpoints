/**
 * UnClick OAuth Callback Handler
 * Vercel serverless function - exchanges OAuth authorization code for tokens
 * and stores them encrypted in Supabase via the credentials endpoint.
 *
 * POST /api/oauth-callback
 *   Body: {
 *     platform: string        // e.g. "xero"
 *     code:     string        // OAuth authorization code from platform redirect
 *     api_key:  string        // User's UnClick API key (used as encryption key)
 *     state?:   string        // CSRF state token (validated client-side before this call)
 *   }
 *   Returns: { success: true, platform, message } or { error: string }
 *
 * Platform-specific token exchange logic lives in PLATFORM_CONFIGS below.
 * Adding a new OAuth platform = add an entry to PLATFORM_CONFIGS.
 *
 * Required env vars per platform:
 *   XERO_CLIENT_ID, XERO_CLIENT_SECRET, XERO_REDIRECT_URI
 *   REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_REDIRECT_URI
 *   SHOPIFY_{STORE}_CLIENT_ID, etc. (Shopify is per-store, handled specially)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

// ─── Platform OAuth configs ────────────────────────────────────────────────────

interface OAuthConfig {
  tokenUrl:    string;
  clientIdEnv: string;
  clientSecretEnv: string;
  redirectUriEnv:  string;
  /** Extract the credential fields we want to store from the token response */
  extractCredentials: (
    tokenResponse: Record<string, unknown>,
    platform:      string,
    env:           NodeJS.ProcessEnv
  ) => Promise<Record<string, string>>;
}

const PLATFORM_CONFIGS: Record<string, OAuthConfig> = {

  xero: {
    tokenUrl:         "https://identity.xero.com/connect/token",
    clientIdEnv:      "XERO_CLIENT_ID",
    clientSecretEnv:  "XERO_CLIENT_SECRET",
    redirectUriEnv:   "XERO_REDIRECT_URI",
    async extractCredentials(tokenResponse, _platform, _env) {
      const accessToken = String(tokenResponse.access_token ?? "");
      if (!accessToken) throw new Error("No access_token in Xero token response.");

      // Fetch tenant list to get the first (or only) tenant_id
      let tenantId = "";
      try {
        const tenantsRes = await fetch("https://api.xero.com/connections", {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        });
        if (tenantsRes.ok) {
          const tenants = (await tenantsRes.json()) as Array<{ tenantId: string; tenantName?: string }>;
          if (tenants.length > 0) tenantId = tenants[0].tenantId;
        }
      } catch {
        // tenant fetch failed - caller will need to provide tenant_id manually
      }

      return { access_token: accessToken, tenant_id: tenantId };
    },
  },

  reddit: {
    tokenUrl:        "https://www.reddit.com/api/v1/access_token",
    clientIdEnv:     "REDDIT_CLIENT_ID",
    clientSecretEnv: "REDDIT_CLIENT_SECRET",
    redirectUriEnv:  "REDDIT_REDIRECT_URI",
    async extractCredentials(tokenResponse) {
      const accessToken = String(tokenResponse.access_token ?? "");
      if (!accessToken) throw new Error("No access_token in Reddit token response.");
      return { access_token: accessToken };
    },
  },

  // Shopify OAuth is per-store - the redirect URI and token URL include the store name.
  // Handled specially in the handler below.

};

// ─── Shopify special handling ─────────────────────────────────────────────────

async function exchangeShopify(
  code:     string,
  store:    string,
  env:      NodeJS.ProcessEnv
): Promise<Record<string, string>> {
  const clientId     = env.SHOPIFY_CLIENT_ID ?? "";
  const clientSecret = env.SHOPIFY_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret) {
    throw new Error("SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET must be set.");
  }

  const host     = store.includes(".") ? store : `${store}.myshopify.com`;
  const tokenUrl = `https://${host}/admin/oauth/access_token`;

  const res = await fetch(tokenUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });

  if (!res.ok) throw new Error(`Shopify token exchange failed: ${res.status}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("No access_token in Shopify response.");

  return { store: host.replace(".myshopify.com", ""), access_token: data.access_token };
}

// ─── Generic OAuth token exchange ─────────────────────────────────────────────

async function exchangeCode(
  config:      OAuthConfig,
  code:        string,
  env:         NodeJS.ProcessEnv
): Promise<Record<string, string>> {
  const clientId     = env[config.clientIdEnv]     ?? "";
  const clientSecret = env[config.clientSecretEnv] ?? "";
  const redirectUri  = env[config.redirectUriEnv]  ?? "";

  if (!clientId || !clientSecret) {
    throw new Error(
      `${config.clientIdEnv} and ${config.clientSecretEnv} env vars must be set.`
    );
  }

  const body = new URLSearchParams({
    grant_type:    "authorization_code",
    code,
    redirect_uri:  redirectUri,
    client_id:     clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(config.tokenUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Token exchange failed (${res.status}): ${errText}`);
  }

  const tokenResponse = (await res.json()) as Record<string, unknown>;
  return config.extractCredentials(tokenResponse, "", env);
}

// ─── Store credentials via internal credentials endpoint ──────────────────────

async function storeCredentials(
  platform:    string,
  credentials: Record<string, string>,
  apiKey:      string,
  baseUrl:     string
): Promise<void> {
  const res = await fetch(`${baseUrl}/api/credentials`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ platform, credentials, api_key: apiKey }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Credential storage failed (${res.status})`);
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin",  "https://unclick.world");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed." });

  const { platform, code, api_key, store } = (req.body ?? {}) as {
    platform?: string;
    code?:     string;
    api_key?:  string;
    store?:    string; // Shopify only
  };

  if (!platform) return res.status(400).json({ error: "platform is required." });
  if (!code)     return res.status(400).json({ error: "code is required." });
  if (!api_key)  return res.status(400).json({ error: "api_key is required." });

  if (!api_key.startsWith("uc_") && !api_key.startsWith("agt_")) {
    return res.status(400).json({ error: "Invalid api_key format." });
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://unclick.world";

  try {
    let credentials: Record<string, string>;

    if (platform === "shopify") {
      if (!store) return res.status(400).json({ error: "store is required for Shopify." });
      credentials = await exchangeShopify(code, store, process.env);
    } else {
      const config = PLATFORM_CONFIGS[platform];
      if (!config) {
        return res.status(400).json({
          error: `OAuth not configured for platform "${platform}". Use the manual credential form instead.`,
        });
      }
      credentials = await exchangeCode(config, code, process.env);
    }

    await storeCredentials(platform, credentials, api_key, baseUrl);

    return res.status(200).json({
      success:  true,
      platform,
      message:  `Connected to ${platform} successfully.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
