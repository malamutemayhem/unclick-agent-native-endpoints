import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateTier2AutoMergeQueue,
  fetchOpenPullRequests,
  runTier2AutoMergeQueueCheck,
  scoreTier2PullRequestRisk,
} from "./tier2-auto-merge-queue-check.mjs";

describe("Tier-2 auto-merge queue check", () => {
  it("reports a scheduled no-op when the live PR queue is empty", () => {
    const result = evaluateTier2AutoMergeQueue({
      prs: [],
      now: "2026-05-09T08:45:00.000Z",
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "idle");
    assert.equal(result.reason, "open_pr_queue_empty");
    assert.equal(result.open_pr_count, 0);
    assert.equal(result.low_risk_count, 0);
    assert.equal(result.execute, false);
    assert.equal(result.no_execute_reason, "audit_only_no_merge_execution");
    assert.equal(result.candidate_count, 0);
    assert.deepEqual(result.candidate_pr_numbers, []);
    assert.deepEqual(result.blocked_prs, []);
  });

  it("fails closed when open PRs exist because this check never merges", () => {
    const result = evaluateTier2AutoMergeQueue({
      prs: [
        {
          number: 604,
          isDraft: false,
          mergeStateStatus: "CLEAN",
          url: "https://github.com/malamutemayhem/unclick-agent-native-endpoints/pull/604",
          headRefName: "codex/example",
          changedFiles: 2,
          additions: 80,
          deletions: 20,
        },
      ],
      now: "2026-05-09T08:45:00.000Z",
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "queue_not_empty");
    assert.equal(result.reason, "scheduled_noop_check_only");
    assert.equal(result.open_pr_count, 1);
    assert.equal(result.safe_to_merge_count, 0);
    assert.equal(result.low_risk_count, 1);
    assert.equal(result.execute, false);
    assert.equal(result.no_execute_reason, "audit_only_no_merge_execution");
    assert.equal(result.candidate_count, 1);
    assert.deepEqual(result.candidate_pr_numbers, [604]);
    assert.deepEqual(result.blocked_prs, []);
    assert.deepEqual(result.summaries[0], {
      number: 604,
      isDraft: false,
      mergeStateStatus: "CLEAN",
      url: "https://github.com/malamutemayhem/unclick-agent-native-endpoints/pull/604",
      headRefName: "codex/example",
      changedFiles: 2,
      additions: 80,
      deletions: 20,
      risk_score: 0,
      risk_level: "low",
      risk_reasons: [],
    });
  });

  it("audits candidates and blocked PRs without granting merge execution", () => {
    const result = evaluateTier2AutoMergeQueue({
      prs: [
        {
          number: 640,
          isDraft: false,
          mergeStateStatus: "CLEAN",
          url: "https://github.com/malamutemayhem/unclick-agent-native-endpoints/pull/640",
          headRefName: "codex/docs-chip",
          changedFiles: 2,
          additions: 20,
          deletions: 5,
        },
        {
          number: 641,
          isDraft: true,
          mergeStateStatus: "DIRTY",
          url: "https://github.com/malamutemayhem/unclick-agent-native-endpoints/pull/641",
          headRefName: "codex/auth-migration",
          changedFiles: 35,
          additions: 1500,
          deletions: 750,
        },
      ],
      now: "2026-05-09T08:45:00.000Z",
    });

    assert.equal(result.execute, false);
    assert.equal(result.safe_to_merge_count, 0);
    assert.equal(result.candidate_count, 1);
    assert.deepEqual(result.candidate_pr_numbers, [640]);
    assert.deepEqual(result.blocked_reasons_by_pr["#641"], [
      "draft",
      "merge_state_dirty",
      "risk_high",
      "many_files",
      "large_diff",
      "sensitive_branch_name",
    ]);
    assert.deepEqual(result.blocked_prs, [
      {
        number: 641,
        reasons: [
          "draft",
          "merge_state_dirty",
          "risk_high",
          "many_files",
          "large_diff",
          "sensitive_branch_name",
        ],
      },
    ]);
  });

  it("adds a conservative PR risk score to queue summaries", () => {
    const low = scoreTier2PullRequestRisk({
      isDraft: false,
      mergeStateStatus: "CLEAN",
      changedFiles: 2,
      additions: 80,
      deletions: 20,
      headRefName: "codex/docs-chip",
    });
    const high = scoreTier2PullRequestRisk({
      isDraft: true,
      mergeStateStatus: "DIRTY",
      changedFiles: 35,
      additions: 1500,
      deletions: 750,
      headRefName: "codex/auth-migration",
    });

    assert.deepEqual(low, { score: 0, level: "low", reasons: [] });
    assert.equal(high.level, "high");
    assert.equal(high.score, 100);
    assert.deepEqual(high.reasons, [
      "draft",
      "merge_state_dirty",
      "many_files",
      "large_diff",
      "sensitive_branch_name",
    ]);
  });

  it("fetches open PRs with gh without printing token-bearing environment values", async () => {
    const calls = [];
    const result = await fetchOpenPullRequests({
      repo: "owner/repo",
      limit: 5,
      runJson: async (command, args, options) => {
        calls.push({ command, args, options });
        return { ok: true, value: [{ number: 1, isDraft: true }] };
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.prs.length, 1);
    assert.equal(calls[0].command, "gh");
    assert.deepEqual(calls[0].args.slice(0, 6), ["pr", "list", "--repo", "owner/repo", "--state", "open"]);
    assert.equal(calls[0].args.includes("number,isDraft,mergeStateStatus,url,headRefName,changedFiles,additions,deletions"), true);
    assert.equal(Object.hasOwn(calls[0].options, "env"), false);
  });

  it("returns a blocker if the scheduled live fetch fails", async () => {
    const result = await runTier2AutoMergeQueueCheck({
      runJson: async () => ({ ok: false, reason: "command_failed", output: "gh auth missing" }),
    });

    assert.equal(result.ok, false);
    assert.equal(result.result, "blocker");
    assert.equal(result.reason, "command_failed");
    assert.equal(result.execute, false);
  });
});
