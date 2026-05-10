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
      default_model: "liquid/lfm-2.5-1.2b-instruct:free",
      rollout_status: "official",
    });
  });

  it("publishes the official system rollout surfaces and painpoint catalogue", async () => {
    await expect(nudgeonlyPolicy({})).resolves.toMatchObject({
      rollout_surfaces: expect.arrayContaining([
        expect.objectContaining({ surface: "PinballWake/WakePass" }),
        expect.objectContaining({ surface: "Orchestrator state cards" }),
        expect.objectContaining({ surface: "Heartbeat and Signals" }),
        expect.objectContaining({ surface: "Agent Observability" }),
      ]),
      painpoint_catalog: expect.arrayContaining([
        expect.objectContaining({ type: "stale_ack" }),
        expect.objectContaining({ type: "duplicate_wake" }),
        expect.objectContaining({ type: "unclear_owner" }),
        expect.objectContaining({ type: "missing_proof" }),
        expect.objectContaining({ type: "noisy_thread" }),
        expect.objectContaining({ type: "none" }),
      ]),
      orchestrator_issue_map: expect.arrayContaining([
        expect.objectContaining({ bucket: "noisy_thread" }),
        expect.objectContaining({ bucket: "unclear_owner" }),
        expect.objectContaining({ bucket: "missing_proof" }),
        expect.objectContaining({ bucket: "stale_ack" }),
      ]),
      worker_nudge_map: expect.arrayContaining([
        expect.objectContaining({ worker: "Continuous Improver", bucket: "unclear_owner" }),
        expect.objectContaining({ worker: "Job Manager", bucket: "unclear_owner" }),
        expect.objectContaining({ worker: "Reviewer", bucket: "stale_ack" }),
        expect.objectContaining({ worker: "Builder", bucket: "missing_proof" }),
        expect.objectContaining({ worker: "Heartbeat Seat", bucket: "noisy_thread" }),
        expect.objectContaining({ worker: "Agent Observability", bucket: "missing_proof" }),
      ]),
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

  it("normalises model output to the allowed painpoint labels", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "or-nudge-label-test",
        model: "liquid/lfm-2.5-1.2b-instruct:free",
        choices: [{
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              painpoint_detected: "stale_ack, unclear_owner",
              painpoint_type: "stale_ack, unclear_owner",
              nudge: "Possible stale ACK plus unclear ownership.",
              suggested_check: "Run the WakePass ACK verifier and owner resolver for the source dispatch.",
              confidence: "low",
            }),
          },
        }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(nudgeonlyApi({
      api_key: "test-key",
      event_text: "wakepass stale ack with unclear owner",
    })).resolves.toMatchObject({
      painpoint_detected: true,
      painpoint_type: "stale_ack",
    });
  });

  it("trusts a concrete hinted painpoint label over a weak detected flag", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "or-nudge-hint-test",
        model: "liquid/lfm-2.5-1.2b-instruct:free",
        choices: [{
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              painpoint_detected: false,
              painpoint_type: "missing_proof",
              nudge: "Possible missing proof pointer.",
              suggested_check: "Check the proof pointer in the compact Orchestrator state.",
              confidence: "low",
            }),
          },
        }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(nudgeonlyApi({
      api_key: "test-key",
      event_text: "proof pointer is missing",
      painpoint_hint: "missing_proof",
    })).resolves.toMatchObject({
      painpoint_detected: true,
      painpoint_type: "missing_proof",
    });
  });

  it("uses a supplied painpoint hint as the stable dashboard bucket", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "or-nudge-bucket-test",
        model: "liquid/lfm-2.5-1.2b-instruct:free",
        choices: [{
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              painpoint_detected: true,
              painpoint_type: "stale_ack",
              nudge: "Possible ownership confusion around a stale WakePass handoff.",
              suggested_check: "Run the owner resolver against the source dispatch.",
              confidence: "low",
            }),
          },
        }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(nudgeonlyApi({
      api_key: "test-key",
      event_text: "no clear next owner is named",
      painpoint_hint: "unclear_owner",
    })).resolves.toMatchObject({
      painpoint_detected: true,
      painpoint_type: "unclear_owner",
    });
  });

  it("keeps an unhinted healthy control quiet when the detected flag is false", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "or-nudge-quiet-test",
        model: "liquid/lfm-2.5-1.2b-instruct:free",
        choices: [{
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              painpoint_detected: false,
              painpoint_type: "stale_ack",
              nudge: "Possible wakepass issue.",
              suggested_check: "Verify WakePass status before taking action.",
              confidence: "low",
            }),
          },
        }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(nudgeonlyApi({
      api_key: "test-key",
      event_text: "wakepass completed and healthy",
      painpoint_hint: "none",
    })).resolves.toMatchObject({
      painpoint_detected: false,
      painpoint_type: "none",
    });
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
        model: "liquid/lfm-2.5-1.2b-instruct:free",
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
        model: "liquid/lfm-2.5-1.2b-instruct:free",
      source_id: "wake-pull_request-pr-705",
      source_url: "https://github.com/malamutemayhem/unclick-agent-native-endpoints/pull/705",
      painpoint_detected: true,
      requires_verifier: true,
      evidence: {
        router: "OpenRouter",
        requested_model: "liquid/lfm-2.5-1.2b-instruct:free",
        resolved_model: "liquid/lfm-2.5-1.2b-instruct:free",
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
      model: "liquid/lfm-2.5-1.2b-instruct:free",
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
