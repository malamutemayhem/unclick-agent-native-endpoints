import { afterEach, describe, expect, it, vi } from "vitest";

import { nudgeonlyApi, nudgeonlyPolicy, NUDGEONLY_POLICY } from "./nudgeonly-tool.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NudgeOnlyAPI policy", () => {
  it("keeps 👉Nudge inside the PinballWake red nudge lane", async () => {
    await expect(nudgeonlyPolicy({})).resolves.toMatchObject({
      official_name: "NudgeOnlyAPI",
      worker_name: "👉Nudge",
      code_name: "NudgeOnly",
      ecosystem: "PinballWake",
      lane: "red_nudge",
      authority: "nudge_only_no_write_no_truth",
      default_model: "openrouter/free",
    });
  });

  it("names important actions as prohibited", () => {
    expect(NUDGEONLY_POLICY.prohibited_actions).toEqual(
      expect.arrayContaining([
        "merge PRs",
        "close blockers",
        "mark work complete",
        "decide ownership",
        "call mutation tools",
        "set source-of-truth state",
      ]),
    );
  });

  it("does not run without an OpenRouter key", async () => {
    const previous = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    await expect(nudgeonlyApi({ event_text: "wakepass stale ack" }))
      .rejects
      .toThrow("api_key is required");

    if (previous === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = previous;
    }
  });

  it("uses the free OpenRouter nudge lane without granting authority", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({
      ok: true,
      json: async () => ({
        id: "or-nudge-test",
        model: "openrouter/free",
        choices: [{
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              painpoint_detected: true,
              painpoint_type: "stale_ack",
              nudge: "Possible stale ACK. Suggest checking the WakePass receipt before taking action.",
              suggested_check: "Run the WakePass ACK verifier for the source dispatch.",
              confidence: "medium",
            }),
          },
        }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(nudgeonlyApi({
      api_key: "test-key",
      event_text: "wakepass stale ack for PR #705",
      source_id: "wake-pull_request-pr-705",
      source_url: "https://github.com/malamutemayhem/unclick-agent-native-endpoints/pull/705",
    })).resolves.toMatchObject({
      worker: "👉Nudge",
      official_name: "NudgeOnlyAPI",
      code_name: "NudgeOnly",
      ecosystem: "PinballWake",
      authority: "nudge_only_no_write_no_truth",
      model: "openrouter/free",
      source_id: "wake-pull_request-pr-705",
      source_url: "https://github.com/malamutemayhem/unclick-agent-native-endpoints/pull/705",
      painpoint_detected: true,
      requires_verifier: true,
      evidence: {
        router: "OpenRouter",
        requested_model: "openrouter/free",
        resolved_model: "openrouter/free",
        openrouter_id: "or-nudge-test",
        verifier_required: true,
        authority: "nudge_only_no_write_no_truth",
      },
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-key",
      "X-OpenRouter-Title": "NudgeOnlyAPI",
    });
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      model: "openrouter/free",
      max_tokens: 260,
      response_format: { type: "json_object" },
    });
    expect(JSON.parse(body.messages[1].content)).toMatchObject({
      trace_id: expect.stringMatching(/^nudgeonly_[0-9a-f]{16}$/),
      source_id: "wake-pull_request-pr-705",
      source_url: "https://github.com/malamutemayhem/unclick-agent-native-endpoints/pull/705",
    });
  });
});
