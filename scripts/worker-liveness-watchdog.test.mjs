import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateWorkerLiveness } from "./worker-liveness-watchdog.mjs";

const NOW = "2026-05-09T22:01:16.000Z";

function profile(overrides = {}) {
  return {
    agent_id: "unknown",
    display_name: "Unknown",
    last_seen_at: "2026-05-09T22:00:00.000Z",
    current_status: "",
    current_status_updated_at: "2026-05-09T22:00:00.000Z",
    next_checkin_at: null,
    ...overrides,
  };
}

describe("worker liveness watchdog", () => {
  it("classifies active, warm, stale, and dormant seats from Boardroom profile freshness", () => {
    const result = evaluateWorkerLiveness({
      now: NOW,
      profiles: [
        profile({
          agent_id: "chatgpt-codex-worker2",
          display_name: "ChatGPT Codex Worker 2",
          user_agent_hint: "codex-desktop",
          last_seen_at: "2026-05-09T21:57:31.397Z",
        }),
        profile({
          agent_id: "claude-cowork-pc-tether",
          display_name: "Claude Cowork PC Tether",
          user_agent_hint: "cowork/scheduled-heartbeat",
          last_seen_at: "2026-05-09T21:33:53.916Z",
        }),
        profile({
          agent_id: "github-action-queuepush",
          display_name: "QueuePush",
          user_agent_hint: "github-action",
          last_seen_at: "2026-05-09T16:37:06.857Z",
        }),
        profile({
          agent_id: "master",
          display_name: "Master Coordinator",
          user_agent_hint: "unclick-master/coordinator",
          last_seen_at: "2026-05-06T03:59:07.640Z",
        }),
      ],
    });

    assert.equal(result.counts.active, 1);
    assert.equal(result.counts.warm, 1);
    assert.equal(result.counts.stale, 1);
    assert.equal(result.counts.dormant, 1);

    const master = result.workers.find((worker) => worker.agent_id === "master");
    assert.equal(master.lane, "coordinator");
    assert.equal(master.freshness, "dormant");
    assert(master.reasons.includes("coordinator_fallback_needed"));
    assert(result.actions.some((action) => action.action === "activate_second_tier_coordinator"));
  });

  it("turns missed ACK reroute messages into explicit reroute actions", () => {
    const result = evaluateWorkerLiveness({
      now: NOW,
      profiles: [
        profile({
          agent_id: "claude-cowork-seat",
          display_name: "Claude Cowork Reviewer Seat",
          last_seen_at: "2026-05-09T21:50:28.985Z",
          current_status: "ACKed PR #640 wake; deferred deep review to next active review cycle",
        }),
      ],
      messages: [
        {
          id: "a6a982ec",
          tags: ["needs-doing", "wakepass", "reroute"],
          text: "WakePass auto-reroute. Reason: missed ACK for Review Coordinator.",
          created_at: "2026-05-09T21:45:12.419Z",
        },
      ],
    });

    assert.equal(result.missed_ack_reroutes.length, 1);
    assert(result.actions.some((action) => action.action === "reroute_missed_ack_to_live_worker"));
    assert(result.actions.some((action) => action.action === "separate_ack_from_diff_review"));
  });

  it("flags overdue check-ins without claiming or merging work", () => {
    const result = evaluateWorkerLiveness({
      now: NOW,
      profiles: [
        profile({
          agent_id: "codex-desktop-loop-creat",
          display_name: "Loop continuous improvement",
          user_agent_hint: "codex-desktop/gpt-5",
          last_seen_at: "2026-05-04T23:41:32.233Z",
          next_checkin_at: "2026-05-05T00:10:32.233Z",
        }),
      ],
    });

    assert.equal(result.workers[0].lane, "improver");
    assert.equal(result.workers[0].freshness, "dormant");
    assert(result.workers[0].reasons.includes("missed_next_checkin"));
    assert.equal(result.safe_mode.read_only, true);
    assert.equal(result.safe_mode.no_merge_or_claim, true);
  });
});
