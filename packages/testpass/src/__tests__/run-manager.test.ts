import { jest } from "@jest/globals";
import { createRun } from "../run-manager.js";

describe("run-manager", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("persists pack_name when a run is created with a pack label", async () => {
    const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      expect(body.pack_id).toBe("pack-id-1");
      expect(body.pack_name).toBe("TestPass Core");
      return {
        ok:     true,
        status: 200,
        text:   async () => JSON.stringify([{ id: "run-id-1" }]),
      } as Response;
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const runId = await createRun(
      { supabaseUrl: "https://supabase.test", serviceRoleKey: "service-key" },
      {
        packId: "pack-id-1",
        packName: "TestPass Core",
        target: { type: "url", url: "https://unclick.world/api/mcp" },
        profile: "smoke",
        actorUserId: "user-1",
      },
    );

    expect(runId).toBe("run-id-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
