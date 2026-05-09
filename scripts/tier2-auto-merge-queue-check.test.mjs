import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateTier2AutoMergeQueue,
  fetchOpenPullRequests,
  runTier2AutoMergeQueueCheck,
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
    assert.equal(result.execute, false);
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
        },
      ],
      now: "2026-05-09T08:45:00.000Z",
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "queue_not_empty");
    assert.equal(result.reason, "scheduled_noop_check_only");
    assert.equal(result.open_pr_count, 1);
    assert.equal(result.safe_to_merge_count, 0);
    assert.equal(result.execute, false);
    assert.deepEqual(result.summaries[0], {
      number: 604,
      isDraft: false,
      mergeStateStatus: "CLEAN",
      url: "https://github.com/malamutemayhem/unclick-agent-native-endpoints/pull/604",
      headRefName: "codex/example",
    });
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
    assert.equal(calls[0].args.includes("number,isDraft,mergeStateStatus,url,headRefName"), true);
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
