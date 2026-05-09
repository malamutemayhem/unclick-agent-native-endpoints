import { describe, expect, it } from "vitest";
import { createOAuthStateToken, verifyOAuthStateToken } from "./oauth-state";

const env = {
  GITHUB_CLIENT_SECRET: "github-secret",
  XERO_CLIENT_SECRET: "xero-secret",
  REDDIT_CLIENT_SECRET: "reddit-secret",
  SHOPIFY_CLIENT_SECRET: "shopify-secret",
} as NodeJS.ProcessEnv;

describe("oauth state token", () => {
  it("round-trips a valid token", () => {
    const token = createOAuthStateToken({
      platform: "github",
      redirectPath: "/connect/github",
      env,
      nowSeconds: 1_000,
    });

    expect(verifyOAuthStateToken(token, env, 1_100)).toMatchObject({
      platform: "github",
      redirectPath: "/connect/github",
      v: 1,
    });
  });

  it("rejects tampered payloads", () => {
    const token = createOAuthStateToken({
      platform: "shopify",
      redirectPath: "/connect/shopify",
      store: "demo-store",
      env,
      nowSeconds: 1_000,
    });

    const [payload, signature] = token.split(".");
    const tampered = `${Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
        store: "evil-store",
      }),
      "utf8"
    ).toString("base64url")}.${signature}`;

    expect(() => verifyOAuthStateToken(tampered, env, 1_100)).toThrow(
      "OAuth state signature mismatch."
    );
  });

  it("rejects expired tokens", () => {
    const token = createOAuthStateToken({
      platform: "reddit",
      redirectPath: "/connect/reddit",
      env,
      nowSeconds: 1_000,
    });

    expect(() => verifyOAuthStateToken(token, env, 2_000)).toThrow(
      "OAuth state token expired."
    );
  });
});
