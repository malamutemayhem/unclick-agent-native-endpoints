import { createHmac, timingSafeEqual } from "node:crypto";

export interface OAuthStatePayload {
  platform: string;
  redirectPath: string;
  exp: number;
  store?: string;
  v: 1;
}

const STATE_TTL_SECONDS = 10 * 60;

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getPlatformSecret(platform: string, env: NodeJS.ProcessEnv): string {
  switch (platform) {
    case "github":
      return env.GITHUB_CLIENT_SECRET ?? "";
    case "xero":
      return env.XERO_CLIENT_SECRET ?? "";
    case "reddit":
      return env.REDDIT_CLIENT_SECRET ?? "";
    case "shopify":
      return env.SHOPIFY_CLIENT_SECRET ?? "";
    default:
      return "";
  }
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload, "utf8").digest("base64url");
}

export function createOAuthStateToken(args: {
  platform: string;
  redirectPath: string;
  env: NodeJS.ProcessEnv;
  nowSeconds?: number;
  store?: string;
}): string {
  const secret = getPlatformSecret(args.platform, args.env);
  if (!secret) {
    throw new Error(`OAuth client secret missing for platform "${args.platform}".`);
  }

  const payload: OAuthStatePayload = {
    platform: args.platform,
    redirectPath: args.redirectPath,
    exp: (args.nowSeconds ?? Math.floor(Date.now() / 1000)) + STATE_TTL_SECONDS,
    ...(args.store ? { store: args.store } : {}),
    v: 1,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyOAuthStateToken(
  token: string,
  env: NodeJS.ProcessEnv,
  nowSeconds = Math.floor(Date.now() / 1000)
): OAuthStatePayload {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("Invalid OAuth state token.");
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as OAuthStatePayload;
  } catch {
    throw new Error("Invalid OAuth state token.");
  }

  if (
    payload.v !== 1 ||
    typeof payload.platform !== "string" ||
    typeof payload.redirectPath !== "string" ||
    typeof payload.exp !== "number"
  ) {
    throw new Error("Invalid OAuth state token.");
  }

  const secret = getPlatformSecret(payload.platform, env);
  if (!secret) {
    throw new Error(`OAuth client secret missing for platform "${payload.platform}".`);
  }

  const expectedSignature = signPayload(encodedPayload, secret);
  const actual = Buffer.from(signature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("OAuth state signature mismatch.");
  }

  if (payload.exp < nowSeconds) {
    throw new Error("OAuth state token expired.");
  }

  return payload;
}
