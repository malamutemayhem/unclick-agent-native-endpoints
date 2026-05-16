import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMergedPrDispatchReconciliationPlan,
  buildInProgressReconciliationPlan,
  buildJobsGithubSyncPlan,
  evaluatePrTodoReference,
  extractPullRequestNumbers,
  extractTodoReferenceIds,
  findNoTodoReason,
} from "./fishbowl-todo-reconciliation.mjs";

const TODO_A = "1100f5ec-5b94-4a7e-89ef-0da47d6a3017";
const TODO_B = "b744462e-8e50-4cad-babb-5468adc2a3d9";

describe("fishbowl todo reconciliation helpers", () => {
  it("extracts canonical UnClick todo references from body and commits", () => {
    const ids = extractTodoReferenceIds(
      "Small fix\n\nCloses UnClick todo: 1100f5ec-5b94-4a7e-89ef-0da47d6a3017",
      ["follow-up\n\nCloses Fishbowl todo: b744462e-8e50-4cad-babb-5468adc2a3d9"],
    );

    assert.deepEqual(ids, [TODO_A, TODO_B]);
  });

  it("requires a non-empty no-todo reason", () => {
    assert.equal(findNoTodoReason("no-todo: docs-only correction"), "docs-only correction");
    assert.equal(findNoTodoReason("no-todo:   "), null);
  });

  it("passes PR reference checks only for todo refs or explicit no-todo reasons", () => {
    assert.equal(evaluatePrTodoReference({ body: `Closes UnClick todo: ${TODO_A}` }).ok, true);
    assert.equal(evaluatePrTodoReference({ body: "no-todo: release note typo" }).ok, true);

    const missing = evaluatePrTodoReference({ body: "No linked work item here" });
    assert.equal(missing.ok, false);
    assert.equal(missing.reason, "missing_todo_reference");
  });

  it("plans auto-close only when an in-progress todo has a merged PR reference", () => {
    const plan = buildInProgressReconciliationPlan({
      now: "2026-05-08T12:00:00.000Z",
      todos: [
        {
          id: TODO_A,
          title: "linked shipped work",
          status: "in_progress",
          completed_at: null,
          updated_at: "2026-05-08T08:00:00.000Z",
        },
        {
          id: TODO_B,
          title: "closed but not merged work",
          status: "in_progress",
          completed_at: null,
          updated_at: "2026-05-08T08:00:00.000Z",
        },
      ],
      pullRequests: [
        {
          number: 600,
          merged_at: "2026-05-08T10:00:00.000Z",
          body: `Closes UnClick todo: ${TODO_A}`,
        },
        {
          number: 601,
          merged_at: null,
          body: `Closes UnClick todo: ${TODO_B}`,
        },
      ],
    });

    assert.equal(plan.ok, true);
    assert.deepEqual(plan.auto_close.map((item) => item.todo_id), [TODO_A]);
    assert.equal(plan.auto_close[0].reason, "linked_pr_marker");
    assert.deepEqual(plan.unchanged.map((item) => item.todo_id), [TODO_B]);
  });

  it("plans auto-close when an in-progress todo has pipeline ship proof for a merged PR", () => {
    const plan = buildInProgressReconciliationPlan({
      now: "2026-05-08T12:00:00.000Z",
      todos: [
        {
          id: TODO_A,
          title: "proof-complete work",
          status: "in_progress",
          completed_at: null,
          updated_at: "2026-05-08T08:00:00.000Z",
          pipeline_progress: 100,
          pipeline_source: "receipt: ship",
          comments: ["SHIP proof: PR #874 merged to main."],
        },
      ],
      pullRequests: [
        {
          number: 874,
          merged_at: "2026-05-08T10:00:00.000Z",
          body: "No explicit todo marker in this PR.",
        },
      ],
    });

    assert.equal(plan.ok, true);
    assert.deepEqual(plan.auto_close.map((item) => item.todo_id), [TODO_A]);
    assert.equal(plan.auto_close[0].reason, "pipeline_ship_proof");
    assert.equal(plan.auto_close[0].pr.number, 874);
  });

  it("does not auto-close pipeline ship proof when the referenced PR is unmerged", () => {
    const plan = buildInProgressReconciliationPlan({
      now: "2026-05-08T12:00:00.000Z",
      todos: [
        {
          id: TODO_A,
          title: "proof-complete work",
          status: "in_progress",
          completed_at: null,
          updated_at: "2026-05-08T08:00:00.000Z",
          pipeline_progress: 100,
          pipeline_source: "receipt: ship",
          proof_text: "SHIP proof pending on PR #874.",
        },
      ],
      pullRequests: [{ number: 874, merged_at: null }],
    });

    assert.equal(plan.ok, true);
    assert.equal(plan.auto_close.length, 0);
    assert.deepEqual(plan.unchanged.map((item) => item.todo_id), [TODO_A]);
  });

  it("surfaces old in-progress todos without marking them done", () => {
    const plan = buildInProgressReconciliationPlan({
      now: "2026-05-08T12:00:00.000Z",
      staleAfterDays: 7,
      todos: [
        {
          id: TODO_A,
          title: "old active card",
          status: "in_progress",
          assigned_to_agent_id: "builder-seat",
          completed_at: null,
          updated_at: "2026-04-30T12:00:00.000Z",
        },
      ],
      pullRequests: [],
    });

    assert.equal(plan.auto_close.length, 0);
    assert.equal(plan.stale.length, 1);
    assert.equal(plan.stale[0].todo_id, TODO_A);
    assert.equal(plan.stale[0].assigned_to_agent_id, "builder-seat");
  });

  it("extracts pull request numbers from job proof text", () => {
    assert.deepEqual(
      extractPullRequestNumbers(
        "Proof: PR #594",
        "https://github.com/malamutemayhem/unclick-agent-native-endpoints/pull/589",
      ),
      [589, 594],
    );
  });

  it("flags PRs that are not linked back to a Job", () => {
    const plan = buildJobsGithubSyncPlan({
      todos: [{ id: TODO_A, title: "Jobs sync", status: "in_progress" }],
      pullRequests: [{ number: 700, body: "Small change with no job marker" }],
    });

    assert.equal(plan.ok, true);
    assert.deepEqual(plan.issues.map((issue) => issue.kind), ["pr_needs_job_link"]);
    assert.equal(plan.issues[0].severity, "high");
  });

  it("flags a Job that mentions a PR when the PR lacks the Job marker", () => {
    const plan = buildJobsGithubSyncPlan({
      todos: [{ id: TODO_A, title: "Jobs sync PR #701", status: "in_progress" }],
      pullRequests: [{ number: 701, body: "Build proof, but no marker" }],
    });

    assert.equal(
      plan.issues.some((issue) => issue.kind === "job_mentions_pr_without_marker" && issue.pr_number === 701),
      true,
    );
  });

  it("flags active Jobs whose linked PR has already merged", () => {
    const plan = buildJobsGithubSyncPlan({
      todos: [{ id: TODO_A, title: "linked shipped work", status: "in_progress" }],
      pullRequests: [
        {
          number: 702,
          merged_at: "2026-05-09T02:00:00.000Z",
          body: `Closes UnClick todo: ${TODO_A}`,
        },
      ],
    });

    assert.equal(plan.linked.length, 1);
    assert.equal(plan.issues.some((issue) => issue.kind === "job_ready_to_complete"), true);
  });

  it("suppresses stale WakePass blockers when a merged PR has completion proof", () => {
    const plan = buildMergedPrDispatchReconciliationPlan({
      dispatches: [
        {
          id: "dispatch_pr_765",
          kind: "blocker",
          tags: ["dispatch", "wakepass", "stale"],
          summary:
            "wakepass stale owner-decision blocker for PR #765 https://github.com/malamutemayhem/unclick/pull/765",
        },
      ],
      pullRequests: [
        {
          number: 765,
          url: "https://github.com/malamutemayhem/unclick/pull/765",
          merged_at: "2026-05-13T14:38:03.000Z",
          merge_commit_sha: "e0b3714d8c6fdb6f989db71f2f17f117c6f754d4",
        },
      ],
      receipts: [
        {
          id: "wakepass_ack_765",
          tags: ["wakepass", "ack"],
          text: "ACK wake-pull_request-pr-765 merged PR #765; WakePass handoff complete.",
        },
      ],
    });

    assert.equal(plan.ok, true);
    assert.deepEqual(plan.suppress_blockers.map((item) => item.dispatch_id), ["dispatch_pr_765"]);
    assert.equal(plan.suppress_blockers[0].kind, "suppress_blocker");
    assert.equal(plan.suppress_blockers[0].pr_number, 765);
    assert.equal(plan.complete_dispatches.length, 0);
  });

  it("completes leased WakePass dispatches tied to merged PRs with proof", () => {
    const plan = buildMergedPrDispatchReconciliationPlan({
      dispatches: [
        {
          source_id: "dispatch_pr_773",
          kind: "wake",
          tags: ["dispatch", "wakepass", "needs-doing"],
          text: "Wake event: PR #773 is ready for review\nSource: https://github.com/malamutemayhem/unclick/pull/773",
        },
      ],
      pullRequests: [
        {
          number: 773,
          html_url: "https://github.com/malamutemayhem/unclick/pull/773",
          mergedAt: "2026-05-13T12:00:00.000Z",
          mergeCommit: { oid: "0d9a10f92ef59cdb5b18ad0de2724bcb721ff451" },
        },
      ],
      completionReceipts: [
        {
          id: "wakepass_ack_773",
          tags: ["wakepass", "completed"],
          text: "WakePass completed PR #773 after merge proof was posted.",
        },
      ],
    });

    assert.equal(plan.complete_dispatches.length, 1);
    assert.equal(plan.complete_dispatches[0].kind, "complete_dispatch");
    assert.equal(plan.complete_dispatches[0].dispatch_id, "dispatch_pr_773");
    assert.equal(plan.complete_dispatches[0].merge_commit, "0d9a10f92ef59cdb5b18ad0de2724bcb721ff451");
    assert.equal(plan.suppress_blockers.length, 0);
  });

  it("leaves open, draft, unmerged, and no-proof PR dispatches untouched", () => {
    const plan = buildMergedPrDispatchReconciliationPlan({
      dispatches: [
        { id: "open_dispatch", text: "Wake event: PR #800 is ready for review" },
        { id: "draft_dispatch", text: "Wake event: PR #801 is ready for review" },
        { id: "closed_unmerged_dispatch", text: "Wake event: PR #802 is ready for review" },
        { id: "merged_no_proof_dispatch", text: "Wake event: PR #803 is ready for review" },
      ],
      pullRequests: [
        { number: 800, state: "open", merged_at: null },
        { number: 801, isDraft: true, merged_at: null },
        { number: 802, state: "closed", merged_at: null },
        { number: 803, state: "closed", merged_at: "2026-05-13T12:00:00.000Z" },
      ],
      receipts: [
        {
          id: "unrelated_ack",
          tags: ["wakepass", "ack"],
          text: "ACK wake-pull_request-pr-999 merged PR #999; WakePass handoff complete.",
        },
      ],
    });

    assert.equal(plan.complete_dispatches.length, 0);
    assert.equal(plan.suppress_blockers.length, 0);
    assert.deepEqual(
      plan.untouched.map((item) => item.reason),
      ["pr_not_merged", "pr_draft", "pr_not_merged", "missing_wakepass_completion_proof"],
    );
  });
});
