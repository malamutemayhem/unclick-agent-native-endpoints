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
});
