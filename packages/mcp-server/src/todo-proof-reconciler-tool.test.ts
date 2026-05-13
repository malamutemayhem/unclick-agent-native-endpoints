import { describe, expect, it } from "vitest";

import {
  buildTodoReconcileReport,
  classifyTodoForReconciliation,
} from "./todo-proof-reconciler-tool.js";

describe("Todo proof reconciler", () => {
  it("marks a linked merged PR with green checks as a close candidate", () => {
    const result = classifyTodoForReconciliation({
      id: "todo-true-close",
      title: "Small shipped fix",
      status: "open",
      pipeline_progress: 100,
      pipeline_source: "receipt: ship",
      pipeline_evidence: ["build", "ship"],
      comments: ["Ship receipt: PR merged and TestPass passed."],
      linked_pull_requests: [{
        url: "https://github.com/malamutemayhem/unclick-agent-native-endpoints/pull/759",
        state: "MERGED",
        checks_conclusion: "SUCCESS",
      }],
    });

    expect(result).toMatchObject({
      decision: "close_candidate",
      should_close: true,
      should_comment: true,
      missing: [],
    });
    expect(result.proof_refs).toContain("https://github.com/malamutemayhem/unclick-agent-native-endpoints/pull/759");
  });

  it("does not close a ScopePack or execution packet false positive", () => {
    const result = classifyTodoForReconciliation({
      id: "todo-scopepack",
      title: "ScopePack auto-hydration",
      status: "open",
      pipeline_progress: 100,
      pipeline_source: "receipt: ship",
      pipeline_evidence: ["ship"],
      comments: ["Worker execution packet and ScopePack only, no PR proof yet."],
    });

    expect(result).toMatchObject({
      decision: "needs_proof",
      should_close: false,
      missing: ["authoritative completion proof"],
    });
  });

  it("does not close a Git sync comment without completion proof", () => {
    const result = classifyTodoForReconciliation({
      id: "todo-git-sync",
      title: "Boardroom-to-Git sync",
      status: "open",
      pipeline_progress: 100,
      pipeline_source: "receipt: ship",
      pipeline_evidence: ["ship"],
      comments: ["Git sync proof: created GitHub issue #748 for tracking."],
    });

    expect(result).toMatchObject({
      decision: "needs_proof",
      should_close: false,
      missing: ["authoritative completion proof"],
    });
  });

  it("holds a proofed todo when an active blocker still references it", () => {
    const result = classifyTodoForReconciliation({
      id: "cf8025d7-1c64-4fee-95c1-6a7c5b666704",
      title: "WakePass ACK verifier proof",
      status: "open",
      pipeline_progress: 100,
      pipeline_source: "receipt: ship",
      pipeline_evidence: ["build", "proof", "ship"],
      proof_refs: ["https://github.com/malamutemayhem/unclick-agent-native-endpoints/issues/751"],
      comments: ["Ship receipt with PR proof exists."],
    }, {
      active_blockers: [
        "wakepass stale https://github.com/malamutemayhem/unclick-agent-native-endpoints/issues/751",
      ],
    });

    expect(result).toMatchObject({
      decision: "hold",
      should_close: false,
      should_comment: true,
    });
    expect(result.blockers).toHaveLength(1);
  });

  it("keeps already-done todos idempotent and quiet", () => {
    const result = classifyTodoForReconciliation({
      id: "todo-already-done",
      title: "Already done",
      status: "done",
      completed_at: "2026-05-13T00:00:00.000Z",
      pipeline_progress: 100,
      pipeline_source: "receipt: ship",
    });

    expect(result).toMatchObject({
      decision: "already_done",
      should_close: false,
      should_comment: false,
    });
  });

  it("produces closed, blocked, skipped, and needs-human-review counts", () => {
    const results = [
      classifyTodoForReconciliation({
        id: "close",
        title: "Close me",
        status: "open",
        pipeline_progress: 100,
        pipeline_source: "receipt: ship",
        comments: ["merged PR and TestPass passed"],
        linked_pull_requests: [{ url: "https://github.com/example/repo/pull/1", state: "MERGED" }],
      }),
      classifyTodoForReconciliation({
        id: "blocked",
        title: "Blocked",
        status: "open",
        pipeline_progress: 100,
        pipeline_source: "receipt: ship",
        proof_refs: ["https://github.com/example/repo/issues/2"],
        comments: ["ship receipt exists"],
      }, { active_blockers: ["https://github.com/example/repo/issues/2"] }),
      classifyTodoForReconciliation({ id: "skip", status: "done" }),
      classifyTodoForReconciliation({
        id: "review",
        status: "open",
        pipeline_progress: 100,
        pipeline_source: "receipt: ship",
        comments: ["Git sync proof only."],
      }),
    ];

    expect(buildTodoReconcileReport(results).counts).toEqual({
      closed: 1,
      blocked: 1,
      skipped: 1,
      needs_human_review: 1,
    });
  });
});
