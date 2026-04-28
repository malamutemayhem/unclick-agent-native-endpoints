import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRun } from "../run-manager.js";

describe("uxpass run-manager createRun idempotency", () => {
  const config = { supabaseUrl: "https://supabase.test", serviceRoleKey: "service-key" };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns was_duplicate=false when no task_id is supplied", async () => {
    const mock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    mock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      text: async () => JSON.stringify([{ id: "run-fresh" }]),
    });

    const result = await createRun(config, {
      targetUrl: "https://example.com",
      actorUserId: "user-1",
    });

    expect(result.id).toBe("run-fresh");
    expect(result.was_duplicate).toBe(false);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("returns was_duplicate=true when the same task_id collides with an existing row", async () => {
    const taskId = "550e8400-e29b-51d4-a716-446655440000";
    const mock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    mock
      .mockImplementationOnce(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        expect(body.task_id).toBe(taskId);
        return {
          ok: false,
          status: 409,
          text: async () =>
            JSON.stringify({ code: "23505", message: "duplicate key value violates unique constraint" }),
        };
      })
      .mockImplementationOnce(async (url: string) => {
        expect(url).toContain(`task_id=eq.${taskId}`);
        expect(url).toContain("actor_user_id=eq.user-1");
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: "existing-run-id" }],
        };
      });

    const result = await createRun(config, {
      targetUrl: "https://example.com",
      actorUserId: "user-1",
      taskId,
    });

    expect(result.id).toBe("existing-run-id");
    expect(result.was_duplicate).toBe(true);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("creates two distinct rows when two different task_ids are submitted", async () => {
    const mock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    mock
      .mockImplementationOnce(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        expect(body.task_id).toBe("aaaaaaaa-aaaa-5aaa-aaaa-aaaaaaaaaaaa");
        return {
          ok: true,
          status: 201,
          text: async () => JSON.stringify([{ id: "run-a" }]),
        };
      })
      .mockImplementationOnce(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        expect(body.task_id).toBe("bbbbbbbb-bbbb-5bbb-9bbb-bbbbbbbbbbbb");
        return {
          ok: true,
          status: 201,
          text: async () => JSON.stringify([{ id: "run-b" }]),
        };
      });

    const a = await createRun(config, {
      targetUrl: "https://example.com",
      actorUserId: "user-1",
      taskId: "aaaaaaaa-aaaa-5aaa-aaaa-aaaaaaaaaaaa",
    });
    const b = await createRun(config, {
      targetUrl: "https://example.com",
      actorUserId: "user-1",
      taskId: "bbbbbbbb-bbbb-5bbb-9bbb-bbbbbbbbbbbb",
    });

    expect(a.id).toBe("run-a");
    expect(a.was_duplicate).toBe(false);
    expect(b.id).toBe("run-b");
    expect(b.was_duplicate).toBe(false);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("throws on non-23505 errors even when task_id is supplied", async () => {
    const mock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    mock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "internal server error",
    });

    await expect(
      createRun(config, {
        targetUrl: "https://example.com",
        actorUserId: "user-1",
        taskId: "550e8400-e29b-51d4-a716-446655440000",
      }),
    ).rejects.toThrow(/500/);
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
