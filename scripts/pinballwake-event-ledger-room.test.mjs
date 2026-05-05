import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  appendEventLedgerEvent,
  createEventLedger,
  createTrustedReviewAckEvent,
  readEventLedger,
  summarizeCommandControlScope,
  summarizeEventLedgerScope,
  validateEventLedger,
  writeEventLedger,
} from "./pinballwake-event-ledger-room.mjs";

function append(ledger, event) {
  return appendEventLedgerEvent({
    ledger,
    event,
    now: "2026-05-05T01:00:00.000Z",
  });
}

function reviewAck({ reviewer, verdict = "PASS", at = "2026-05-05T01:00:00.000Z", actorId, actorRole, authority = "lane" }) {
  return {
    kind: "review_ack",
    scope: { type: "pr", id: 532 },
    actor: { id: actorId || reviewer, role: actorRole || reviewer },
    authority,
    occurred_at: at,
    source: "fishbowl",
    payload: {
      reviewer,
      verdict,
      summary: `${reviewer} ${verdict}`,
    },
  };
}

function commandApproval({
  action = "merge",
  verdict = "APPROVED",
  authority = "master",
  actorRole = "master",
  at = "2026-05-05T01:00:00.000Z",
} = {}) {
  return {
    kind: "approval",
    scope: { type: "pr", id: 532 },
    actor: { id: actorRole, role: actorRole },
    authority,
    occurred_at: at,
    source: "master_decision",
    payload: {
      action,
      verdict,
      summary: `${action} ${verdict}`,
    },
  };
}

function killSwitch({ enabled = true, authority = "master", at = "2026-05-05T01:00:00.000Z" } = {}) {
  return {
    kind: "kill_switch",
    scope: { type: "pr", id: 532 },
    actor: { id: "master", role: "master" },
    authority,
    occurred_at: at,
    source: "master_control",
    payload: {
      enabled,
      summary: enabled ? "Stop this PR." : "Resume this PR.",
    },
  };
}

