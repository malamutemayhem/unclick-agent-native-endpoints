import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
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
    assert.deepEqual(plan.unchanged.map((item) => item.todo_id), [TODO_B]);
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
});
