import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createAckDecisionEvent,
  createSignedAckRecord,
  createWorkerRegistry,
  evaluateWorkerRegistryRoom,
  verifySignedAckRecord,
} from "./pinballwake-worker-registry-room.mjs";

const NOW = "2026-05-05T02:00:00.000Z";
const ISSUED_AT = "2026-05-05T01:55:00.000Z";

function registryFixture(overrides = {}) {
  return createWorkerRegistry({
    workers: [
      {
        worker_id: "gatekeeper-1",
        lane: "gatekeeper",
        seat_id: "lenovo-chatgpt-gatekeeper",
        provider: "chatgpt",
        machine: "lenovo",
        status: "available",
        capabilities: ["release_safety"],
        signing_key_id: "gatekeeper-key-v1",
        signing_secret: "gatekeeper-secret",
        ...overrides.gatekeeper,
      },
      {
        worker_id: "forge-1",
        lane: "forge",
        seat_id: "plex-codex-forge",
        provider: "codex",
        machine: "plex",
        status: "available",
        capabilities: ["implementation"],
        signing_key_id: "forge-key-v1",
        signing_secret: "forge-secret",
        ...overrides.forge,
      },
    ],
  });
}

function signGatekeeperAck(registry = registryFixture(), overrides = {}) {
  return createSignedAckRecord({
    registry,
    workerId: "gatekeeper-1",
    runId: "run-535",
    prNumber: 535,
    headSha: "8ea79d5",
    scope: "event-ledger-room-review",
    verdict: "PASS",
    evidenceUrl: "https://github.com/example/pr/535#gatekeeper-pass",
    issuedAt: ISSUED_AT,
    ...overrides,
  });
}

