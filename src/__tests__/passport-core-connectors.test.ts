import { describe, expect, it } from "vitest";

import { CONNECTORS } from "@/lib/connectors";

describe("Passport core connectors", () => {
  it("registers GitHub, Vercel, and Supabase for /connect routes", () => {
    expect(CONNECTORS.github?.name).toBe("GitHub");
    expect(CONNECTORS.vercel?.name).toBe("Vercel");
    expect(CONNECTORS.supabase?.name).toBe("Supabase");
  });

  it("keeps secret fields marked as secret", () => {
    expect(CONNECTORS.github.credentialFields.find((field) => field.key === "api_key")?.secret).toBe(true);
    expect(CONNECTORS.vercel.credentialFields.find((field) => field.key === "api_key")?.secret).toBe(true);
    expect(CONNECTORS.supabase.credentialFields.find((field) => field.key === "service_role_key")?.secret).toBe(true);
  });

  it("uses OAuth login for GitHub with manual token as fallback", () => {
    expect(CONNECTORS.github.authType).toBe("oauth2");
    expect(CONNECTORS.github.authUrl).toBe("https://github.com/login/oauth/authorize");
    expect(CONNECTORS.github.tokenUrl).toBe("https://github.com/login/oauth/access_token");
    expect(CONNECTORS.github.scopes).toEqual(expect.arrayContaining(["repo", "workflow"]));
    expect(CONNECTORS.github.credentialFields.find((field) => field.key === "api_key")?.label).toContain("fallback");
  });
});
