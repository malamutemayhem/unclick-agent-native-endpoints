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

    const result = await createRun(
      { supabaseUrl: "https://supabase.test", serviceRoleKey: "service-key" },
      {
        packId: "pack-id-1",
        packName: "TestPass Core",
        target: { type: "url", url: "https://unclick.world/api/mcp" },
        profile: "smoke",
        actorUserId: "user-1",
      },
    );

    expect(result.id).toBe("run-id-1");
    expect(result.was_duplicate).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns was_duplicate=false when no task_id is supplied", async () => {
    const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 201,
      text: async () => JSON.stringify([{ id: "run-fresh" }]),
    } as Response));
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await createRun(
      { supabaseUrl: "https://supabase.test", serviceRoleKey: "service-key" },
      {
        packId: "pack-id-1",
        target: { type: "url", url: "https://example.com" },
        profile: "smoke",
        actorUserId: "user-1",
      },
    );

    expect(result.was_duplicate).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns was_duplicate=true when the same task_id collides with an existing row", async () => {
    const taskId = "550e8400-e29b-51d4-a716-446655440000";
    let call = 0;
    const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
      call++;
      if (call === 1) {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        expect(body.task_id).toBe(taskId);
        return {
          ok: false,
          status: 409,
          text: async () =>
            JSON.stringify({ code: "23505", message: "duplicate key value violates unique constraint" }),
        } as Response;
      }
      // second call: lookup of existing row
      expect(url).toContain(`task_id=eq.${taskId}`);
      expect(url).toContain("actor_user_id=eq.user-1");
      return {
        ok: true,
        status: 200,
        json: async () => [{ id: "existing-run-id" }],
      } as unknown as Response;
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await createRun(
      { supabaseUrl: "https://supabase.test", serviceRoleKey: "service-key" },
      {
        packId: "pack-id-1",
        target: { type: "url", url: "https://example.com" },
        profile: "smoke",
        actorUserId: "user-1",
        taskId,
      },
    );

    expect(result.id).toBe("existing-run-id");
    expect(result.was_duplicate).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("creates two distinct rows when two different task_ids are submitted", async () => {
    const taskA = "aaaaaaaa-aaaa-5aaa-aaaa-aaaaaaaaaaaa";
    const taskB = "bbbbbbbb-bbbb-5bbb-9bbb-bbbbbbbbbbbb";
    const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      const id = body.task_id === taskA ? "run-a" : body.task_id === taskB ? "run-b" : "run-other";
      return {
        ok: true,
        status: 201,
        text: async () => JSON.stringify([{ id }]),
      } as Response;
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const config = { supabaseUrl: "https://supabase.test", serviceRoleKey: "service-key" };
    const a = await createRun(config, {
      packId: "pack-id-1",
      target: { type: "url", url: "https://example.com" },
      profile: "smoke",
      actorUserId: "user-1",
      taskId: taskA,
    });
    const b = await createRun(config, {
      packId: "pack-id-1",
      target: { type: "url", url: "https://example.com" },
      profile: "smoke",
      actorUserId: "user-1",
      taskId: taskB,
    });

    expect(a.id).toBe("run-a");
    expect(a.was_duplicate).toBe(false);
    expect(b.id).toBe("run-b");
    expect(b.was_duplicate).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
