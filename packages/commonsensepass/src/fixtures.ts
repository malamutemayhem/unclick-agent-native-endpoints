import type {
  ClaimInput,
  CommonSensePassResult,
  Verdict,
} from "./schema.js";

export interface CommonSensePassFixture {
  id: string;
  title: string;
  expected_verdict: Verdict;
  input?: ClaimInput;
  expected_rule_id?: CommonSensePassResult["rule_id"];
  reserved_result?: CommonSensePassResult;
  notes: string;
}

const NOW_MS = 1_765_000_000_000;
const HEAD_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const STALE_SHA = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

export const COMMONSENSEPASS_WORKER_FIXTURES = [
  {
    id: "false-quiet-with-backlog",
    title: "False quiet while actionable work exists",
    expected_verdict: "BLOCKER",
    expected_rule_id: "R1",
    input: {
      claim: "quiet",
      context: {
        now_ms: NOW_MS,
        active_jobs: 0,
        todos: [{ id: "todo-actionable-1", status: "actionable" }],
      },
    },
    notes: "Worker says quiet, but a queued todo is waiting.",
  },
  {
    id: "no-work-with-backlog",
    title: "No-work claim with backlog",
    expected_verdict: "BLOCKER",
    expected_rule_id: "R1",
    input: {
      claim: "no_work",
      context: {
        now_ms: NOW_MS,
        active_jobs: 0,
        todos: [
          { id: "todo-actionable-2", status: "actionable" },
          { id: "todo-queued-1", status: "queued" },
        ],
      },
    },
    notes: "Worker says there is no work, but actionable queue depth is nonzero.",
  },
  {
    id: "fresh-active-job-underreported",
    title: "Fresh in-progress job underreported as zero active jobs",
    expected_verdict: "BLOCKER",
    expected_rule_id: "R1",
    input: {
      claim: "healthy",
      context: {
        now_ms: NOW_MS,
        active_jobs: 0,
        todos: [
          {
            id: "todo-active-fresh",
            status: "in_progress",
            owner: "runner-builder",
            owner_last_seen_ms: NOW_MS - 60_000,
          },
        ],
      },
    },
    notes: "The pinned active_jobs formula should count fresh owned in-progress work.",
  },
  {
    id: "quiet-empty-queue-pass",
    title: "Quiet claim with empty queue",
    expected_verdict: "PASS",
    expected_rule_id: "R1",
    input: {
      claim: "quiet",
      context: {
        now_ms: NOW_MS,
        active_jobs: 0,
        todos: [],
      },
    },
    notes: "Baseline PASS for a genuinely empty queue.",
  },
  {
    id: "stale-proof-pass",
    title: "PASS proof posted on a stale SHA",
    expected_verdict: "BLOCKER",
    expected_rule_id: "R2",
    input: {
      claim: "pass",
      context: {
        now_ms: NOW_MS,
        current_head_sha: HEAD_SHA,
        commented_on_sha: STALE_SHA,
      },
    },
    notes: "A stale PASS must be re-reviewed on the current head.",
  },
  {
    id: "pass-missing-sha-hold",
    title: "PASS proof missing SHA evidence",
    expected_verdict: "HOLD",
    expected_rule_id: "R2",
    input: {
      claim: "pass",
      context: {
        now_ms: NOW_MS,
        current_head_sha: HEAD_SHA,
      },
    },
    notes: "Freshness cannot be checked until both SHA fields are present.",
  },
  {
    id: "duplicate-wake-suppress",
    title: "Duplicate wake with unchanged state",
    expected_verdict: "SUPPRESS",
    expected_rule_id: "R3",
    input: {
      claim: "duplicate_wake",
      context: {
        now_ms: NOW_MS,
        current_wake: {
          id: "wake-123",
          state_fingerprint: "same-state",
          emitted_ms: NOW_MS,
        },
        recent_wakes: [
          {
            id: "wake-123",
            state_fingerprint: "same-state",
            emitted_ms: NOW_MS - 60_000,
          },
        ],
      },
    },
    notes: "Repeated wake adds no signal and should be suppressed.",
  },
  {
    id: "done-without-proof",
    title: "Done claim without complete proof",
    expected_verdict: "BLOCKER",
    expected_rule_id: "R4",
    input: {
      claim: "done",
      context: {
        now_ms: NOW_MS,
        subject_todo_id: "todo-done-weak",
        todos: [
          {
            id: "todo-done-weak",
            status: "in_progress",
            pipeline: 80,
          },
        ],
      },
    },
    notes: "Done needs pipeline 100 and a closing PR or commit reference.",
  },
  {
    id: "done-with-proof-pass",
    title: "Done claim with closing proof",
    expected_verdict: "PASS",
    expected_rule_id: "R4",
    input: {
      claim: "done",
      context: {
        now_ms: NOW_MS,
        subject_todo_id: "todo-done-strong",
        todos: [
          {
            id: "todo-done-strong",
            status: "in_progress",
            pipeline: 100,
            closing_ref: "PR #892",
          },
        ],
      },
    },
    notes: "A done claim is acceptable when both required proof fields are present.",
  },
  {
    id: "merge-ready-without-proof",
    title: "Merge-ready claim missing Reviewer and Safety PASS",
    expected_verdict: "HOLD",
    expected_rule_id: "R5",
    input: {
      claim: "merge_ready",
      context: {
        now_ms: NOW_MS,
        pr: {
          number: 892,
          head_sha: HEAD_SHA,
          mergeable: true,
          checks_state: "success",
        },
      },
    },
    notes: "A green PR still needs Reviewer PASS and Safety PASS on head.",
  },
  {
    id: "merge-ready-red-checks",
    title: "Merge-ready claim with failing checks",
    expected_verdict: "BLOCKER",
    expected_rule_id: "R5",
    input: {
      claim: "merge_ready",
      context: {
        now_ms: NOW_MS,
        pr: {
          number: 893,
          head_sha: HEAD_SHA,
          mergeable: true,
          checks_state: "failure",
          reviewer_pass: { verdict: "PASS", sha: HEAD_SHA },
          safety_pass: { verdict: "PASS", sha: HEAD_SHA },
        },
      },
    },
    notes: "Failing checks stop autopilot merge even when review proof exists.",
  },
  {
    id: "merge-ready-with-proof-pass",
    title: "Merge-ready claim with complete proof",
    expected_verdict: "PASS",
    expected_rule_id: "R5",
    input: {
      claim: "merge_ready",
      context: {
        now_ms: NOW_MS,
        pr: {
          number: 894,
          head_sha: HEAD_SHA,
          mergeable: true,
          checks_state: "success",
          reviewer_pass: { verdict: "PASS", sha: HEAD_SHA },
          safety_pass: { verdict: "PASS", sha: HEAD_SHA },
        },
      },
    },
    notes: "Autopilot merge proof is complete and current.",
  },
  {
    id: "reserved-route-specialist",
    title: "Reserved ROUTE exemplar for specialist lanes",
    expected_verdict: "ROUTE",
    expected_rule_id: null,
    reserved_result: {
      verdict: "ROUTE",
      rule_id: null,
      reason: "Reserved fixture for claims that should move to a specialist lane.",
      evidence: [{ kind: "lane", ref: "securitypass" }],
      next_action: "route_to_specialist",
      route_to: "securitypass",
    },
    notes: "ROUTE is part of the public verdict shape but is not emitted by R1-R5 yet.",
  },
] satisfies readonly CommonSensePassFixture[];

export function fixtureIdsByVerdict(
  fixtures: readonly CommonSensePassFixture[] = COMMONSENSEPASS_WORKER_FIXTURES,
): Record<Verdict, string[]> {
  const ids: Record<Verdict, string[]> = {
    PASS: [],
    BLOCKER: [],
    HOLD: [],
    SUPPRESS: [],
    ROUTE: [],
  };

  for (const fixture of fixtures) {
    ids[fixture.expected_verdict].push(fixture.id);
  }

  return ids;
}
