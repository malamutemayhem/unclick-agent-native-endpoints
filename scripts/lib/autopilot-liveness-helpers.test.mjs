import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildJobsManagerLivenessAdapter,
  buildReviewCoordinatorLivenessAdapter,
  classifyProfileLiveness,
  extractMissedAckSignals,
} from "./autopilot-liveness-helpers.mjs";

const NOW = "2026-05-09T22:32:36.811Z";

function profile(overrides = {}) {
  return {
    agent_id: "review-seat",
    display_name: "Review Seat",
    user_agent_hint: "scheduled-reviewer",
    last_seen_at: "2026-05-09T22:25:00.000Z",
    current_status: "",
    current_status_updated_at: "2026-05-09T22:25:00.000Z",
    next_checkin_at: null,
    ...overrides,
  };
}

describe("autopilot liveness helpers", () => {
  it("returns normalized liveness for Jobs Manager without write-side actions", () => {
    const liveness = classifyProfileLiveness(profile(), { now: NOW });

    assert.equal(liveness.lane, "reviewer");
    assert.equal(liveness.freshness, "active");
    assert.equal(liveness.last_seen_age_minutes, 8);
  });

  it("extracts missed ACK signals with target lane hints and sanitized excerpts", () => {
    const signals = extractMissedAckSignals([
      {
        id: "msg-1",
        tags: ["needs-doing", "wakepass", "reroute"],
        recipients: ["review-seat"],
        text: "WakePass auto-reroute. Reason: missed ACK for Review Coordinator. token=sk-abc123456789",
        created_at: "2026-05-09T22:31:00.000Z",
      },
    ]);

    assert.equal(signals.length, 1);
    assert.deepEqual(signals[0].reason_codes, ["missed_ack", "reroute_requested", "wakepass_signal"]);
    assert.equal(signals[0].target_lane_hint, "reviewer");
    assert.equal(signals[0].excerpt, "[redacted-sensitive-text]");
  });

  it("offers adapter outputs for Review Coordinator and Jobs Manager callers", () => {
    const input = {
      now: NOW,
      profiles: [
        profile({
          current_status: "ACKed wake; deferred deep review to next active cycle",
        }),
      ],
      messages: [
        {
          id: "msg-2",
          tags: ["wakepass", "reroute"],
          text: "WakePass auto-reroute. Reason: missed ACK for Review Coordinator.",
          created_at: "2026-05-09T22:31:00.000Z",
        },
      ],
    };

    const reviewActions = buildReviewCoordinatorLivenessAdapter(input);
    const jobsSnapshot = buildJobsManagerLivenessAdapter(input);

    assert(reviewActions.some((action) => action.action === "reroute_missed_ack_to_live_worker"));
    assert.equal(jobsSnapshot.workers.length, 1);
    assert(jobsSnapshot.actions.some((action) => action.action === "separate_ack_from_diff_review"));
  });
});
