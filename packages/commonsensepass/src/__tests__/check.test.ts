import { describe, expect, it } from "vitest";
import { commonsensepassCheck } from "../check.js";
import {
  ClaimInput,
  OWNER_FRESH_WINDOW_MS,
  DUPLICATE_WAKE_WINDOW_MS,
} from "../schema.js";

const NOW = 1_750_000_000_000;

function ctx(overrides: Partial<ClaimInput["context"]> = {}): ClaimInput["context"] {
  return { now_ms: NOW, ...overrides };
}

describe("commonsensepassCheck - R1 active-state mismatch", () => {
  it("BLOCKER when claiming healthy with actionable todos in the queue", () => {
    const result = commonsensepassCheck({
      claim: "healthy",
      context: ctx({
        todos: [
          { id: "t1", status: "actionable" },
          { id: "t2", status: "actionable" },
        ],
        active_jobs: 0,
      }),
    });
    expect(result.verdict).toBe("BLOCKER");
    expect(result.rule_id).toBe("R1");
    expect(result.next_action).toBe("hydrate_queue_and_claim_one");
    expect(result.evidence.map((e) => e.ref)).toContain("t1");
  });

  it("BLOCKER when active_jobs=0 but in-progress todos have fresh owners", () => {
    const result = commonsensepassCheck({
      claim: "quiet",
      context: ctx({
        todos: [
          {
            id: "t3",
            status: "in_progress",
            owner_last_seen_ms: NOW - 60_000,
          },
        ],
        active_jobs: 0,
      }),
    });
    expect(result.verdict).toBe("BLOCKER");
    expect(result.rule_id).toBe("R1");
    expect(result.next_action).toBe("recompute_active_jobs_with_pinned_formula");
  });

  it("PASS when in-progress owner is stale (beyond 24h window)", () => {
    const result = commonsensepassCheck({
      claim: "quiet",
      context: ctx({
        todos: [
          {
            id: "t4",
            status: "in_progress",
            owner_last_seen_ms: NOW - OWNER_FRESH_WINDOW_MS - 1,
          },
        ],
        active_jobs: 0,
      }),
    });
    expect(result.verdict).toBe("PASS");
    expect(result.rule_id).toBe("R1");
  });

  it("PASS when no actionable todos and active_jobs matches in-progress count", () => {
    const result = commonsensepassCheck({
      claim: "no_work",
      context: ctx({
        todos: [
          { id: "t5", status: "in_progress", owner_last_seen_ms: NOW - 1000 },
        ],
        active_jobs: 1,
      }),
    });
    expect(result.verdict).toBe("PASS");
    expect(result.rule_id).toBe("R1");
  });
});

describe("commonsensepassCheck - R2 head SHA freshness", () => {
  it("BLOCKER when PASS authored on stale SHA", () => {
    const result = commonsensepassCheck({
      claim: "pass",
      context: ctx({
        current_head_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        commented_on_sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      }),
    });
    expect(result.verdict).toBe("BLOCKER");
    expect(result.rule_id).toBe("R2");
    expect(result.next_action).toBe("re_review_on_current_head");
  });

  it("PASS when commented_on_sha matches current_head_sha", () => {
    const sha = "cccccccccccccccccccccccccccccccccccccccc";
    const result = commonsensepassCheck({
      claim: "pass",
      context: ctx({
        current_head_sha: sha,
        commented_on_sha: sha,
      }),
    });
    expect(result.verdict).toBe("PASS");
    expect(result.rule_id).toBe("R2");
  });

  it("HOLD when SHAs are missing", () => {
    const result = commonsensepassCheck({
      claim: "pass",
      context: ctx({}),
    });
    expect(result.verdict).toBe("HOLD");
    expect(result.rule_id).toBe("R2");
  });
});

