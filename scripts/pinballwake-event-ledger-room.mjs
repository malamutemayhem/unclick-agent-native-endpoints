#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const LEDGER_VERSION = 1;

export const EVENT_LEDGER_AUTHORITIES = new Set([
  "observer",
  "reporter",
  "lane",
  "room",
  "master",
  "system",
]);

const AUTHORITY_RANK = {
  observer: 0,
  reporter: 10,
  lane: 40,
  room: 50,
  master: 80,
  system: 100,
};

const TRUSTED_REVIEW_AUTHORITIES = new Set(["lane"]);
const COMMAND_AUTHORITIES = new Set(["master", "system"]);

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

function compactText(value, max = 900) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
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

function hashValue(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function parseMs(value) {
  const ms = Date.parse(String(value ?? ""));
  return Number.isFinite(ms) ? ms : null;
}

function scopeKey(scope = {}) {
  const type = compactText(scope.type || scope.scope_type || "", 60);
  const id = compactText(scope.id || scope.scope_id || "", 120);
  return type && id ? `${type}:${id}` : "";
}

function normalizeScope(scope = {}) {
  return {
    type: compactText(scope.type || scope.scope_type || "", 60),
    id: compactText(scope.id || scope.scope_id || "", 120),
  };
}

function normalizeActor(actor = {}) {
  return {
    id: compactText(actor.id || actor.agent_id || actor.agentId || actor.worker || actor.name || "", 120),
    role: normalize(actor.role || actor.lane || actor.worker || ""),
    seat_id: compactText(actor.seat_id || actor.seatId || "", 120),
  };
}

function normalizeAuthority(value = "observer") {
  const authority = normalize(value || "observer");
  return EVENT_LEDGER_AUTHORITIES.has(authority) ? authority : "observer";
}

function normalizePayload(payload = {}) {
  return {
    ...payload,
    action: payload.action ? normalize(payload.action) : undefined,
    enabled: typeof payload.enabled === "boolean" ? payload.enabled : undefined,
    verdict: payload.verdict ? normalize(payload.verdict).toUpperCase() : undefined,
    reviewer: payload.reviewer ? normalize(payload.reviewer) : undefined,
    summary: payload.summary ? compactText(payload.summary, 900) : undefined,
    blocker: payload.blocker ? compactText(payload.blocker, 900) : undefined,
  };
}

function latestEvent(a, b) {
  const aMs = parseMs(a?.occurred_at) ?? 0;
  const bMs = parseMs(b?.occurred_at) ?? 0;
  if (aMs !== bMs) return aMs > bMs ? a : b;
  return String(a?.event_id || "").localeCompare(String(b?.event_id || "")) >= 0 ? a : b;
}

function eventTrust(event = {}) {
  const authority = normalizeAuthority(event.authority);
  const actor = event.actor || {};
  const payload = event.payload || {};
  const scope = event.scope || {};
  const key = scopeKey(scope);

  if (!key) {
    return { trusted: false, reason: "missing_scope", authority };
  }
  if (!actor.id && !actor.role) {
    return { trusted: false, reason: "missing_actor", authority };
  }
  if (authority === "observer" || authority === "reporter") {
    return { trusted: false, reason: "observer_or_reporter_only", authority };
  }

  if (event.kind === "review_ack") {
    const reviewer = normalize(payload.reviewer);
    if (!reviewer) {
      return { trusted: false, reason: "missing_reviewer", authority };
    }
    if (!["PASS", "BLOCKER"].includes(payload.verdict)) {
      return { trusted: false, reason: "invalid_review_verdict", authority };
    }
    if (!TRUSTED_REVIEW_AUTHORITIES.has(authority)) {
      return { trusted: false, reason: "untrusted_review_authority", authority };
    }
    if (!actor.role) {
      return { trusted: false, reason: "missing_lane_actor_role", authority };
    }
    if (actor.role !== reviewer) {
      return { trusted: false, reason: "lane_actor_reviewer_mismatch", authority };
    }
  }

  if (event.kind === "approval") {
    if (!payload.action) {
      return { trusted: false, reason: "missing_action", authority };
    }
    if (!["APPROVED", "DENIED"].includes(payload.verdict)) {
      return { trusted: false, reason: "invalid_approval_verdict", authority };
    }
    if (!COMMAND_AUTHORITIES.has(authority)) {
      return { trusted: false, reason: "untrusted_command_authority", authority };
    }
  }

  if (event.kind === "kill_switch") {
    if (typeof payload.enabled !== "boolean") {
      return { trusted: false, reason: "missing_kill_switch_state", authority };
    }
    if (!COMMAND_AUTHORITIES.has(authority)) {
      return { trusted: false, reason: "untrusted_kill_switch_authority", authority };
    }
  }

  return { trusted: true, reason: "trusted", authority };
}

export function createEventLedger(input = {}) {
  return {
    version: LEDGER_VERSION,
    created_at: input.createdAt || input.created_at || new Date().toISOString(),
    updated_at: input.updatedAt || input.updated_at || new Date().toISOString(),
    events: safeList(input.events).map((event, index) => createLedgerEvent(event, {
      previousHash: safeList(input.events)[index - 1]?.hash || null,
      sequence: index + 1,
    })),
  };
}

export function loadEventLedger(input = {}) {
  if (!input || typeof input !== "object") return createEventLedger();
  return {
    version: input.version || LEDGER_VERSION,
    created_at: input.createdAt || input.created_at || new Date().toISOString(),
    updated_at: input.updatedAt || input.updated_at || input.createdAt || input.created_at || new Date().toISOString(),
    events: safeList(input.events),
  };
}

export function createLedgerEvent(input = {}, { previousHash = null, sequence = 1 } = {}) {
  const occurredAt = input.occurred_at || input.occurredAt || new Date().toISOString();
  const event = {
    version: LEDGER_VERSION,
    sequence,
    kind: normalize(input.kind || "status"),
    scope: normalizeScope(input.scope || {}),
    actor: normalizeActor(input.actor || {}),
    authority: normalizeAuthority(input.authority),
    occurred_at: occurredAt,
    source: compactText(input.source || "", 160),
    source_url: compactText(input.source_url || input.sourceUrl || "", 500),
    payload: normalizePayload(input.payload || {}),
    previous_hash: previousHash || null,
  };
  const trust = eventTrust(event);
  const hash = hashValue({ ...event, trust });
  return {
    ...event,
    event_id: input.event_id || `event:${hash.slice(0, 20)}`,
    hash,
    trust,
  };
}

export function appendEventLedgerEvent({ ledger, event, now = new Date().toISOString() } = {}) {
  const safeLedger = ledger?.version ? ledger : createEventLedger({ events: safeList(ledger?.events) });
  const previous = safeList(safeLedger.events).at(-1);
  const next = createLedgerEvent(event, {
    previousHash: previous?.hash || null,
    sequence: safeList(safeLedger.events).length + 1,
  });

  return {
    ...safeLedger,
    updated_at: now,
    events: [...safeList(safeLedger.events), next],
  };
}

export function validateEventLedger(ledger = {}) {
  const events = safeList(ledger.events);
  const broken = [];
  for (const [index, event] of events.entries()) {
    const expectedPrevious = index === 0 ? null : events[index - 1].hash;
    if ((event.previous_hash || null) !== expectedPrevious) {
      broken.push({ event_id: event.event_id, reason: "previous_hash_mismatch" });
    }
    const rebuilt = createLedgerEvent(event, {
      previousHash: event.previous_hash || null,
      sequence: event.sequence,
    });
    if (rebuilt.hash !== event.hash) {
      broken.push({ event_id: event.event_id, reason: "event_hash_mismatch" });
    }
    if (stableJson(rebuilt.trust) !== stableJson(event.trust || null)) {
      broken.push({ event_id: event.event_id, reason: "event_trust_mismatch" });
    }
  }

  return {
    ok: broken.length === 0,
    action: "event_ledger_room",
    result: broken.length === 0 ? "valid" : "invalid",
    broken,
    event_count: events.length,
  };
}

function reviewKey(event = {}) {
  return `${scopeKey(event.scope)}:review:${normalize(event.payload?.reviewer)}`;
}

function verifiedTrust(event = {}) {
  const rebuilt = createLedgerEvent(event, {
    previousHash: event.previous_hash || null,
    sequence: event.sequence,
  });
  const hashMatches = rebuilt.hash === event.hash;
  const trustMatches = stableJson(rebuilt.trust) === stableJson(event.trust || null);
  return {
    ...rebuilt.trust,
    trusted: hashMatches && trustMatches && rebuilt.trust.trusted,
    hash_matches: hashMatches,
    trust_matches: trustMatches,
  };
}

function latestTrustedReviewAcks(events = []) {
  const latest = {};
  for (const event of safeList(events)) {
    if (event.kind !== "review_ack") continue;
    if (!verifiedTrust(event).trusted) continue;
    const key = reviewKey(event);
    latest[key] = latest[key] ? latestEvent(latest[key], event) : event;
  }
  return latest;
}

export function summarizeEventLedgerScope({
  ledger,
  scope,
  requiredReviewers = ["gatekeeper", "popcorn", "forge"],
} = {}) {
  const wanted = scopeKey(normalizeScope(scope || {}));
  const events = safeList(ledger?.events).filter((event) => scopeKey(event.scope) === wanted);
  const reviewAcks = latestTrustedReviewAcks(events);
  const latest_by_reviewer = {};

  for (const event of Object.values(reviewAcks)) {
    latest_by_reviewer[event.payload.reviewer] = event;
  }

  const blockers = Object.values(latest_by_reviewer).filter((event) => event.payload.verdict === "BLOCKER");
  const missing_reviewers = safeList(requiredReviewers)
    .map(normalize)
    .filter((reviewer) => latest_by_reviewer[reviewer]?.payload?.verdict !== "PASS");
  const trustedEvents = events.filter((event) => verifiedTrust(event).trusted);
  const observer_events = events.filter((event) => !verifiedTrust(event).trusted);

  return {
    ok: blockers.length === 0,
    action: "event_ledger_room",
    result: blockers.length
      ? "blocked"
      : missing_reviewers.length
        ? "missing_ack"
        : "full_pass",
    scope: normalizeScope(scope || {}),
    event_count: events.length,
    trusted_event_count: trustedEvents.length,
    observer_event_count: observer_events.length,
    latest_by_reviewer,
    blockers,
    missing_reviewers,
    full_ack_set: blockers.length === 0 && missing_reviewers.length === 0,
  };
}

function latestTrustedEvent(events = [], predicate = () => true) {
  return safeList(events)
    .filter((event) => verifiedTrust(event).trusted)
    .filter(predicate)
    .reduce((latest, event) => (latest ? latestEvent(latest, event) : event), null);
}

export function summarizeCommandControlScope({
  ledger,
  scope,
  action = "execute",
  requireApproval = true,
} = {}) {
  const wanted = scopeKey(normalizeScope(scope || {}));
  const normalizedAction = normalize(action || "execute");
  const events = safeList(ledger?.events).filter((event) => scopeKey(event.scope) === wanted);
  const latestKillSwitch = latestTrustedEvent(events, (event) => event.kind === "kill_switch");
  const latestApproval = latestTrustedEvent(
    events,
    (event) => event.kind === "approval" && event.payload?.action === normalizedAction,
  );

  if (latestKillSwitch?.payload?.enabled === true) {
    return {
      ok: false,
      action: "event_ledger_room",
      result: "blocked",
      reason: "kill_switch_enabled",
      scope: normalizeScope(scope || {}),
      requested_action: normalizedAction,
      latest_kill_switch: latestKillSwitch,
      latest_approval: latestApproval,
    };
  }

  if (latestApproval?.payload?.verdict === "DENIED") {
    return {
      ok: false,
      action: "event_ledger_room",
      result: "blocked",
      reason: "approval_denied",
      scope: normalizeScope(scope || {}),
      requested_action: normalizedAction,
      latest_kill_switch: latestKillSwitch,
      latest_approval: latestApproval,
    };
  }

  if (requireApproval && latestApproval?.payload?.verdict !== "APPROVED") {
    return {
      ok: false,
      action: "event_ledger_room",
      result: "blocked",
      reason: "missing_command_approval",
      scope: normalizeScope(scope || {}),
      requested_action: normalizedAction,
      latest_kill_switch: latestKillSwitch,
      latest_approval: latestApproval,
    };
  }

  return {
    ok: true,
    action: "event_ledger_room",
    result: "ready",
    reason: "command_control_clear",
    scope: normalizeScope(scope || {}),
    requested_action: normalizedAction,
    latest_kill_switch: latestKillSwitch,
    latest_approval: latestApproval,
  };
}

export function createTrustedReviewAckEvent({
  prNumber,
  reviewer,
  actorId,
  verdict,
  summary = "",
  blocker = "",
  occurredAt,
  source = "lane_ack",
  sourceUrl = "",
} = {}) {
  return createLedgerEvent({
    kind: "review_ack",
    scope: { type: "pr", id: prNumber },
    actor: { id: actorId || reviewer, role: reviewer },
    authority: "lane",
    occurred_at: occurredAt || new Date().toISOString(),
    source,
    source_url: sourceUrl,
    payload: {
      reviewer,
      verdict,
      summary,
      blocker,
    },
  });
}

export async function readEventLedger(filePath) {
  if (!filePath) return createEventLedger();
  try {
    return loadEventLedger(JSON.parse(await readFile(filePath, "utf8")));
  } catch (error) {
    if (error?.code === "ENOENT") return createEventLedger();
    throw error;
  }
}

export async function writeEventLedger(filePath, ledger) {
  if (!filePath) return { ok: false, reason: "missing_ledger_path" };
  await mkdir(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
  return { ok: true, path: filePath };
}

export async function readEventLedgerRoomInput(filePath) {
  if (!filePath) return { ok: false, reason: "missing_input_path" };
  return JSON.parse(await readFile(filePath, "utf8"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  readEventLedgerRoomInput(getArg("input", process.env.PINBALLWAKE_EVENT_LEDGER_INPUT || ""))
    .then((input) => {
      const ledger = input.ledger ? loadEventLedger(input.ledger) : createEventLedger();
      const withEvents = safeList(input.append).reduce(
        (current, event) => appendEventLedgerEvent({ ledger: current, event, now: input.now }),
        ledger,
      );
      const validation = validateEventLedger(withEvents);
      const summary = input.scope
        ? summarizeEventLedgerScope({
          ledger: withEvents,
          scope: input.scope,
          requiredReviewers: input.requiredReviewers,
        })
        : null;
      const command_control = input.commandControl
        ? summarizeCommandControlScope({
          ledger: withEvents,
          scope: input.commandControl.scope || input.scope,
          action: input.commandControl.action,
          requireApproval: input.commandControl.requireApproval,
        })
        : null;
      return { ok: validation.ok, action: "event_ledger_room", result: validation.result, ledger: withEvents, validation, summary, command_control };
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
