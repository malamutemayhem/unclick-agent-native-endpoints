import {
  ClaimInput,
  CommonSensePassResult,
  TodoSnapshot,
  OWNER_FRESH_WINDOW_MS,
  DUPLICATE_WAKE_WINDOW_MS,
} from "./schema.js";

function pickSubject(input: ClaimInput): TodoSnapshot | undefined {
  const todos = input.context.todos ?? [];
  if (input.context.subject_todo_id) {
    return todos.find((t) => t.id === input.context.subject_todo_id);
  }
  return todos[0];
}

/**
 * R1 - Active-state mismatch.
 *
 * Fires on "healthy" / "quiet" / "no_work" claims. The active_jobs definition
 * is pinned to:
 *   active_jobs = COUNT(todos WHERE status='in_progress' AND owner_last_seen <= 24h)
 * BLOCKER if:
 *   - actionable queue depth > 0 (worker is claiming no work while jobs wait), OR
 *   - claimed active_jobs === 0 but in-progress fresh-owner todos exist.
 */
export function checkR1(input: ClaimInput): CommonSensePassResult | null {
  if (
    input.claim !== "healthy" &&
    input.claim !== "quiet" &&
    input.claim !== "no_work"
  ) {
    return null;
  }
  const todos = input.context.todos ?? [];
  const now = input.context.now_ms;

  const actionable = todos.filter((t) => t.status === "actionable");
  const inProgressFresh = todos.filter(
    (t) =>
      t.status === "in_progress" &&
      typeof t.owner_last_seen_ms === "number" &&
      now - t.owner_last_seen_ms <= OWNER_FRESH_WINDOW_MS,
  );

  if (actionable.length > 0) {
    return {
      verdict: "BLOCKER",
      rule_id: "R1",
      reason: `Claim "${input.claim}" but ${actionable.length} actionable todo(s) are queued.`,
      evidence: actionable.slice(0, 5).map((t) => ({
        kind: "todo",
        ref: t.id,
        note: `status=${t.status}`,
      })),
      next_action: "hydrate_queue_and_claim_one",
    };
  }

  if (
    typeof input.context.active_jobs === "number" &&
    input.context.active_jobs === 0 &&
    inProgressFresh.length > 0
  ) {
    return {
      verdict: "BLOCKER",
      rule_id: "R1",
      reason: `Claim "${input.claim}" with active_jobs=0 but ${inProgressFresh.length} in-progress todo(s) have a fresh owner; active_jobs is underreporting.`,
      evidence: inProgressFresh.slice(0, 5).map((t) => ({
        kind: "todo",
        ref: t.id,
        note: `in_progress, owner_last_seen_ms=${t.owner_last_seen_ms}`,
      })),
      next_action: "recompute_active_jobs_with_pinned_formula",
    };
  }

  return {
    verdict: "PASS",
    rule_id: "R1",
    reason: "Active-state claim consistent with queue and active_jobs.",
    evidence: [
      { kind: "queue", ref: `actionable=${actionable.length}` },
      { kind: "queue", ref: `in_progress_fresh=${inProgressFresh.length}` },
      {
        kind: "queue",
        ref: `active_jobs=${input.context.active_jobs ?? "absent"}`,
      },
    ],
  };
}

/**
 * R2 - Head SHA freshness.
 *
 * A "pass" claim authored on a SHA that no longer matches the PR head is stale.
 */
export function checkR2(input: ClaimInput): CommonSensePassResult | null {
  if (input.claim !== "pass") return null;
  const head = input.context.current_head_sha;
  const commented = input.context.commented_on_sha;

  if (!head || !commented) {
    return {
      verdict: "HOLD",
      rule_id: "R2",
      reason:
        "PASS claim missing head_sha or commented_on_sha; cannot verify freshness.",
      evidence: [
        { kind: "context", ref: `current_head_sha=${head ?? "missing"}` },
        { kind: "context", ref: `commented_on_sha=${commented ?? "missing"}` },
      ],
      next_action: "supply_head_and_commented_sha",
    };
  }
  if (commented !== head) {
    return {
      verdict: "BLOCKER",
      rule_id: "R2",
      reason: `PASS authored on ${commented.slice(0, 7)} but current head is ${head.slice(0, 7)}; PASS is stale.`,
      evidence: [
        { kind: "sha", ref: commented, note: "commented_on" },
        { kind: "sha", ref: head, note: "current_head" },
      ],
      next_action: "re_review_on_current_head",
    };
  }
  return {
    verdict: "PASS",
    rule_id: "R2",
    reason: "PASS authored on current head SHA.",
    evidence: [{ kind: "sha", ref: head, note: "head=commented" }],
  };
}