describe("commonsensepassCheck - R3 duplicate wake suppression", () => {
  it("SUPPRESS when same id+fingerprint emitted within window", () => {
    const result = commonsensepassCheck({
      claim: "duplicate_wake",
      context: ctx({
        current_wake: {
          id: "wake-123",
          state_fingerprint: "fp-A",
          emitted_ms: NOW,
        },
        recent_wakes: [
          {
            id: "wake-123",
            state_fingerprint: "fp-A",
            emitted_ms: NOW - 60_000,
          },
        ],
      }),
    });
    expect(result.verdict).toBe("SUPPRESS");
    expect(result.rule_id).toBe("R3");
  });

  it("PASS when fingerprint differs", () => {
    const result = commonsensepassCheck({
      claim: "duplicate_wake",
      context: ctx({
        current_wake: {
          id: "wake-123",
          state_fingerprint: "fp-B",
          emitted_ms: NOW,
        },
        recent_wakes: [
          {
            id: "wake-123",
            state_fingerprint: "fp-A",
            emitted_ms: NOW - 60_000,
          },
        ],
      }),
    });
    expect(result.verdict).toBe("PASS");
    expect(result.rule_id).toBe("R3");
  });

  it("PASS when prior wake is outside the duplicate window", () => {
    const result = commonsensepassCheck({
      claim: "duplicate_wake",
      context: ctx({
        current_wake: {
          id: "wake-123",
          state_fingerprint: "fp-A",
          emitted_ms: NOW,
        },
        recent_wakes: [
          {
            id: "wake-123",
            state_fingerprint: "fp-A",
            emitted_ms: NOW - DUPLICATE_WAKE_WINDOW_MS - 1,
          },
        ],
      }),
    });
    expect(result.verdict).toBe("PASS");
  });

  it("HOLD when current_wake is missing", () => {
    const result = commonsensepassCheck({
      claim: "duplicate_wake",
      context: ctx({}),
    });
    expect(result.verdict).toBe("HOLD");
    expect(result.rule_id).toBe("R3");
  });
});

describe("commonsensepassCheck - R4 done without proof", () => {
  it("BLOCKER when pipeline < 100", () => {
    const result = commonsensepassCheck({
      claim: "done",
      context: ctx({
        todos: [
          {
            id: "t10",
            status: "in_progress",
            pipeline: 80,
            closing_ref: "#999",
          },
        ],
      }),
    });
    expect(result.verdict).toBe("BLOCKER");
    expect(result.rule_id).toBe("R4");
  });

  it("BLOCKER when closing_ref is missing", () => {
    const result = commonsensepassCheck({
      claim: "done",
      context: ctx({
        todos: [{ id: "t11", status: "in_progress", pipeline: 100 }],
      }),
    });
    expect(result.verdict).toBe("BLOCKER");
    expect(result.rule_id).toBe("R4");
  });

  it("PASS when pipeline=100 and closing_ref present", () => {
    const result = commonsensepassCheck({
      claim: "done",
      context: ctx({
        todos: [
          {
            id: "t12",
            status: "in_progress",
            pipeline: 100,
            closing_ref: "#735",
          },
        ],
      }),
    });
    expect(result.verdict).toBe("PASS");
    expect(result.rule_id).toBe("R4");
  });

  it("uses subject_todo_id when provided", () => {
    const result = commonsensepassCheck({
      claim: "done",
      context: ctx({
        subject_todo_id: "target",
        todos: [
          { id: "other", status: "actionable" },
          {
            id: "target",
            status: "in_progress",
            pipeline: 100,
            closing_ref: "#1",
          },
        ],
      }),
    });
    expect(result.verdict).toBe("PASS");
    expect(result.evidence.some((e) => e.ref === "target")).toBe(true);
  });
});