describe("PinballWake Event Ledger Room", () => {
  it("creates an append-only hash chain and validates it", () => {
    let ledger = createEventLedger();
    ledger = append(ledger, reviewAck({ reviewer: "gatekeeper" }));
    ledger = append(ledger, reviewAck({ reviewer: "popcorn" }));

    assert.equal(ledger.events.length, 2);
    assert.equal(ledger.events[1].previous_hash, ledger.events[0].hash);
    assert.deepEqual(validateEventLedger(ledger), {
      ok: true,
      action: "event_ledger_room",
      result: "valid",
      broken: [],
      event_count: 2,
    });
  });

  it("summarizes direct lane-authored review ACKs into full pass", () => {
    let ledger = createEventLedger();
    ledger = append(ledger, reviewAck({ reviewer: "gatekeeper" }));
    ledger = append(ledger, reviewAck({ reviewer: "popcorn" }));
    ledger = append(ledger, reviewAck({ reviewer: "forge" }));

    const summary = summarizeEventLedgerScope({
      ledger,
      scope: { type: "pr", id: 532 },
    });

    assert.equal(summary.result, "full_pass");
    assert.equal(summary.full_ack_set, true);
    assert.equal(summary.latest_by_reviewer.forge.payload.verdict, "PASS");
  });

  it("does not let observer/status events become trusted ACKs", () => {
    let ledger = createEventLedger();
    ledger = append(ledger, {
      kind: "review_ack",
      scope: { type: "pr", id: 532 },
      actor: { id: "courier", role: "courier" },
      authority: "observer",
      occurred_at: "2026-05-05T01:10:00.000Z",
      source: "status_mirror",
      payload: {
        reviewer: "forge",
        verdict: "PASS",
        summary: "Status mirror says Forge PASS is visible.",
      },
    });

    const summary = summarizeEventLedgerScope({
      ledger,
      scope: { type: "pr", id: 532 },
    });

    assert.equal(summary.result, "missing_ack");
    assert.deepEqual(summary.missing_reviewers, ["gatekeeper", "popcorn", "forge"]);
    assert.equal(summary.observer_event_count, 1);
  });

  it("does not let a newer observer mirror clear an older lane blocker", () => {
    let ledger = createEventLedger();
    ledger = append(ledger, reviewAck({
      reviewer: "gatekeeper",
      verdict: "PASS",
      at: "2026-05-05T01:00:00.000Z",
    }));
    ledger = append(ledger, reviewAck({
      reviewer: "popcorn",
      verdict: "PASS",
      at: "2026-05-05T01:00:00.000Z",
    }));
    ledger = append(ledger, reviewAck({
      reviewer: "forge",
      verdict: "BLOCKER",
      at: "2026-05-05T01:01:00.000Z",
    }));
    ledger = append(ledger, {
      kind: "review_ack",
      scope: { type: "pr", id: 532 },
      actor: { id: "courier", role: "courier" },
      authority: "observer",
      occurred_at: "2026-05-05T01:10:00.000Z",
      source: "status_mirror",
      payload: {
        reviewer: "forge",
        verdict: "PASS",
        summary: "Mirror summary says #532 Forge PASS.",
      },
    });

    const summary = summarizeEventLedgerScope({ ledger, scope: { type: "pr", id: 532 } });

    assert.equal(summary.result, "blocked");
    assert.equal(summary.blockers[0].payload.reviewer, "forge");
  });

  it("does not trust lane ACK when actor role mismatches reviewer", () => {
    let ledger = createEventLedger();
    ledger = append(ledger, reviewAck({
      reviewer: "popcorn",
      actorId: "forge",
      actorRole: "forge",
      authority: "lane",
    }));

    const event = ledger.events[0];
    const summary = summarizeEventLedgerScope({
      ledger,
      scope: { type: "pr", id: 532 },
      requiredReviewers: ["popcorn"],
    });

    assert.equal(event.trust.trusted, false);
    assert.equal(event.trust.reason, "lane_actor_reviewer_mismatch");
    assert.equal(summary.result, "missing_ack");
  });

  it("lets a newer lane PASS clear an older lane blocker for the same reviewer", () => {
    let ledger = createEventLedger();
    ledger = append(ledger, reviewAck({
      reviewer: "forge",
      verdict: "BLOCKER",
      at: "2026-05-05T01:00:00.000Z",
    }));
    ledger = append(ledger, reviewAck({
      reviewer: "forge",
      verdict: "PASS",
      at: "2026-05-05T01:15:00.000Z",
    }));

    const summary = summarizeEventLedgerScope({
      ledger,
      scope: { type: "pr", id: 532 },
      requiredReviewers: ["forge"],
    });

    assert.equal(summary.result, "full_pass");
    assert.equal(summary.latest_by_reviewer.forge.payload.verdict, "PASS");
  });

  it("creates helper trusted review ACK events", () => {
    const event = createTrustedReviewAckEvent({
      prNumber: 532,
      reviewer: "gatekeeper",
      verdict: "PASS",
      occurredAt: "2026-05-05T01:00:00.000Z",
    });

    assert.equal(event.trust.trusted, true);
    assert.equal(event.scope.type, "pr");
    assert.equal(event.payload.reviewer, "gatekeeper");
  });

  it("detects tampered event ledger entries", () => {
    let ledger = createEventLedger();
    ledger = append(ledger, reviewAck({ reviewer: "gatekeeper" }));
    ledger.events[0].payload.verdict = "BLOCKER";

    const validation = validateEventLedger(ledger);

    assert.equal(validation.ok, false);
    assert.equal(validation.broken[0].reason, "event_hash_mismatch");
  });

  it("round-trips ledger files atomically", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pinballwake-event-ledger-"));
    const filePath = join(dir, "ledger.json");
    try {
      let ledger = createEventLedger();
      ledger = append(ledger, reviewAck({ reviewer: "gatekeeper" }));
      const written = await writeEventLedger(filePath, ledger);
      const read = await readEventLedger(filePath);

      assert.equal(written.ok, true);
      assert.equal(read.events.length, 1);
      assert.equal(read.events[0].event_id, ledger.events[0].event_id);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("blocks command-control actions without master approval", () => {
    const ledger = createEventLedger();

    const summary = summarizeCommandControlScope({
      ledger,
      scope: { type: "pr", id: 532 },
      action: "merge",
    });

    assert.equal(summary.ok, false);
    assert.equal(summary.reason, "missing_command_approval");
  });

  it("allows command-control actions with trusted master approval", () => {
    let ledger = createEventLedger();
    ledger = append(ledger, commandApproval({ action: "merge" }));

    const summary = summarizeCommandControlScope({
      ledger,
      scope: { type: "pr", id: 532 },
      action: "merge",
    });

    assert.equal(summary.ok, true);
    assert.equal(summary.result, "ready");
    assert.equal(summary.latest_approval.payload.verdict, "APPROVED");
  });

  it("does not trust lane approval for command-control actions", () => {
    let ledger = createEventLedger();
    ledger = append(ledger, commandApproval({ action: "merge", authority: "lane", actorRole: "forge" }));

    const event = ledger.events[0];
    const summary = summarizeCommandControlScope({
      ledger,
      scope: { type: "pr", id: 532 },
      action: "merge",
    });

    assert.equal(event.trust.trusted, false);
    assert.equal(event.trust.reason, "untrusted_command_authority");
    assert.equal(summary.reason, "missing_command_approval");
  });

  it("blocks command-control actions when trusted kill switch is enabled", () => {
    let ledger = createEventLedger();
    ledger = append(ledger, commandApproval({ action: "merge" }));
    ledger = append(ledger, killSwitch({ enabled: true, at: "2026-05-05T01:05:00.000Z" }));

    const summary = summarizeCommandControlScope({
      ledger,
      scope: { type: "pr", id: 532 },
      action: "merge",
    });

    assert.equal(summary.ok, false);
    assert.equal(summary.reason, "kill_switch_enabled");
  });
});