/**
 * R3 - Duplicate wake suppression.
 *
 * Same id and state_fingerprint emitted inside the duplicate-wake window
 * adds no signal; suppress.
 */
export function checkR3(input: ClaimInput): CommonSensePassResult | null {
  if (input.claim !== "duplicate_wake") return null;
  const current = input.context.current_wake;
  const recent = input.context.recent_wakes ?? [];

  if (!current) {
    return {
      verdict: "HOLD",
      rule_id: "R3",
      reason: "duplicate_wake claim missing current_wake context.",
      evidence: [{ kind: "context", ref: "current_wake=missing" }],
      next_action: "include_current_wake",
    };
  }

  const duplicate = recent.find(
    (w) =>
      w.id === current.id &&
      w.state_fingerprint === current.state_fingerprint &&
      input.context.now_ms - w.emitted_ms <= DUPLICATE_WAKE_WINDOW_MS,
  );

  if (duplicate) {
    const minutes = Math.round(DUPLICATE_WAKE_WINDOW_MS / 60000);
    return {
      verdict: "SUPPRESS",
      rule_id: "R3",
      reason: `Wake ${current.id} already emitted within ${minutes}min with matching state fingerprint.`,
      evidence: [
        {
          kind: "wake",
          ref: duplicate.id,
          note: `prior emitted_ms=${duplicate.emitted_ms}`,
        },
        {
          kind: "wake",
          ref: current.id,
          note: `now emitted_ms=${current.emitted_ms}`,
        },
        { kind: "fingerprint", ref: current.state_fingerprint },
      ],
    };
  }

  return {
    verdict: "PASS",
    rule_id: "R3",
    reason: "Wake is not a duplicate of any recent wake with matching state.",
    evidence: [
      { kind: "wake", ref: current.id, note: current.state_fingerprint },
    ],
  };
}

/**
 * R4 - Done without proof.
 *
 * "done" requires pipeline === 100 AND a closing_ref on the subject todo.
 */
export function checkR4(input: ClaimInput): CommonSensePassResult | null {
  if (input.claim !== "done") return null;
  const subject = pickSubject(input);
  if (!subject) {
    return {
      verdict: "HOLD",
      rule_id: "R4",
      reason: "done claim has no subject todo in context.",
      evidence: [{ kind: "context", ref: "todos=empty" }],
      next_action: "include_target_todo",
    };
  }
  const missing: string[] = [];
  if (!subject.closing_ref) missing.push("closing_ref");
  if (subject.pipeline !== 100) {
    missing.push(`pipeline=${subject.pipeline ?? "missing"}`);
  }
  if (missing.length > 0) {
    return {
      verdict: "BLOCKER",
      rule_id: "R4",
      reason: `done claim on ${subject.id} missing proof: ${missing.join(", ")}.`,
      evidence: [
        {
          kind: "todo",
          ref: subject.id,
          note: `pipeline=${subject.pipeline ?? "missing"}`,
        },
        {
          kind: "todo",
          ref: subject.id,
          note: `closing_ref=${subject.closing_ref ?? "missing"}`,
        },
      ],
      next_action: "attach_closing_pr_or_commit_and_set_pipeline_100",
    };
  }
  return {
    verdict: "PASS",
    rule_id: "R4",
    reason: `done claim on ${subject.id} has proof.`,
    evidence: [
      { kind: "todo", ref: subject.id, note: "pipeline=100" },
      {
        kind: "todo",
        ref: subject.id,
        note: `closing_ref=${subject.closing_ref}`,
      },
    ],
  };
}

