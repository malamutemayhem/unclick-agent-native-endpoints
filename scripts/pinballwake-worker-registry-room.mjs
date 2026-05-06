#!/usr/bin/env node

import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";

const WORKER_REGISTRY_VERSION = 1;
const ACK_VERSION = 1;
const DEFAULT_ACK_TTL_MS = 60 * 60 * 1000;

const VALID_LANES = new Set([
  "master",
  "forge",
  "gatekeeper",
  "popcorn",
  "courier",
  "relay",
  "navigator",
  "xpass",
  "bailey",
  "plex-builder",
  "loop",
]);

const VALID_ACK_VERDICTS = new Set(["PASS", "BLOCKER", "HOLD", "COMMENT"]);
const TRUSTED_SIGNING_AUTHORITIES = new Set(["lane", "master", "system"]);

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function safeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalize(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function compactText(value, max = 500) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function parseMs(value) {
  const ms = Date.parse(String(value ?? ""));
  return Number.isFinite(ms) ? ms : null;
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hmac(value, secret) {
  return createHmac("sha256", String(secret)).update(stableJson(value)).digest("hex");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a ?? ""), "hex");
  const right = Buffer.from(String(b ?? ""), "hex");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeWorker(input = {}) {
  const lane = normalize(input.lane || input.role || input.worker);
  const workerId = compactText(input.worker_id || input.workerId || input.id || lane, 120);
  return {
    worker_id: workerId,
    lane,
    seat_id: compactText(input.seat_id || input.seatId || "", 120),
    provider: compactText(input.provider || "", 80),
    machine: compactText(input.machine || "", 80),
    status: normalize(input.status || "available"),
    capabilities: uniq(safeList(input.capabilities || input.skills).map(normalize)),
    signing_key_id: compactText(input.signing_key_id || input.signingKeyId || workerId, 160),
    signing_secret: compactText(input.signing_secret || input.signingSecret || "", 500),
    revoked_at: input.revoked_at || input.revokedAt || null,
    last_seen_at: input.last_seen_at || input.lastSeenAt || null,
  };
}

export function createWorkerRegistry(input = {}) {
  return {
    version: WORKER_REGISTRY_VERSION,
    created_at: input.createdAt || input.created_at || new Date().toISOString(),
    updated_at: input.updatedAt || input.updated_at || new Date().toISOString(),
    workers: safeList(input.workers).map(normalizeWorker),
  };
}

export function findRegistryWorker(registry = {}, { workerId = "", lane = "" } = {}) {
  const wantedId = compactText(workerId, 120);
  const wantedLane = normalize(lane);
  return safeList(registry.workers).find((worker) =>
    (wantedId && worker.worker_id === wantedId) ||
    (wantedLane && worker.lane === wantedLane)
  ) || null;
}

function ackSigningPayload(input = {}) {
  return {
    version: ACK_VERSION,
    ack_id: compactText(input.ack_id || input.ackId || "", 160),
    lane: normalize(input.lane),
    worker_id: compactText(input.worker_id || input.workerId || "", 120),
    seat_id: compactText(input.seat_id || input.seatId || "", 120),
    run_id: compactText(input.run_id || input.runId || "", 160),
    pr_number: input.pr_number ?? input.prNumber ?? null,
    head_sha: compactText(input.head_sha || input.headSha || "", 80),
    scope: compactText(input.scope || "", 300),
    verdict: String(input.verdict || "").trim().toUpperCase(),
    evidence_url: compactText(input.evidence_url || input.evidenceUrl || "", 500),
    issued_at: input.issued_at || input.issuedAt || new Date().toISOString(),
  };
}

function ackMissingFields(payload = {}) {
  const missing = [];
  for (const field of ["ack_id", "lane", "worker_id", "run_id", "pr_number", "head_sha", "scope", "verdict", "issued_at"]) {
    if (payload[field] === null || payload[field] === undefined || payload[field] === "") {
      missing.push(field);
    }
  }
  return missing;
}

function createAckId(payload = {}) {
  return `ack:${hmac({
    lane: payload.lane,
    worker_id: payload.worker_id,
    run_id: payload.run_id,
    pr_number: payload.pr_number,
    head_sha: payload.head_sha,
    scope: payload.scope,
    verdict: payload.verdict,
    issued_at: payload.issued_at,
  }, "ack-id").slice(0, 20)}`;
}

export function createSignedAckRecord({
  registry,
  workerId,
  lane,
  seatId = "",
  runId,
  prNumber,
  headSha,
  scope,
  verdict,
  evidenceUrl = "",
  issuedAt = new Date().toISOString(),
} = {}) {
  const worker = findRegistryWorker(registry, { workerId, lane });
  if (!worker) {
    return { ok: false, reason: "unknown_worker" };
  }
  if (worker.revoked_at) {
    return { ok: false, reason: "worker_revoked" };
  }
  if (!worker.signing_secret) {
    return { ok: false, reason: "missing_signing_secret" };
  }

  const unsigned = ackSigningPayload({
    lane: worker.lane,
    worker_id: worker.worker_id,
    seat_id: seatId || worker.seat_id,
    run_id: runId,
    pr_number: prNumber,
    head_sha: headSha,
    scope,
    verdict,
    evidence_url: evidenceUrl,
    issued_at: issuedAt,
  });
  const payload = {
    ...unsigned,
    ack_id: createAckId(unsigned),
  };
  const signature = hmac(payload, worker.signing_secret);

  return {
    ok: true,
    ack: {
      ...payload,
      signing_key_id: worker.signing_key_id,
      signature,
    },
  };
}

export function verifySignedAckRecord({
  registry,
  ack,
  expectedLane = "",
  expectedPrNumber = null,
  expectedHeadSha = "",
  expectedRunId = "",
  expectedScope = "",
  now = new Date().toISOString(),
  ttlMs = DEFAULT_ACK_TTL_MS,
} = {}) {
  const payload = ackSigningPayload(ack || {});
  const missing = ackMissingFields(payload);
  if (missing.length) {
    return { ok: false, trusted: false, reason: "missing_ack_fields", missing };
  }
  if (!VALID_LANES.has(payload.lane)) {
    return { ok: false, trusted: false, reason: "invalid_lane" };
  }
  if (!VALID_ACK_VERDICTS.has(payload.verdict)) {
    return { ok: false, trusted: false, reason: "invalid_verdict" };
  }
  if (expectedLane && payload.lane !== normalize(expectedLane)) {
    return { ok: false, trusted: false, reason: "lane_mismatch" };
  }
  if (expectedPrNumber !== null && Number(payload.pr_number) !== Number(expectedPrNumber)) {
    return { ok: false, trusted: false, reason: "pr_mismatch" };
  }
  if (expectedHeadSha && payload.head_sha !== compactText(expectedHeadSha, 80)) {
    return { ok: false, trusted: false, reason: "head_sha_mismatch" };
  }
  if (expectedRunId && payload.run_id !== compactText(expectedRunId, 160)) {
    return { ok: false, trusted: false, reason: "run_id_mismatch" };
  }
  if (expectedScope && payload.scope !== compactText(expectedScope, 300)) {
    return { ok: false, trusted: false, reason: "scope_mismatch" };
  }

  const issuedMs = parseMs(payload.issued_at);
  const nowMs = parseMs(now);
  if (issuedMs === null || nowMs === null) {
    return { ok: false, trusted: false, reason: "invalid_timestamp" };
  }
  if (issuedMs > nowMs + 60_000) {
    return { ok: false, trusted: false, reason: "future_ack" };
  }
  if (ttlMs > 0 && nowMs - issuedMs > ttlMs) {
    return { ok: false, trusted: false, reason: "stale_ack" };
  }

  const worker = findRegistryWorker(registry, { workerId: payload.worker_id });
  if (!worker) {
    return { ok: false, trusted: false, reason: "unknown_worker" };
  }
  if (worker.revoked_at) {
    return { ok: false, trusted: false, reason: "worker_revoked" };
  }
  if (worker.lane !== payload.lane) {
    return { ok: false, trusted: false, reason: "worker_lane_mismatch" };
  }
  if (!worker.signing_secret) {
    return { ok: false, trusted: false, reason: "missing_signing_secret" };
  }
  if (ack?.signing_key_id && ack.signing_key_id !== worker.signing_key_id) {
    return { ok: false, trusted: false, reason: "signing_key_mismatch" };
  }

  const expectedSignature = hmac(payload, worker.signing_secret);
  if (!safeEqual(ack?.signature, expectedSignature)) {
    return { ok: false, trusted: false, reason: "invalid_signature" };
  }

  return {
    ok: true,
    trusted: true,
    reason: "trusted_signed_ack",
    ack: payload,
    worker: {
      worker_id: worker.worker_id,
      lane: worker.lane,
      seat_id: worker.seat_id,
      signing_key_id: worker.signing_key_id,
    },
  };
}

export function createAckDecisionEvent({ ack, verification, authority = "lane" } = {}) {
  const payload = ackSigningPayload(ack || {});
  const normalizedAuthority = normalize(authority || "lane");
  const trustedAuthority = TRUSTED_SIGNING_AUTHORITIES.has(normalizedAuthority)
    ? normalizedAuthority
    : "observer";

  return {
    kind: "review_ack",
    scope: { type: "pr", id: payload.pr_number, ack_scope: payload.scope },
    actor: {
      id: payload.worker_id,
      role: payload.lane,
      seat_id: payload.seat_id,
    },
    authority: verification?.trusted ? trustedAuthority : "observer",
    occurred_at: payload.issued_at,
    source: "worker_registry_signed_ack",
    source_url: payload.evidence_url,
    payload: {
      reviewer: payload.lane,
      verdict: payload.verdict,
      summary: verification?.trusted
        ? `Signed ${payload.lane} ${payload.verdict} for PR #${payload.pr_number}.`
        : `Untrusted ${payload.lane} ACK ignored: ${verification?.reason || "unverified"}.`,
      ack_id: payload.ack_id,
      run_id: payload.run_id,
      head_sha: payload.head_sha,
      scope: payload.scope,
      trusted: Boolean(verification?.trusted),
      reason: verification?.reason || "unverified",
    },
  };
}

export function evaluateWorkerRegistryRoom({
  registry,
  ack,
  expected = {},
  now = new Date().toISOString(),
} = {}) {
  const safeRegistry = registry?.version ? registry : createWorkerRegistry(registry || {});
  const verification = ack
    ? verifySignedAckRecord({
      registry: safeRegistry,
      ack,
      expectedLane: expected.lane,
      expectedPrNumber: expected.prNumber ?? expected.pr_number ?? null,
      expectedHeadSha: expected.headSha || expected.head_sha || "",
      expectedRunId: expected.runId || expected.run_id || "",
      expectedScope: expected.scope || expected.expectedScope || expected.expected_scope || "",
      now,
      ttlMs: expected.ttlMs ?? expected.ttl_ms ?? DEFAULT_ACK_TTL_MS,
    })
    : null;

  return {
    ok: !verification || verification.ok,
    action: "worker_registry_room",
    result: verification ? verification.reason : "registry_ready",
    worker_count: safeList(safeRegistry.workers).length,
    active_worker_count: safeList(safeRegistry.workers).filter((worker) => !worker.revoked_at).length,
    verification,
    event: verification && ack ? createAckDecisionEvent({ ack, verification }) : null,
  };
}

export async function readWorkerRegistryRoomInput(filePath) {
  if (!filePath) return { ok: false, reason: "missing_input_path" };
  return JSON.parse(await readFile(filePath, "utf8"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  readWorkerRegistryRoomInput(getArg("input", process.env.PINBALLWAKE_WORKER_REGISTRY_INPUT || ""))
    .then((input) => {
      const registry = createWorkerRegistry(input.registry || {});
      if (input.signAck) {
        return createSignedAckRecord({ registry, ...input.signAck });
      }
      return evaluateWorkerRegistryRoom({
        registry,
        ack: input.ack,
        expected: input.expected,
        now: input.now,
      });
    })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
