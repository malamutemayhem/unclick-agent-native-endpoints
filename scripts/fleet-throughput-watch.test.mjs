import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildQueuePacket,
  checksAreGreen,
  classifyPullRequest,
  filterDuplicatePackets,
  latestCommentSignals,
  routeWorkerForPr,
} from "./fleet-throughput-watch.mjs";

function pr(overrides = {}) {
  return {
    number: 508,
    title: "RotatePass: keep no-probe fallback explicitly untested",
    body: "status: ready",
    draft: true,
    html_url: "https://github.com/malamutemayhem/unclick-agent-native-endpoints/pull/508",
    mergeable_state: "clean",
    head: { sha: "abcdef1234567890" },
    ...overrides,
  };
}

const greenChecks = [
  { name: "Website", status: "completed", conclusion: "success" },
  { name: "TestPass", status: "completed", conclusion: "success" },
];

const greenStatus = [{ state: "success" }];

describe("QueuePush PR classifier", () => {
  it("classifies green clean draft PRs as owner-lift packets", () => {
    const result = classifyPullRequest({
      pr: pr({ number: 506, draft: true }),
      files: [{ filename: "docs/connectors/system-credentials-health-panel.md" }],
      comments: [{ body: "Gatekeeper PASS. Scope looks low risk.", created_at: "2026-05-03T01:00:00Z" }],
      checkRuns: greenChecks,
      statuses: greenStatus,
    });

    assert.equal(result.state, "draft_green_needs_owner_lift");
  });

  it("routes overlap and anti-stomp blockers before generic draft lift", () => {
    const result = classifyPullRequest({
      pr: pr({ number: 508, draft: true }),
      files: [{ filename: "src/pages/admin/systemCredentialInventory.ts" }],
      comments: [
        {
          body: "HOLD: anti-stomp overlap with #486. Owner must decide supersede/rebase/close one lane.",
          created_at: "2026-05-03T01:00:00Z",
        },
      ],
      checkRuns: greenChecks,
      statuses: greenStatus,
    });

    assert.equal(result.state, "hold_overlap");
  });

  it("routes dirty branches to the dirty branch bucket", () => {
    const result = classifyPullRequest({
      pr: pr({
        number: 505,
        title: "Wake router fail-closed on missing non-manual event path",
        draft: true,
        mergeable_state: "dirty",
      }),
      files: [{ filename: "scripts/event-wake-router.mjs" }],
      comments: [{ body: "Checks green.", created_at: "2026-05-03T01:00:00Z" }],
      checkRuns: greenChecks,
      statuses: greenStatus,
    });

    assert.equal(result.state, "dirty_branch");
  });

  it("routes failed targeted proof to the failed proof bucket", () => {
    const result = classifyPullRequest({
      pr: pr({ number: 486, title: "RotatePass: harden metadata key redaction guard", draft: true }),
      files: [{ filename: "src/pages/admin/systemCredentialInventory.test.ts" }],
      comments: [
        {
          body: "Targeted proof failed: npx vitest run src/pages/admin/systemCredentialInventory.test.ts is failing.",
          created_at: "2026-05-03T01:00:00Z",
        },
      ],
      checkRuns: greenChecks,
      statuses: greenStatus,
    });

    assert.equal(result.state, "failed_targeted_proof");
  });

  it("routes non-draft green PRs with proof to QC", () => {
    const result = classifyPullRequest({
      pr: pr({ number: 520, draft: false, title: "docs: clarify QueuePush", mergeable_state: "clean" }),
      files: [{ filename: "docs/reliability-substrate.md" }],
      comments: [{ body: "PASS: checks and proof are clean.", created_at: "2026-05-03T01:00:00Z" }],
      checkRuns: greenChecks,
      statuses: greenStatus,
    });

    assert.equal(result.state, "ready_for_qc");
  });

  it("keeps Chris-only decisions out of worker coding lanes", () => {
    const result = classifyPullRequest({
      pr: pr({ number: 72, title: "Bump marked", draft: false }),
      files: [{ filename: "package.json" }],
      comments: [
        {
          body: "HOLD: human decision needed for Node 20 policy / semver-major policy.",
          created_at: "2026-05-03T01:00:00Z",
        },
      ],
      checkRuns: greenChecks,
      statuses: greenStatus,
    });

    assert.equal(result.state, "blocked_chris_only");
  });
});

