import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createAckDecisionEvent,
  createSignedAckRecord,
  createWorkerRegistry,
  evaluateWorkerRegistryRoom,
  findSpecialistBenchWorkers,
  selectWorkerForCapability,
  verifySignedAckRecord,
} from "./pinballwake-worker-registry-room.mjs";

const NOW = "2026-05-05T02:00:00.000Z";
const ISSUED_AT = "2026-05-05T01:55:00.000Z";

function registryFixture(overrides = {}) {
  return createWorkerRegistry({
    workers: [
      {
        worker_id: "safety-checker-1",
        lane: "safety-checker",
        seat_id: "lenovo-chatgpt-safety-checker",
        provider: "chatgpt",
        machine: "lenovo",
        status: "available",
        capabilities: ["release_safety"],
        signing_key_id: "safety-checker-key-v1",
        signing_secret: "safety-checker-secret",
        ...overrides.safetyChecker,
      },
      {
        worker_id: "builder-1",
        lane: "builder",
        seat_id: "plex-codex-builder",
        provider: "codex",
        machine: "plex",
        status: "available",
        capabilities: ["implementation"],
        signing_key_id: "builder-key-v1",
        signing_secret: "builder-secret",
        ...overrides.builder,
      },
      {
        worker_id: "seo-specialist-bench-1",
        lane: "researcher",
        status: "bench",
        activation_mode: "bench",
        profile_slug: "seo-specialist",
        capabilities: ["seo", "search"],
        activation_reason: "Wake only for search and GEO jobs.",
        success_count: 4,
        promotion_threshold: 5,
        ...overrides.seoBench,
      },
    ],
  });
}

function signSafetyAck(registry = registryFixture(), overrides = {}) {
  return createSignedAckRecord({
    registry,
    workerId: "safety-checker-1",
    runId: "run-535",
    prNumber: 535,
    headSha: "8ea79d5",
    scope: "event-ledger-room-review",
    verdict: "PASS",
    evidenceUrl: "https://github.com/example/pr/535#safety-checker-pass",
    issuedAt: ISSUED_AT,
    ...overrides,
  });
}