/**
 * R5 - Merge-ready without proof.
 *
 * "merge_ready" requires:
 *   - PR is mergeable
 *   - checks_state === "success"
 *   - Reviewer PASS present and authored on the PR's current head SHA.
 *   - Safety PASS present and authored on the PR's current head SHA.
 */
export function checkR5(input: ClaimInput): CommonSensePassResult | null {
  if (input.claim !== "merge_ready") return null;
  const pr = input.context.pr;
  if (!pr) {
    return {
      verdict: "HOLD",
      rule_id: "R5",
      reason: "merge_ready claim without PR snapshot.",
      evidence: [{ kind: "context", ref: "pr=missing" }],
      next_action: "include_pr_snapshot",
    };
  }
  if (!pr.mergeable) {
    return {
      verdict: "BLOCKER",
      rule_id: "R5",
      reason: `PR #${pr.number} is not mergeable.`,
      evidence: [{ kind: "pr", ref: `#${pr.number}`, note: "mergeable=false" }],
      next_action: "rebase_or_resolve_conflicts",
    };
  }
  if (pr.checks_state !== "success") {
    return {
      verdict: "BLOCKER",
      rule_id: "R5",
      reason: `PR #${pr.number} checks state is "${pr.checks_state}", not success.`,
      evidence: [
        { kind: "pr", ref: `#${pr.number}`, note: `checks=${pr.checks_state}` },
      ],
      next_action: "wait_for_green_checks",
    };
  }
  const reviewer = pr.reviewer_pass;
  if (!reviewer || reviewer.verdict !== "PASS") {
    return {
      verdict: "HOLD",
      rule_id: "R5",
      reason: `PR #${pr.number} has no Reviewer PASS.`,
      evidence: [
        {
          kind: "pr",
          ref: `#${pr.number}`,
          note: `reviewer=${reviewer?.verdict ?? "missing"}`,
        },
      ],
      next_action: "request_reviewer_pass",
    };
  }
  if (reviewer.sha !== pr.head_sha) {
    return {
      verdict: "BLOCKER",
      rule_id: "R5",
      reason: `Reviewer PASS on PR #${pr.number} authored on ${reviewer.sha.slice(0, 7)} but head is ${pr.head_sha.slice(0, 7)}.`,
      evidence: [
        { kind: "sha", ref: reviewer.sha, note: "reviewer_pass_sha" },
        { kind: "sha", ref: pr.head_sha, note: "head_sha" },
      ],
      next_action: "re_review_on_current_head",
    };
  }
  const safety = pr.safety_pass;
  if (!safety || safety.verdict !== "PASS") {
    return {
      verdict: "HOLD",
      rule_id: "R5",
      reason: `PR #${pr.number} has no Safety PASS.`,
      evidence: [
        {
          kind: "pr",
          ref: `#${pr.number}`,
          note: `safety=${safety?.verdict ?? "missing"}`,
        },
      ],
      next_action: "request_safety_pass",
    };
  }
  if (safety.sha !== pr.head_sha) {
    return {
      verdict: "BLOCKER",
      rule_id: "R5",
      reason: `Safety PASS on PR #${pr.number} authored on ${safety.sha.slice(0, 7)} but head is ${pr.head_sha.slice(0, 7)}.`,
      evidence: [
        { kind: "sha", ref: safety.sha, note: "safety_pass_sha" },
        { kind: "sha", ref: pr.head_sha, note: "head_sha" },
      ],
      next_action: "re_run_safety_check_on_current_head",
    };
  }
  return {
    verdict: "PASS",
    rule_id: "R5",
    reason: `PR #${pr.number} is merge-ready: mergeable, checks green, Reviewer PASS and Safety PASS on head.`,
    evidence: [
      { kind: "pr", ref: `#${pr.number}`, note: "mergeable" },
      { kind: "pr", ref: `#${pr.number}`, note: "checks=success" },
      { kind: "sha", ref: pr.head_sha, note: "reviewer_pass_on_head" },
      { kind: "sha", ref: pr.head_sha, note: "safety_pass_on_head" },
    ],
  };
}