describe("QueuePush routing and packets", () => {
  it("routes RotatePass and XPass files to XPass Assistant", () => {
    assert.equal(
      routeWorkerForPr(pr(), [{ filename: "src/pages/admin/systemCredentialInventory.ts" }], "draft_green_needs_owner_lift"),
      "🧪",
    );
  });

  it("routes reliability implementation files to Forge", () => {
    assert.equal(
      routeWorkerForPr(
        pr({ title: "Wake router fail-closed on missing non-manual event path" }),
        [{ filename: "scripts/event-wake-router.mjs" }],
        "dirty_branch",
      ),
      "🛠️",
    );
  });

  it("routes QC-ready PRs to Popcorn", () => {
    assert.equal(routeWorkerForPr(pr({ draft: false }), [], "ready_for_qc"), "🍿");
  });

  it("builds compact single-worker packet text with deterministic id", () => {
    const packet = buildQueuePacket({
      pr: pr({ number: 506 }),
      state: "draft_green_needs_owner_lift",
      reason: "Draft PR is green and clean.",
      files: [{ filename: "docs/connectors/system-credentials-health-panel.md" }],
    });

    assert.equal(packet.worker, "🧪");
    assert.equal(packet.recipient, "🧪");
    assert.match(packet.packetId, /^queuepush:pr-506:draft_green_needs_owner_lift:abcdef1:[a-f0-9]{10}$/);
    assert.match(packet.text, /worker: 🧪/);
    assert.match(packet.text, /ack: done\/blocker/);
    assert.ok(packet.text.length < 1200);
  });

  it("dedupes packets already visible in recent Fishbowl messages", () => {
    const first = buildQueuePacket({
      pr: pr({ number: 506 }),
      state: "draft_green_needs_owner_lift",
      reason: "Draft PR is green and clean.",
      files: [],
    });
    const second = buildQueuePacket({
      pr: pr({ number: 505, head: { sha: "bbbbbb1234567890" } }),
      state: "dirty_branch",
      reason: "Branch is dirty.",
      files: [{ filename: "scripts/event-wake-router.mjs" }],
    });

    const remaining = filterDuplicatePackets([first, second], [{ text: `old post ${first.packetId}` }]);
    assert.deepEqual(
      remaining.map((packet) => packet.packetId),
      [second.packetId],
    );
  });
});

describe("QueuePush signal helpers", () => {
  it("requires at least one visible green check or status", () => {
    assert.equal(checksAreGreen([], []), false);
    assert.equal(checksAreGreen([{ name: "Website", status: "completed", conclusion: "success" }], []), true);
    assert.equal(checksAreGreen([{ name: "Website", status: "queued", conclusion: null }], []), false);
    assert.equal(checksAreGreen([{ name: "Website", status: "completed", conclusion: "failure" }], []), false);
  });

  it("treats a later PASS as clearing an older generic HOLD", () => {
    const signals = latestCommentSignals([
      { body: "HOLD: waiting on proof.", created_at: "2026-05-03T01:00:00Z" },
      { body: "PASS: proof now looks clean.", created_at: "2026-05-03T02:00:00Z" },
    ]);

    assert.equal(signals.hasActiveHold, false);
    assert.equal(signals.hasProof, true);
  });

  it("treats a later PASS as clearing an older failed proof note", () => {
    const signals = latestCommentSignals([
      {
        body: "Focused proof note: targeted proof failed before dependencies were refreshed.",
        created_at: "2026-05-03T01:00:00Z",
      },
      { body: "PASS: low-risk chip with green checks and proof.", created_at: "2026-05-03T02:00:00Z" },
    ]);

    assert.equal(signals.hasFailedProof, false);
  });

  it("does not treat bot TestPass or HOLD text as clearing human blockers", () => {
    const signals = latestCommentSignals([
      {
        body: "### TestPass: PASS",
        created_at: "2026-05-03T01:00:00Z",
        user: { login: "github-actions" },
      },
      {
        body: "Gatekeeper HOLD / anti-stomp. Include exact targeted proof PASS before lift.",
        created_at: "2026-05-03T02:00:00Z",
        user: { login: "malamutemayhem" },
      },
    ]);

    assert.equal(signals.hasActiveHold, true);
    assert.equal(signals.hasOverlap, true);
  });

  it("keeps dirty branch signals active even when overlap words are also present", () => {
    const signals = latestCommentSignals([
      {
        body: "HOLD: branch is not clean against main. Avoid anti-stomp overlap and rebase/update/rebuild.",
        created_at: "2026-05-03T01:00:00Z",
        user: { login: "malamutemayhem" },
      },
    ]);

    assert.equal(signals.hasDirtyBranch, true);
    assert.equal(signals.hasOverlap, true);
  });
});