describe("PinballWake Worker Registry Room", () => {
  it("creates a registry with normalized workers and seats", () => {
    const registry = registryFixture();

    assert.equal(registry.version, 1);
    assert.equal(registry.workers.length, 3);
    assert.equal(registry.workers[0].lane, "safety-checker");
    assert.equal(registry.workers[0].seat_id, "lenovo-chatgpt-safety-checker");
    assert.equal(registry.workers[2].activation_mode, "bench");
    assert.equal(registry.workers[2].profile_slug, "seo-specialist");
    assert.equal(registry.workers[2].promotion_signals.success_count, 4);
  });

  it("keeps bench specialists discoverable without counting them as active workers", () => {
    const registry = registryFixture();
    const bench = findSpecialistBenchWorkers(registry, { capability: "seo" });

    assert.equal(bench.length, 1);
    assert.equal(bench[0].worker_id, "seo-specialist-bench-1");

    const result = evaluateWorkerRegistryRoom({
      registry,
      expected: { capability: "seo" },
      now: NOW,
    });

    assert.equal(result.ok, true);
    assert.equal(result.worker_count, 3);
    assert.equal(result.active_worker_count, 2);
    assert.equal(result.bench_worker_count, 1);
    assert.equal(result.selection.reason, "bench_specialist_match");
    assert.equal(result.selection.fallback_reason, "no_active_worker_match");
  });

  it("prefers an active worker over a bench specialist for the same capability", () => {
    const registry = registryFixture({
      builder: { capabilities: ["implementation", "seo"] },
    });

    const selection = selectWorkerForCapability(registry, { capability: "seo" });

    assert.equal(selection.ok, true);
    assert.equal(selection.activation, "active");
    assert.equal(selection.worker.worker_id, "builder-1");
    assert.equal(selection.reason, "active_worker_match");
  });

  it("creates and verifies a signed lane ACK", () => {
    const registry = registryFixture();
    const signed = signSafetyAck(registry);

    assert.equal(signed.ok, true);
    assert.match(signed.ack.signature, /^[a-f0-9]{64}$/);

    const verification = verifySignedAckRecord({
      registry,
      ack: signed.ack,
      expectedLane: "safety-checker",
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
      lane: "safety-checker",
      worker_id: "safety-checker-1",
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
      expectedLane: "safety-checker",
      expectedPrNumber: 535,
      expectedHeadSha: "8ea79d5",
      now: NOW,
    });

    assert.equal(verification.ok, false);
    assert.equal(verification.reason, "invalid_signature");
  });

  it("rejects ACKs replayed against a different PR", () => {
    const registry = registryFixture();
    const signed = signSafetyAck(registry);

    const verification = verifySignedAckRecord({
      registry,
      ack: signed.ack,
      expectedLane: "safety-checker",
      expectedPrNumber: 536,
      expectedHeadSha: "8ea79d5",
      now: NOW,
    });

    assert.equal(verification.ok, false);
    assert.equal(verification.reason, "pr_mismatch");
  });

  it("rejects ACKs replayed against a different head SHA", () => {
    const registry = registryFixture();
    const signed = signSafetyAck(registry);

    const verification = verifySignedAckRecord({
      registry,
      ack: signed.ack,
      expectedLane: "safety-checker",
      expectedPrNumber: 535,
      expectedHeadSha: "different",
      now: NOW,
    });

    assert.equal(verification.ok, false);
    assert.equal(verification.reason, "head_sha_mismatch");
  });

  it("rejects ACKs replayed against a different review scope", () => {
    const registry = registryFixture();
    const signed = signSafetyAck(registry, {
      prNumber: 536,
      headSha: "4ec3745",
      scope: "event-ledger-room-review",
    });

    const verification = verifySignedAckRecord({
      registry,
      ack: signed.ack,
      expectedLane: "safety-checker",
      expectedPrNumber: 536,
      expectedHeadSha: "4ec3745",
      expectedScope: "worker-registry-room-review",
      now: NOW,
    });

    assert.equal(verification.ok, false);
    assert.equal(verification.reason, "scope_mismatch");

    const event = createAckDecisionEvent({ ack: signed.ack, verification });
    assert.equal(event.authority, "observer");
    assert.equal(event.scope.ack_scope, "event-ledger-room-review");
    assert.equal(event.payload.scope, "event-ledger-room-review");
  });

  it("rejects stale ACKs outside the configured TTL", () => {
    const registry = registryFixture();
    const signed = signSafetyAck(registry, {
      issuedAt: "2026-05-05T00:00:00.000Z",
    });

    const verification = verifySignedAckRecord({
      registry,
      ack: signed.ack,
      expectedLane: "safety-checker",
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
    const signed = signSafetyAck(registry);
    const revokedRegistry = registryFixture({
      safetyChecker: { revoked_at: "2026-05-05T01:58:00.000Z" },
    });

    const verification = verifySignedAckRecord({
      registry: revokedRegistry,
      ack: signed.ack,
      expectedLane: "safety-checker",
      expectedPrNumber: 535,
      expectedHeadSha: "8ea79d5",
      now: NOW,
    });

    assert.equal(verification.ok, false);
    assert.equal(verification.reason, "worker_revoked");
  });

  it("rejects ACKs where the worker belongs to a different lane", () => {
    const registry = registryFixture();
    const signed = signSafetyAck(registry);
    const movedRegistry = registryFixture({
      safetyChecker: { lane: "builder" },
    });

    const verification = verifySignedAckRecord({
      registry: movedRegistry,
      ack: signed.ack,
      expectedLane: "safety-checker",
      expectedPrNumber: 535,
      expectedHeadSha: "8ea79d5",
      now: NOW,
    });

    assert.equal(verification.ok, false);
    assert.equal(verification.reason, "worker_lane_mismatch");
  });

  it("emits a trusted event only after signature verification passes", () => {
    const registry = registryFixture();
    const signed = signSafetyAck(registry);
    const verification = verifySignedAckRecord({
      registry,
      ack: signed.ack,
      expectedLane: "safety-checker",
      expectedPrNumber: 535,
      expectedHeadSha: "8ea79d5",
      now: NOW,
    });

    const event = createAckDecisionEvent({ ack: signed.ack, verification });

    assert.equal(event.authority, "lane");
    assert.equal(event.actor.role, "safety-checker");
    assert.equal(event.payload.trusted, true);
    assert.equal(event.payload.verdict, "PASS");
  });

  it("emits observer-only events for failed verification", () => {
    const registry = registryFixture();
    const signed = signSafetyAck(registry);
    const badAck = { ...signed.ack, signature: "00".repeat(32) };
    const verification = verifySignedAckRecord({
      registry,
      ack: badAck,
      expectedLane: "safety-checker",
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
    const signed = signSafetyAck(registry);

    const result = evaluateWorkerRegistryRoom({
      registry,
      ack: signed.ack,
      expected: {
        lane: "safety-checker",
        prNumber: 535,
        headSha: "8ea79d5",
        runId: "run-535",
        scope: "event-ledger-room-review",
      },
      now: NOW,
    });

    assert.equal(result.ok, true);
    assert.equal(result.result, "trusted_signed_ack");
    assert.equal(result.worker_count, 3);
    assert.equal(result.event.authority, "lane");
  });
});
