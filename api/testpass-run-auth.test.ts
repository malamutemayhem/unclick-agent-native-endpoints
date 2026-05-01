import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveTestPassRunActor } from "./testpass-run";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockJsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("resolveTestPassRunActor", () => {
  it("accepts active UnClick API keys linked to a user", async () => {
    const fetchMock = vi.fn(async () => mockJsonResponse(200, [
      { user_id: "user-123", is_active: true },
    ]));
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await resolveTestPassRunActor(
      "https://example.supabase.co",
      "service-role",
      "uc_test_key",
    );

    expect(result).toEqual({ ok: true, actorUserId: "user-123", tokenKind: "api_key" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/rest/v1/api_keys?");
    expect(String(fetchMock.mock.calls[0][0])).toContain("key_hash=eq.");
  });

  it("explains inactive API keys", async () => {
    globalThis.fetch = vi.fn(async () => mockJsonResponse(200, [
      { user_id: "user-123", is_active: false },
    ])) as typeof fetch;

    const result = await resolveTestPassRunActor(
      "https://example.supabase.co",
      "service-role",
      "uc_inactive_key",
    );

    expect(result).toMatchObject({
      ok: false,
      status: 401,
      auth_reason: "api_key_inactive",
    });
  });

  it("explains unlinked API keys", async () => {
    globalThis.fetch = vi.fn(async () => mockJsonResponse(200, [
      { user_id: null, is_active: true },
    ])) as typeof fetch;

    const result = await resolveTestPassRunActor(
      "https://example.supabase.co",
      "service-role",
      "uc_unlinked_key",
    );

    expect(result).toMatchObject({
      ok: false,
      status: 401,
      auth_reason: "api_key_unlinked",
    });
  });

  it("still accepts Supabase session tokens", async () => {
    globalThis.fetch = vi.fn(async () => mockJsonResponse(200, { id: "session-user" })) as typeof fetch;

    const result = await resolveTestPassRunActor(
      "https://example.supabase.co",
      "service-role",
      "jwt-token",
    );

    expect(result).toEqual({ ok: true, actorUserId: "session-user", tokenKind: "session" });
  });
});