describe("commonsensepassCheck - R5 merge-ready without proof", () => {
  const headSha = "1111111111111111111111111111111111111111";
  const staleSha = "2222222222222222222222222222222222222222";

  it("BLOCKER when PR is not mergeable", () => {
    const result = commonsensepassCheck({
      claim: "merge_ready",
      context: ctx({
        pr: {
          number: 100,
          head_sha: headSha,
          mergeable: false,
          checks_state: "success",
          reviewer_pass: { verdict: "PASS", sha: headSha },
        },
      }),
    });
    expect(result.verdict).toBe("BLOCKER");
    expect(result.rule_id).toBe("R5");
  });

  it("BLOCKER when checks are not success", () => {
    const result = commonsensepassCheck({
      claim: "merge_ready",
      context: ctx({
        pr: {
          number: 101,
          head_sha: headSha,
          mergeable: true,
          checks_state: "failure",
          reviewer_pass: { verdict: "PASS", sha: headSha },
        },
      }),
    });
    expect(result.verdict).toBe("BLOCKER");
    expect(result.rule_id).toBe("R5");
  });

  it("HOLD when reviewer PASS is missing", () => {
    const result = commonsensepassCheck({
      claim: "merge_ready",
      context: ctx({
        pr: {
          number: 102,
          head_sha: headSha,
          mergeable: true,
          checks_state: "success",
        },
      }),
    });
    expect(result.verdict).toBe("HOLD");
    expect(result.rule_id).toBe("R5");
  });

  it("BLOCKER when reviewer PASS is on a stale SHA", () => {
    const result = commonsensepassCheck({
      claim: "merge_ready",
      context: ctx({
        pr: {
          number: 103,
          head_sha: headSha,
          mergeable: true,
          checks_state: "success",
          reviewer_pass: { verdict: "PASS", sha: staleSha },
        },
      }),
    });
    expect(result.verdict).toBe("BLOCKER");
    expect(result.rule_id).toBe("R5");
  });

  it("PASS when mergeable, green, and reviewer PASS on head", () => {
    const result = commonsensepassCheck({
      claim: "merge_ready",
      context: ctx({
        pr: {
          number: 104,
          head_sha: headSha,
          mergeable: true,
          checks_state: "success",
          reviewer_pass: { verdict: "PASS", sha: headSha },
        },
      }),
    });
    expect(result.verdict).toBe("PASS");
    expect(result.rule_id).toBe("R5");
  });

  it("HOLD when PR snapshot is missing", () => {
    const result = commonsensepassCheck({
      claim: "merge_ready",
      context: ctx({}),
    });
    expect(result.verdict).toBe("HOLD");
    expect(result.rule_id).toBe("R5");
  });
});

describe("commonsensepassCheck - verdict coverage", () => {
  it("emits all five verdict types across the rule set", () => {
    const verdicts = new Set<string>();

    // PASS - healthy with empty queue, no in-progress todos
    verdicts.add(
      commonsensepassCheck({
        claim: "healthy",
        context: ctx({ todos: [], active_jobs: 0 }),
      }).verdict,
    );

    // BLOCKER - R1 actionable
    verdicts.add(
      commonsensepassCheck({
        claim: "healthy",
        context: ctx({ todos: [{ id: "x", status: "actionable" }] }),
      }).verdict,
    );

    // HOLD - R5 missing PR
    verdicts.add(
      commonsensepassCheck({ claim: "merge_ready", context: ctx({}) }).verdict,
    );

    // SUPPRESS - R3 duplicate
    verdicts.add(
      commonsensepassCheck({
        claim: "duplicate_wake",
        context: ctx({
          current_wake: {
            id: "w",
            state_fingerprint: "f",
            emitted_ms: NOW,
          },
          recent_wakes: [
            { id: "w", state_fingerprint: "f", emitted_ms: NOW - 1000 },
          ],
        }),
      }).verdict,
    );

    expect(verdicts.has("PASS")).toBe(true);
    expect(verdicts.has("BLOCKER")).toBe(true);
    expect(verdicts.has("HOLD")).toBe(true);
    expect(verdicts.has("SUPPRESS")).toBe(true);
  });

  it("returns default PASS for an unrecognized claim wired via type-cast", () => {
    const result = commonsensepassCheck({
      // deliberately bypass the type to exercise the default branch
      claim: "unknown_claim_kind" as ClaimInput["claim"],
      context: ctx({}),
    });
    expect(result.verdict).toBe("PASS");
    expect(result.rule_id).toBeNull();
  });
});
