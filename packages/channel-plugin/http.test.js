import test from "node:test";
import assert from "node:assert/strict";
import { apiFetchJson } from "./http.js";

test("apiFetchJson returns parsed JSON on success", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ ok: true }),
  });

  try {
    const result = await apiFetchJson({
      apiBase: "https://unclick.world",
      apiKey: "k",
      action: "admin_channel_heartbeat",
      method: "POST",
      body: { client_info: "test" },
      timeoutMs: 50,
    });
    assert.deepEqual(result, { ok: true });
  } finally {
    global.fetch = originalFetch;
  }
});

test("apiFetchJson throws timeout error when request hangs", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (_url, { signal }) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        reject(err);
      });
    });

  try {
    await assert.rejects(
      () =>
        apiFetchJson({
          apiBase: "https://unclick.world",
          apiKey: "k",
          action: "admin_channel_heartbeat",
          timeoutMs: 10,
        }),
      /timeout after 10ms/
    );
  } finally {
    global.fetch = originalFetch;
  }
});
