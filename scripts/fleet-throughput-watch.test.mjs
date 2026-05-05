import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildQueuePacket,
  checksAreGreen,
  chooseQueuePushRunner,
  classifyPullRequest,
  filterDuplicatePackets,
  jobKindForState,
  latestCommentSignals,
  resolveQueuePushRunnerRoster,
  routeWorkerForPr,
  runnerCanAcceptQueuePushJob,
  stateRequiresCode,
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

  it("routes draft PRs with Safety and Builder PASS but missing QC to final QC", () => {
    const result = classifyPullRequest({
      pr: pr({ number: 535, draft: true, title: "feat(autopilot): add Event Ledger Room" }),
      files: [{ filename: "scripts/pinballwake-event-ledger-room.mjs" }],
      comments: [
        { body: "Gatekeeper PASS. CLEAN, safety PASS.", created_at: "2026-05-03T01:00:00Z" },
        { body: "Forge PASS. Implementation-shape review is clean.", created_at: "2026-05-03T01:10:00Z" },
        { body: "Status refreshed. No final review yet.", created_at: "2026-05-03T01:20:00Z" },
      ],
      checkRuns: greenChecks,
      statuses: greenStatus,
    });

    assert.equal(result.state, "missing_final_qc_ack");
  });

  it("does not route to final QC from request text alone", () => {
    const result = classifyPullRequest({
      pr: pr({ number: 535, draft: true, title: "feat(autopilot): add Event Ledger Room" }),
      files: [{ filename: "scripts/pinballwake-event-ledger-room.mjs" }],
      comments: [{ body: "Final QC ACK needed from Popcorn only.", created_at: "2026-05-03T01:20:00Z" }],
      checkRuns: greenChecks,
      statuses: greenStatus,
    });

    assert.equal(result.state, "draft_green_needs_owner_lift");
  });

  it("keeps later generic HOLDs ahead of missing final QC routing", () => {
    const result = classifyPullRequest({
      pr: pr({ number: 535, draft: true, title: "feat(autopilot): add Event Ledger Room" }),
      files: [{ filename: "scripts/pinballwake-event-ledger-room.mjs" }],
      comments: [
        { body: "Gatekeeper PASS. CLEAN, safety PASS.", created_at: "2026-05-03T01:00:00Z" },
        { body: "Forge PASS. Implementation-shape review is clean.", created_at: "2026-05-03T01:10:00Z" },
        { body: "Final QC ACK needed from Popcorn only.", created_at: "2026-05-03T01:20:00Z" },
        { body: "HOLD: proof mismatch remains.", created_at: "2026-05-03T01:30:00Z" },
      ],
      checkRuns: greenChecks,
      statuses: greenStatus,
    });

    assert.equal(result.state, "blocked_chris_only");
  });

  it("treats HOLDs that only wait on Popcorn as missing final QC routing", () => {
    const result = classifyPullRequest({
      pr: pr({ number: 536, draft: true, title: "feat(autopilot): add Worker Registry Room" }),
      files: [{ filename: "scripts/pinballwake-worker-registry-room.mjs" }],
      comments: [
        { body: "Gatekeeper PASS. CLEAN, safety PASS.", created_at: "2026-05-03T01:00:00Z" },
        { body: "Forge PASS. Implementation-shape review is clean.", created_at: "2026-05-03T01:10:00Z" },
        {
          body:
            "Forge HOLD on QueuePush owner-decision packet. Exact HOLD: missing 🍿 Popcorn QC PASS on latest head. No code changes and no merge/lift by Forge.",
          created_at: "2026-05-03T01:30:00Z",
        },
      ],
      checkRuns: greenChecks,
      statuses: greenStatus,
    });

    assert.equal(result.state, "missing_final_qc_ack");
  });

  it("keeps missing Popcorn plus another unresolved concern as an active blocker", () => {
    const result = classifyPullRequest({
      pr: pr({ number: 536, draft: true, title: "feat(autopilot): add Worker Registry Room" }),
      files: [{ filename: "scripts/pinballwake-worker-registry-room.mjs" }],
      comments: [
        { body: "Gatekeeper PASS. CLEAN, safety PASS.", created_at: "2026-05-03T01:00:00Z" },
        { body: "Forge PASS. Implementation-shape review is clean.", created_at: "2026-05-03T01:10:00Z" },
        {
          body: "HOLD: missing Popcorn QC PASS and unresolved schema concern remains.",
          created_at: "2026-05-03T01:30:00Z",
        },
      ],
      checkRuns: greenChecks,
      statuses: greenStatus,
    });

    assert.equal(result.state, "blocked_chris_only");
  });

  it("keeps exact HOLD missing Popcorn plus another unresolved concern as an active blocker", () => {
    const result = classifyPullRequest({
      pr: pr({ number: 536, draft: true, title: "feat(autopilot): add Worker Registry Room" }),
      files: [{ filename: "scripts/pinballwake-worker-registry-room.mjs" }],
      comments: [
        { body: "Gatekeeper PASS. CLEAN, safety PASS.", created_at: "2026-05-03T01:00:00Z" },
        { body: "Forge PASS. Implementation-shape review is clean.", created_at: "2026-05-03T01:10:00Z" },
        {
          body: "Exact HOLD: missing Popcorn QC PASS and unresolved schema concern remains.",
          created_at: "2026-05-03T01:30:00Z",
        },
      ],
      checkRuns: greenChecks,
      statuses: greenStatus,
    });

    assert.equal(result.state, "blocked_chris_only");
  });

  it("keeps overlap blockers ahead of missing final QC routing", () => {
    const result = classifyPullRequest({
      pr: pr({ number: 537, draft: true, title: "docs(autopilot): add context boot packet" }),
      files: [{ filename: "AUTOPILOT.md" }],
      comments: [
        { body: "Gatekeeper PASS. CLEAN, safety PASS.", created_at: "2026-05-03T01:00:00Z" },
        { body: "Forge PASS. Implementation-shape review is clean.", created_at: "2026-05-03T01:10:00Z" },
        { body: "Final QC ACK needed from Popcorn only.", created_at: "2026-05-03T01:20:00Z" },
        { body: "HOLD: overlap with #535 on AUTOPILOT.md.", created_at: "2026-05-03T01:30:00Z" },
      ],
      checkRuns: greenChecks,
      statuses: greenStatus,
    });

    assert.equal(result.state, "hold_overlap");
  });

  it("returns draft owner lift after the final QC PASS is visible", () => {
    const result = classifyPullRequest({
      pr: pr({ number: 536, draft: true, title: "feat(autopilot): add Worker Registry Room" }),
      files: [{ filename: "scripts/pinballwake-worker-registry-room.mjs" }],
      comments: [
        { body: "Gatekeeper PASS. CLEAN, safety PASS.", created_at: "2026-05-03T01:00:00Z" },
        { body: "Forge PASS. Implementation-shape review is clean.", created_at: "2026-05-03T01:10:00Z" },
        { body: "PASS\n🍿", created_at: "2026-05-03T01:20:00Z" },
      ],
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
  it("routes RotatePass and XPass owner decisions to XPass Assistant", () => {
    assert.equal(
      routeWorkerForPr(pr(), [{ filename: "src/pages/admin/systemCredentialInventory.ts" }], "draft_green_needs_owner_lift"),
      "🧪",
    );
  });

  it("routes code-required RotatePass repair work to a proven builder", () => {
    assert.equal(
      routeWorkerForPr(
        pr({ title: "RotatePass: harden metadata key redaction guard" }),
        [{ filename: "src/pages/admin/systemCredentialInventory.test.ts" }],
        "failed_targeted_proof",
      ),
      "🛠️",
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

  it("keeps PinballWake owner decisions with Forge even when the PR mentions other lanes", () => {
    assert.equal(
      routeWorkerForPr(
        pr({ title: "PinballWake job runner registry", body: "Also mentions XPass context." }),
        [{ filename: "src/pages/admin/pinballwakeJobRunners.ts" }],
        "draft_green_needs_owner_lift",
      ),
      "🛠️",
    );
  });

  it("routes QC-ready PRs to Popcorn", () => {
    assert.equal(routeWorkerForPr(pr({ draft: false }), [], "ready_for_qc"), "🍿");
  });

  it("routes missing final QC ACKs to Popcorn", () => {
    assert.equal(routeWorkerForPr(pr({ draft: true }), [], "missing_final_qc_ack"), "🍿");
  });

  it("does not treat probe-only runners as unattended code hands", () => {
    const runner = {
      emoji: "🦾",
      readiness: "needs_probe",
      capabilities: ["implementation", "status_relay"],
      safeFor: ["small implementation"],
    };

    assert.equal(
      runnerCanAcceptQueuePushJob(runner, {
        kind: "implementation",
        lane: "small implementation",
        title: "Probe code hand",
        requiresCode: true,
      }),
      false,
    );
    assert.equal(
      runnerCanAcceptQueuePushJob(runner, {
        kind: "status_relay",
        lane: "small implementation",
        title: "Probe status",
        requiresCode: false,
      }),
      true,
    );
  });

  it("lets a configured proven runner take matching code jobs", () => {
    const custom = [
      {
        emoji: "🦾",
        readiness: "builder_ready",
        capabilities: ["implementation"],
        safeFor: ["rotatepass"],
      },
      {
        emoji: "🛠️",
        readiness: "builder_ready",
        capabilities: ["implementation"],
        safeFor: ["pinballwake"],
      },
    ];

    const runner = chooseQueuePushRunner(
      {
        kind: "implementation",
        lane: "rotatepass redaction targeted proof",
        title: "Fix RotatePass proof",
        requiresCode: true,
      },
      custom,
    );

    assert.equal(runner?.emoji, "🦾");
  });

  it("falls back to the safe default runner roster when custom roster is empty or malformed", () => {
    const empty = resolveQueuePushRunnerRoster("[]");
    const malformed = resolveQueuePushRunnerRoster("{ nope");

    assert.equal(empty[0]?.emoji, "🛠️");
    assert.equal(malformed[0]?.emoji, "🛠️");
    assert.ok(empty.some((runner) => runner.emoji === "🍿"));
  });

  it("maps process states to job kinds and code requirements", () => {
    assert.equal(jobKindForState("draft_green_needs_owner_lift"), "owner_decision");
    assert.equal(jobKindForState("missing_final_qc_ack"), "qc_review");
    assert.equal(jobKindForState("ready_for_qc"), "qc_review");
    assert.equal(jobKindForState("failed_targeted_proof"), "implementation");
    assert.equal(stateRequiresCode("failed_targeted_proof"), true);
    assert.equal(stateRequiresCode("missing_final_qc_ack"), false);
    assert.equal(stateRequiresCode("draft_green_needs_owner_lift"), false);
  });

  it("builds compact final QC packets with deterministic id", () => {
    const packet = buildQueuePacket({
      pr: pr({ number: 535, title: "feat(autopilot): add Event Ledger Room" }),
      state: "missing_final_qc_ack",
      reason: "Safety and builder PASS are visible; final QC ACK is missing.",
      files: [{ filename: "scripts/pinballwake-event-ledger-room.mjs" }],
    });

    assert.equal(packet.worker, "🍿");
    assert.equal(packet.jobKind, "qc_review");
    assert.equal(packet.requiresCode, false);
    assert.match(packet.packetId, /^queuepush:v3:pr-535:missing_final_qc_ack:abcdef1:[a-f0-9]{10}$/);
    assert.match(packet.text, /DIRECT QC PACKET/);
    assert.match(packet.text, /worker: 🍿/);
    assert.match(packet.text, /QC latest head only/);
  });

  it("builds compact decision packet text with deterministic id", () => {
    const packet = buildQueuePacket({
      pr: pr({ number: 506 }),
      state: "draft_green_needs_owner_lift",
      reason: "Draft PR is green and clean.",
      files: [{ filename: "docs/connectors/system-credentials-health-panel.md" }],
    });

    assert.equal(packet.worker, "🧪");
    assert.equal(packet.recipient, "🧪");
    assert.equal(packet.jobKind, "owner_decision");
    assert.equal(packet.requiresCode, false);
    assert.match(packet.packetId, /^queuepush:v3:pr-506:draft_green_needs_owner_lift:abcdef1:[a-f0-9]{10}$/);
    assert.match(packet.text, /DIRECT DECISION PACKET/);
    assert.match(packet.text, /Decide, ACK, or reply blocker/);
    assert.match(packet.text, /worker: 🧪/);
    assert.match(packet.text, /job kind: owner_decision/);
    assert.match(packet.text, /requires code: no/);
    assert.match(packet.text, /do: Claim it/);
    assert.match(packet.text, /fallback: if not ACKed after two pulses/);
    assert.match(packet.text, /ack: done\/blocker/);
    assert.ok(packet.text.length < 1200);
  });

  it("builds code-required implementation packets for proven builders", () => {
    const packet = buildQueuePacket({
      pr: pr({ number: 486, title: "RotatePass: harden metadata key redaction guard" }),
      state: "failed_targeted_proof",
      reason: "Targeted proof failed.",
      files: [{ filename: "src/pages/admin/systemCredentialInventory.test.ts" }],
    });

    assert.equal(packet.worker, "🛠️");
    assert.equal(packet.jobKind, "implementation");
    assert.equal(packet.requiresCode, true);
    assert.match(packet.text, /DIRECT BUILD PACKET/);
    assert.match(packet.text, /Build it or reply blocker/);
    assert.match(packet.text, /requires code: yes/);
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