describe("PinballWake Worker Registry Room", () => {
  it("creates a registry with normalized workers and seats", () => {
    const registry = registryFixture();

    assert.equal(registry.version, 1);
    assert.equal(registry.workers.length, 2);
    assert.equal(registry.workers[0].lane, "gatekeeper");
    assert.equal(registry.workers[0].seat_id, "lenovo-chatgpt-gatekeeper");
  });

  it("creates and verifies a signed lane ACK", () => {
    const registry = registryFixture();
    const signed = signGatekeeperAck(registry);

    assert.equal(signed.ok, true);
    assert.match(signed.ack.signature, /^[a-f0-9]{64}$/);

    const verification = verifySignedAckRecord({
      registry,
      ack: signed.ack,
      expectedLane: "gatekeeper",
      expectedPrNumber: 535,
      expectedHeadSha: "8ea79d5",
      expectedRunId: "run-535",
      now: NOW,
    });

    assert.equal(verification.ok, true);
    assert.equal(verification.trusted, true);
    assert.equal(verification.reason, "trusted_signed_ack");
  });

  it("rejects mirror text because it has no valid signature", () => {
    const registry = registryFixture();
    const fakeAck = {
      ack_id: "ack:fake",
      lane: "gatekeeper",
      worker_id: "gatekeeper-1",
      run_id: "run-535",
      pr_number: 535,
      head_sha: "8ea79d5",
      scope: "event-ledger-room-review",
      verdict: "PASS",
      issued_at: ISSUED_AT,
      signature: "00".repeat(32),
    };

    const verification = verifySignedAckRecord({
      registry,
      ack: fakeAck,
      expectedLane: "gatekeeper",
      expectedPrNumber: 535,
      expectedHeadSha: "8ea79d5",
      now: NOW,
    });

    assert.equal(verification.ok, false);
    assert.equal(verification.reason, "invalid_signature");
  });

  it("rejects ACKs replayed against a different PR", () => {
    const registry = registryFixture();
    const signed = signGatekeeperAck(registry);

    const verification = verifySignedAckRecord({
      registry,
      ack: signed.ack,
      expectedLane: "gatekeeper",
      expectedPrNumber: 536,
      expectedHeadSha: "8ea79d5",
      now: NOW,
    });

    assert.equal(verification.ok, false);
    assert.equal(verification.reason, "pr_mismatch");
  });

  it("rejects ACKs replayed against a different head SHA", () => {
    const registry = registryFixture();
    const signed = signGatekeeperAck(registry);

    const verification = verifySignedAckRecord({
      registry,
      ack: signed.ack,
      expectedLane: "gatekeeper",
      expectedPrNumber: 535,
      expectedHeadSha: "different",
      now: NOW,
    });

    assert.equal(verification.ok, false);
    assert.equal(verification.reason, "head_sha_mismatch");
  });

  it("rejects stale ACKs outside the configured TTL", () => {
    const registry = registryFixture();
    const signed = signGatekeeperAck(registry, {
      issuedAt: "2026-05-05T00:00:00.000Z",
    });

    const verification = verifySignedAckRecord({
      registry,
      ack: signed.ack,
      expectedLane: "gatekeeper",
      expectedPrNumber: 535,
      expectedHeadSha: "8ea79d5",
      now: NOW,
      ttlMs: 30 * 60 * 1000,
    });

    assert.equal(verification.ok, false);
    assert.equal(verification.reason, "stale_ack");
  });

  it("rejects ACKs from revoked workers", () => {
    const registry = registryFixture();
    const signed = signGatekeeperAck(registry);
    const revokedRegistry = registryFixture({
      gatekeeper: { revoked_at: "2026-05-05T01:58:00.000Z" },
    });

    const verification = verifySignedAckRecord({
      registry: revokedRegistry,
      ack: signed.ack,
      expectedLane: "gatekeeper",
      expectedPrNumber: 535,
      expectedHeadSha: "8ea79d5",
      now: NOW,
    });

    assert.equal(verification.ok, false);
    assert.equal(verification.reason, "worker_revoked");
  });

  it("rejects ACKs where the worker belongs to a different lane", () => {
    const registry = registryFixture();
    const signed = signGatekeeperAck(registry);
    const movedRegistry = registryFixture({
      gatekeeper: { lane: "forge" },
    });

    const verification = verifySignedAckRecord({
      registry: movedRegistry,
      ack: signed.ack,
      expectedLane: "gatekeeper",
      expectedPrNumber: 535,
      expectedHeadSha: "8ea79d5",
      now: NOW,
    });

    assert.equal(verification.ok, false);
    assert.equal(verification.reason, "worker_lane_mismatch");
  });

  it("emits a trusted event only after signature verification passes", () => {
    const registry = registryFixture();
    const signed = signGatekeeperAck(registry);
    const verification = verifySignedAckRecord({
      registry,
      ack: signed.ack,
      expectedLane: "gatekeeper",
      expectedPrNumber: 535,
      expectedHeadSha: "8ea79d5",
      now: NOW,
    });

    const event = createAckDecisionEvent({ ack: signed.ack, verification });

    assert.equal(event.authority, "lane");
    assert.equal(event.actor.role, "gatekeeper");
    assert.equal(event.payload.trusted, true);
    assert.equal(event.payload.verdict, "PASS");
  });

  it("emits observer-only events for failed verification", () => {
    const registry = registryFixture();
    const signed = signGatekeeperAck(registry);
    const badAck = { ...signed.ack, signature: "00".repeat(32) };
    const verification = verifySignedAckRecord({
      registry,
      ack: badAck,
      expectedLane: "gatekeeper",
      expectedPrNumber: 535,
      expectedHeadSha: "8ea79d5",
      now: NOW,
    });

    const event = createAckDecisionEvent({ ack: badAck, verification });

    assert.equal(event.authority, "observer");
    assert.equal(event.payload.trusted, false);
    assert.equal(event.payload.reason, "invalid_signature");
  });

  it("evaluates registry ACK verification as a room result", () => {
    const registry = registryFixture();
    const signed = signGatekeeperAck(registry);

    const result = evaluateWorkerRegistryRoom({
      registry,
      ack: signed.ack,
      expected: {
        lane: "gatekeeper",
        prNumber: 535,
        headSha: "8ea79d5",
        runId: "run-535",
      },
      now: NOW,
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "trusted_signed_ack");
    assert.equal(result.worker_count, 2);
    assert.equal(result.event.authority, "lane");
  });
});
