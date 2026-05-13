import { afterEach, describe, expect, it, vi } from "vitest";

import { nudgeonlyApi, nudgeonlyPolicy, nudgeonlyReceiptBridge, NUDGEONLY_POLICY } from "./nudgeonly-tool.js";

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
      quality_gates: expect.arrayContaining([
        "Do not invent facts, owners, sources, statuses, or proof.",
        "Prefer false negatives over false positives when evidence is weak.",
        "Every alert must name a deterministic verifier before action.",
      ]),
      receipt_bridge: expect.objectContaining({
        status: "official",
        route_shape: "worker -> target -> painpoint -> expected receipt -> verifier",
      }),
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

  it("routes a verified stale ACK nudge into a reviewer receipt request", async () => {
    await expect(nudgeonlyReceiptBridge({
      painpoint_detected: true,
      painpoint_type: "stale_ack",
      event_text: "WakePass stale ACK for PR #705, review receipt is missing.",
      source_id: "wake-pull_request-pr-705",
      source_url: "https://github.com/malamutemayhem/unclick-agent-native-endpoints/pull/705",
      owner: "🔍",
      nudge_trace_id: "nudgeonly_abc123",
      created_at: "2026-05-11T00:00:00.000Z",
      now: "2026-05-11T00:20:00.000Z",
      ttl_minutes: 60,
    })).resolves.toMatchObject({
      bridge_status: "receipt_request",
      authority: "nudge_only_no_write_no_truth",
      painpoint_detected: true,
      painpoint_type: "stale_ack",
      request: {
        worker: "Reviewer",
        owner: "🔍",
        target: "https://github.com/malamutemayhem/unclick-agent-native-endpoints/pull/705",
        expected_receipt: "ACK received, review started, or blocker receipt with reason.",
        verifier: "Run the WakePass ACK verifier against the source dispatch or PR.",
        receipt_line: expect.stringContaining("Reviewer -> https://github.com/malamutemayhem/unclick-agent-native-endpoints/pull/705 -> stale_ack"),
      },
      evidence: {
        nudge_trace_id: "nudgeonly_abc123",
        source_id: "wake-pull_request-pr-705",
        verifier_required: true,
      },
      requires_verifier: true,
    });
  });

  it("escalates when ACK or proof is still missing after the TTL", async () => {
    await expect(nudgeonlyReceiptBridge({
      painpoint_detected: true,
      painpoint_type: "stale_ack",
      event_text: "WakePass stale ACK for PR #705, no ACK receipt yet.",
      source_id: "wake-pull_request-pr-705",
      source_url: "https://github.com/malamutemayhem/unclick-agent-native-endpoints/pull/705",
      owner: "🔍",
      ack_status: "missing",
      created_at: "2026-05-11T00:00:00.000Z",
      now: "2026-05-11T02:00:00.000Z",
      ttl_minutes: 60,
    })).resolves.toMatchObject({
      bridge_status: "escalation_request",
      escalation: {
        escalate_to: "WakePass",
        reason: "ACK or proof is still missing after the configured TTL.",
      },
      request: {
        worker: "Reviewer",
        verifier: "Run the WakePass ACK verifier against the source dispatch or PR.",
      },
    });
  });

  it("suppresses ACK-only WakePass comments instead of creating duplicate stale wakes", async () => {
    await expect(nudgeonlyReceiptBridge({
      painpoint_detected: true,
      painpoint_type: "stale_ack",
      event_text: "ACK wake-issue_comment-comment-4436477251-51e47b7d9cdd. The wake is acknowledged, but this is still waiting for terminal executor proof.",
      source_id: "wake-issue_comment-comment-4436519129-d570faed9137",
      source_url: "https://github.com/malamutemayhem/unclick-agent-native-endpoints/issues/751",
      ack_status: "missing",
      created_at: "2026-05-13T02:04:37.000Z",
      now: "2026-05-13T02:15:48.000Z",
      ttl_minutes: 5,
    })).resolves.toMatchObject({
      bridge_status: "suppress",
      painpoint_detected: false,
      painpoint_type: "none",
      suppressed_painpoint_type: "stale_ack",
      suppression: {
        reason: "ack_only_comment",
        original_wake_id: "wake-issue_comment-comment-4436477251-51e47b7d9cdd",
        source_id: "wake-issue_comment-comment-4436519129-d570faed9137",
      },
      quality_gate: "duplicate ACK wake suppression",
    });
  });

  it("suppresses superseded heartbeat status comments instead of keeping old blockers active", async () => {
    await expect(nudgeonlyReceiptBridge({
      painpoint_detected: true,
      painpoint_type: "stale_ack",
      event_text: "PASS progress from heartbeat: created focused production hotfix PR #761 to promote NudgeOnly/WakePass suppression to main. Next safe step: wait for CI.",
      context: "Superseded by PR #761 closed and PR #762 merged to main with live Publish MCP server proof. Current live nudgeonly_receipt_bridge suppresses the ACK-only wake.",
      source_id: "wake-issue_comment-comment-4436827196-32a36c4d4da6",
      source_url: "https://github.com/malamutemayhem/unclick-agent-native-endpoints/issues/751#issuecomment-4436827196",
      target: "issue #751 comment 4436827196",
      ack_status: "stale",
      proof_status: "present",
      created_at: "2026-05-13T03:13:27.000Z",
      now: "2026-05-13T03:31:00.000Z",
      ttl_minutes: 60,
    })).resolves.toMatchObject({
      bridge_status: "suppress",
      painpoint_detected: false,
      painpoint_type: "none",
      suppressed_painpoint_type: "stale_ack",
      suppression: {
        reason: "superseded_status_comment",
        source_id: "wake-issue_comment-comment-4436827196-32a36c4d4da6",
        target: "issue #751 comment 4436827196",
      },
      quality_gate: "superseded status suppression",
    });
  });

  it("routes unclear ownership only to Job Manager for resolution", async () => {
    await expect(nudgeonlyReceiptBridge({
      painpoint_detected: true,
      painpoint_type: "unclear_owner",
      event_text: "Blocker is visible but there is no active job and owner is missing.",
      source_id: "dispatch_blocker_705",
      target: "PR #705",
      worker: "Reviewer",
    })).resolves.toMatchObject({
      bridge_status: "receipt_request",
      request: {
        worker: "Job Manager",
        owner: null,
        target: "PR #705",
        painpoint_type: "unclear_owner",
        expected_receipt: "Owning job, next safe action, and expected proof receipt.",
      },
    });
  });

  it("routes queue hydration failures to the existing PinballWake Jobs Worker", async () => {
    await expect(nudgeonlyReceiptBridge({
      painpoint_detected: true,
      painpoint_type: "queue_hydration_failure",
      event_text: "Orchestrator shows 0 active jobs but backlog has 4 actionable todos and 2 open dispatches.",
      source_id: "orchestrator-current-state",
      target: "Boardroom backlog",
      worker: "Builder",
    })).resolves.toMatchObject({
      bridge_status: "receipt_request",
      request: {
        worker: "pinballwake-jobs-worker",
        target: "Boardroom backlog",
        painpoint_type: "queue_hydration_failure",
        expected_receipt: "Backlog counted, scoped, mirrored, or routed to the existing Job Worker with next safe action.",
      },
    });
  });

  it("stays quiet for healthy controls and advisory-only for weak evidence", async () => {
    await expect(nudgeonlyReceiptBridge({
      painpoint_detected: false,
      painpoint_type: "none",
      event_text: "WakePass completed with proof.",
      source_id: "wake-pull_request-pr-699",
    })).resolves.toMatchObject({
      bridge_status: "quiet",
      painpoint_detected: false,
      painpoint_type: "none",
    });

    await expect(nudgeonlyReceiptBridge({
      painpoint_detected: true,
      painpoint_type: "stale_ack",
      event_text: "Something feels odd.",
    })).resolves.toMatchObject({
      bridge_status: "advisory_only",
      reason: "The bridge did not find enough deterministic evidence to route a worker receipt request.",
      missing: {
        source_evidence: true,
        concrete_cue: true,
      },
    });
  });
});
