#!/usr/bin/env node

import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const eventName = process.env.GITHUB_EVENT_NAME || "manual";
const eventPath = process.env.GITHUB_EVENT_PATH || "";
const repository = process.env.GITHUB_REPOSITORY || "malamutemayhem/unclick-agent-native-endpoints";
const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
const runId = process.env.GITHUB_RUN_ID || "";
const apiUrl = process.env.UNCLICK_API_URL || "https://unclick.world/api/memory-admin";
const unclickApiKey = process.env.FISHBOWL_WAKE_TOKEN || process.env.FISHBOWL_AUTOCLOSE_TOKEN || "";
function parseBooleanFlag(value) {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true";
}

const dryRun = parseBooleanFlag(process.env.WAKE_ROUTER_DRY_RUN);
const ackFailSeconds = parseBoundedSeconds(process.env.WAKE_ACK_FAIL_SECONDS, 600, 60, 600);
const receivedAt = new Date().toISOString();
const ledgerDir = process.env.WAKE_LEDGER_DIR || ".wake-ledger";
const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY || "";

function parseBoundedSeconds(value, fallback, min, max) {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(min, Math.min(parsed, max));
}

export function deriveAckThresholds(failAfterSeconds) {
  const fail = Number.isFinite(failAfterSeconds) ? Math.max(3, Math.floor(failAfterSeconds)) : 600;
  const expectedBase = fail >= 60 ? Math.max(15, Math.floor(fail * 0.2)) : Math.max(1, Math.floor(fail * 0.2));
  const expected = Math.min(120, Math.min(fail - 2, expectedBase));
  const warningBase = fail >= 60 ? Math.floor(fail * 0.5) : Math.max(expected + 1, Math.floor(fail * 0.5));
  const warning = Math.min(300, Math.max(expected + 1, Math.min(fail - 1, warningBase)));
  return {
    expected_within_seconds: expected,
    warning_after_seconds: warning,
    fail_after_seconds: fail,
  };
}

function readEvent() {
  if (!eventPath) return {};
  try {
    return JSON.parse(readFileSync(eventPath, "utf8"));
  } catch (err) {
    return { read_error: err instanceof Error ? err.message : String(err) };
  }
}

function parseDate(value) {
  if (!value || typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function secondsSince(value) {
  const ms = parseDate(value);
  if (ms === null) return null;
  return Math.max(0, Math.round((Date.now() - ms) / 1000));
}

function compactText(value, max = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function sourceUrl(event) {
  if (event.pull_request?.html_url) return event.pull_request.html_url;
  if (event.issue?.html_url) return event.issue.html_url;
  if (event.workflow_run?.html_url) return event.workflow_run.html_url;
  if (runId) return `${serverUrl}/${repository}/actions/runs/${runId}`;
  return `${serverUrl}/${repository}`;
}

function eventSubject(event) {
  if (event.comment?.id) return `comment-${event.comment.id}`;
  if (event.pull_request?.number) return `pr-${event.pull_request.number}`;
  if (event.issue?.number) return `issue-${event.issue.number}`;
  if (event.workflow_run?.id) return `workflow-run-${event.workflow_run.id}`;
  return runId ? `run-${runId}` : "unknown";
}

function wakeEventId(event, decision) {
  const action = String(event.action || "");
  const basis = [
    repository,
    eventName,
    action,
    eventSubject(event),
    decision.eventCreatedAt || "",
    sourceUrl(event),
  ].join("|");
  const digest = createHash("sha256").update(basis).digest("hex").slice(0, 12);
  return `wake-${eventName}-${eventSubject(event)}-${digest}`.replace(/[^a-zA-Z0-9_.-]/g, "-");
}

export function wakeDispatchId(eventId) {
  const digest = createHash("sha256").update(eventId).digest("hex").slice(0, 32);
  return `dispatch_${digest}`;
}

export function normalizeDispatchOwner(owner) {
  const normalized = String(owner ?? "")
    .trim()
    .toLowerCase();
  return normalized === "all" ? "🤖" : owner;
}

function baseDecision(event) {
  const action = String(event.action || "");

  if (eventName === "workflow_run") {
    const run = event.workflow_run || {};
    const prs = Array.isArray(run.pull_requests) ? run.pull_requests : [];
    if (
      run.status === "completed" &&
      run.name === "TestPass Scheduled Smoke" &&
      run.conclusion &&
      run.conclusion !== "success"
    ) {
      return {
        wake: true,
        owner: "🤖",
        urgency: "urgent",
        reason: `Scheduled TestPass smoke ${run.conclusion}`,
        eventCreatedAt: run.updated_at || run.created_at,
        needsTriage: false,
      };
    }

    if (
      run.status === "completed" &&
      run.name === "Dogfood Report" &&
      run.conclusion &&
      run.conclusion !== "success"
    ) {
      return {
        wake: true,
        owner: "🦾",
        urgency: "urgent",
        reason: `Dogfood Report workflow ${run.conclusion}`,
        eventCreatedAt: run.updated_at || run.created_at,
        needsTriage: false,
      };
    }

    if (run.status === "completed" && run.conclusion === "success" && prs.length > 0) {
      return {
        wake: false,
        owner: "none",
        urgency: "low",
        reason: `PR checks completed green for ${run.name || "workflow"} on PR #${prs[0].number}; no action needed`,
        eventCreatedAt: run.updated_at || run.created_at,
        needsTriage: false,
      };
    }
  }

  if (eventName === "pull_request") {
    const pr = event.pull_request || {};
    if (["ready_for_review", "review_requested", "reopened"].includes(action)) {
      return {
        wake: true,
        owner: "🍿",
        urgency: "high",
        reason: `PR #${pr.number || event.number} is ${action.replaceAll("_", " ")}`,
        eventCreatedAt: pr.updated_at || pr.created_at,
        needsTriage: false,
      };
    }
  }

  if (eventName === "issues" && ["assigned", "labeled"].includes(action)) {
    const issue = event.issue || {};
    return {
      wake: true,
      owner: "🤖",
      urgency: "normal",
      reason: `Issue #${issue.number} was ${action}`,
      eventCreatedAt: issue.updated_at || issue.created_at,
      needsTriage: false,
    };
  }

  if (eventName === "issue_comment") {
    const comment = event.comment || {};
    const body = String(comment.body || "").toLowerCase();
    if (body.includes("/wake") || body.includes("wake worker") || body.trim().startsWith("wake:")) {
      return {
        wake: true,
        owner: "🤖",
        urgency: "high",
        reason: `Manual wake command on issue/PR #${event.issue?.number}`,
        eventCreatedAt: comment.created_at,
        needsTriage: false,
      };
    }
  }

  return {
    wake: false,
    owner: "none",
    urgency: "low",
    reason: `No wake rule matched for ${eventName}${action ? `/${action}` : ""}`,
    eventCreatedAt: new Date().toISOString(),
    needsTriage: false,
  };
}

function eventBrief(event, decision) {
  return {
    event_name: eventName,
    action: event.action || null,
    repository,
    source_url: sourceUrl(event),
    base_decision: decision,
    pull_request: event.pull_request
      ? {
          number: event.pull_request.number,
          title: compactText(event.pull_request.title, 160),
          draft: event.pull_request.draft,
          state: event.pull_request.state,
        }
      : null,
    issue: event.issue
      ? {
          number: event.issue.number,
          title: compactText(event.issue.title, 160),
          state: event.issue.state,
        }
      : null,
    workflow_run: event.workflow_run
      ? {
          name: event.workflow_run.name,
          status: event.workflow_run.status,
          conclusion: event.workflow_run.conclusion,
          pull_requests: (event.workflow_run.pull_requests || []).map((pr) => pr.number),
        }
      : null,
  };
}

async function cheapTriage(brief, decision) {
  const apiKey = process.env.OPENROUTER_API_KEY || "";
  const model = process.env.OPENROUTER_WAKE_MODEL || "";
  if (!apiKey || !model || !decision.wake) return { used: false, decision };
  if (decision.needsTriage === false) return { used: false, decision };

  const prompt = [
    "Return only compact JSON.",
    "Decide whether this event should wake a worker.",
    "Allowed owners: 🤖, 🍿, 🦾, 🐺, all.",
    "Use wake=false for noise.",
    JSON.stringify(brief),
  ].join("\n");

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://unclick.world",
        "X-Title": "UnClick wake router",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              'You are a cheap event triage router. Return JSON like {"wake":true,"owner":"🤖","urgency":"high","reason":"short reason"}.',
          },
          { role: "user", content: prompt },
        ],
        temperature: 0,
        max_tokens: 120,
      }),
    });
    if (!response.ok) {
      return { used: true, error: `OpenRouter HTTP ${response.status}`, decision };
    }
    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(content);
    return {
      used: true,
      model,
      usage: json?.usage ?? null,
      decision: {
        wake: Boolean(parsed.wake),
        owner: ["🤖", "🍿", "🦾", "🐺", "all"].includes(parsed.owner) ? parsed.owner : decision.owner,
        urgency: ["low", "normal", "high", "urgent"].includes(parsed.urgency) ? parsed.urgency : decision.urgency,
        reason: compactText(parsed.reason || decision.reason, 240),
        eventCreatedAt: decision.eventCreatedAt,
      },
    };
  } catch (err) {
    return {
      used: true,
      error: err instanceof Error ? err.message : String(err),
      decision,
    };
  }
}

async function postWake(decision, triage, eventId, event) {
  const eventSeconds = secondsSince(decision.eventCreatedAt);
  const wakeSecondsLabel = eventSeconds === null ? "unknown" : `${eventSeconds}s`;
  const recipients = decision.owner === "all" ? ["all"] : [decision.owner];
  const text = [
    `Wake event id: ${eventId}`,
    `Wake event: ${decision.reason}`,
    `Source: ${sourceUrl(event)}`,
    `Event-to-router: ${wakeSecondsLabel}`,
    `Route: ${decision.owner}`,
    triage.used ? `Cheap triage: ${triage.error ? `error (${triage.error})` : "used"}` : "Cheap triage: skipped",
    `ACK requested: reply ACK ${eventId} and your next action.`,
  ].join("\n");

  const payload = {
    agent_id: "github-action-wake-router",
    recipients,
    tags: ["needs-doing", "wake"],
    text,
  };

  if (dryRun) {
    console.log(JSON.stringify({ dry_run: true, missing_key: !unclickApiKey, payload }, null, 2));
    return { posted: false, dry_run: true, payload };
  }
  if (!unclickApiKey) {
    console.error("FISHBOWL_WAKE_TOKEN or FISHBOWL_AUTOCLOSE_TOKEN is required for wake posting.");
    return { posted: false, dry_run: false, missing_key: true, payload };
  }

  const response = await fetch(`${apiUrl}?action=fishbowl_post`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${unclickApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  console.log(`Fishbowl wake post HTTP ${response.status}`);
  console.log(body);
  let messageId = null;
  try {
    messageId = JSON.parse(body)?.message?.id || null;
  } catch {
    messageId = null;
  }
  return { posted: response.ok, status: response.status, message_id: messageId };
}

export function buildReliabilityDispatchRequest({
  eventId,
  decision,
  triage,
  result,
  event,
  ackSeconds = 600,
}) {
  return {
    dispatch_id: wakeDispatchId(eventId),
    source: "wakepass",
    target_agent_id: normalizeDispatchOwner(decision.owner),
    task_ref: eventId,
    time_bucket_seconds: ackSeconds,
    payload: {
      ack_required: true,
      handoff_message_id: result?.message_id ?? null,
      route_attempted: "fishbowl",
      wake_event_id: eventId,
      wake_reason: decision.reason,
      wake_urgency: decision.urgency,
      wake_owner: decision.owner,
      source_url: sourceUrl(event),
      github_event_name: eventName,
      github_event_action: event.action || null,
      github_subject: eventSubject(event),
      cheap_triage_used: Boolean(triage.used),
      ack_fail_after_seconds: ackSeconds,
    },
  };
}

export function buildReliabilityDispatchHandoffSyncRequest({
  eventId,
  decision,
  triage,
  result,
  event,
  ackSeconds = 600,
}) {
  if (!result?.message_id) return null;
  return buildReliabilityDispatchRequest({
    eventId,
    decision,
    triage,
    result,
    event,
    ackSeconds,
  });
}

export function shouldFailMissingHandoffMessageId(result) {
  return Boolean(result?.posted) && !result?.message_id && !result?.dry_run;
}

async function registerWakeDispatch({ eventId, decision, triage, result, event }) {
  const dispatchRequest = buildReliabilityDispatchRequest({
    eventId,
    decision,
    triage,
    result,
    event,
    ackSeconds: ackFailSeconds,
  });

  const claimRequest = {
    dispatch_id: dispatchRequest.dispatch_id,
    agent_id: normalizeDispatchOwner(decision.owner),
    lease_seconds: ackFailSeconds,
  };

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          reliability_dispatch_dry_run: true,
          missing_key: !unclickApiKey,
          upsert: dispatchRequest,
          claim: claimRequest,
        },
        null,
        2,
      ),
    );
    return {
      registered: false,
      dry_run: true,
      dispatch_id: dispatchRequest.dispatch_id,
      upsert: dispatchRequest,
      claim: claimRequest,
    };
  }
  if (!unclickApiKey) {
    console.error("FISHBOWL_WAKE_TOKEN or FISHBOWL_AUTOCLOSE_TOKEN is required for reliability dispatch.");
    return {
      registered: false,
      dry_run: false,
      dispatch_id: dispatchRequest.dispatch_id,
      error: "missing_wake_token",
    };
  }

  const upsertResponse = await fetch(`${apiUrl}?action=reliability_dispatches&method=upsert`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${unclickApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dispatchRequest),
  });
  const upsertBody = await upsertResponse.text();
  console.log(`Reliability dispatch upsert HTTP ${upsertResponse.status}`);
  console.log(upsertBody);
  if (!upsertResponse.ok) {
    return {
      registered: false,
      status: upsertResponse.status,
      dispatch_id: dispatchRequest.dispatch_id,
      error: compactText(upsertBody, 500),
    };
  }

  const claimResponse = await fetch(`${apiUrl}?action=reliability_dispatches&method=claim`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${unclickApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(claimRequest),
  });
  const claimBody = await claimResponse.text();
  console.log(`Reliability dispatch claim HTTP ${claimResponse.status}`);
  console.log(claimBody);

  return {
    registered: claimResponse.ok,
    status: claimResponse.status,
    dispatch_id: dispatchRequest.dispatch_id,
    error: claimResponse.ok ? null : compactText(claimBody, 500),
  };
}

async function syncWakeDispatchHandoffMessage({ eventId, decision, triage, result, event }) {
  const upsert = buildReliabilityDispatchHandoffSyncRequest({
    eventId,
    decision,
    triage,
    result,
    event,
    ackSeconds: ackFailSeconds,
  });

  if (!upsert) {
    return { attempted: false, synced: false, skipped: true, reason: "missing_message_id" };
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          reliability_dispatch_handoff_sync_dry_run: true,
          missing_key: !unclickApiKey,
          upsert,
        },
        null,
        2,
      ),
    );
    return { attempted: true, synced: true, dry_run: true };
  }

  if (!unclickApiKey) {
    return { attempted: true, synced: false, error: "missing_wake_token" };
  }

  const response = await fetch(`${apiUrl}?action=reliability_dispatches&method=upsert`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${unclickApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(upsert),
  });
  const body = await response.text();
  console.log(`Reliability dispatch handoff sync HTTP ${response.status}`);
  console.log(body);
  return {
    attempted: true,
    synced: response.ok,
    status: response.status,
    error: response.ok ? null : compactText(body, 500),
  };
}

function writeLedger({ eventId, event, decision, triage, result, reliability, handoffSync, status }) {
  const eventSeconds = secondsSince(decision.eventCreatedAt);
  const ackThresholds = deriveAckThresholds(ackFailSeconds);
  const ledger = {
    event_id: eventId,
    status,
    repository,
    event_name: eventName,
    action: event.action || null,
    subject: eventSubject(event),
    source_url: sourceUrl(event),
    event_at: decision.eventCreatedAt || null,
    router_received_at: receivedAt,
    router_finished_at: new Date().toISOString(),
    event_to_router_seconds: eventSeconds,
    target_worker: decision.owner,
    urgency: decision.urgency,
    reason: decision.reason,
    cheap_triage: {
      used: Boolean(triage.used),
      model: triage.model || null,
      error: triage.error || null,
      usage: triage.usage || null,
    },
    fishbowl: {
      posted: Boolean(result?.posted),
      dry_run: Boolean(result?.dry_run),
      status: result?.status || null,
      message_id: result?.message_id || null,
    },
    reliability_dispatch: {
      registered: Boolean(reliability?.registered),
      dry_run: Boolean(reliability?.dry_run),
      status: reliability?.status || null,
      dispatch_id: reliability?.dispatch_id || null,
      error: reliability?.error || null,
      handoff_sync: {
        attempted: Boolean(handoffSync?.attempted),
        synced: Boolean(handoffSync?.synced),
        dry_run: Boolean(handoffSync?.dry_run),
        skipped: Boolean(handoffSync?.skipped),
        status: handoffSync?.status || null,
        reason: handoffSync?.reason || null,
        error: handoffSync?.error || null,
      },
    },
    ack: {
      requested: status === "wake_posted" || status === "wake_dry_run",
      expected_within_seconds: ackThresholds.expected_within_seconds,
      warning_after_seconds: ackThresholds.warning_after_seconds,
      fail_after_seconds: ackThresholds.fail_after_seconds,
      observed_at: null,
    },
  };

  mkdirSync(ledgerDir, { recursive: true });
  const ledgerPath = join(ledgerDir, `${eventId}.json`);
  writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  console.log(`Wake ledger written: ${ledgerPath}`);

  const summary = [
    "## Wake Router Ledger",
    "",
    `- Event ID: \`${eventId}\``,
    `- Status: \`${status}\``,
    `- Route: \`${decision.owner}\``,
    `- Source: ${sourceUrl(event)}`,
    `- Event-to-router: ${eventSeconds === null ? "unknown" : `${eventSeconds}s`}`,
    `- Fishbowl posted: ${result?.posted ? "yes" : result?.dry_run ? "dry run" : "no"}`,
    `- Reliability dispatch: ${reliability?.registered ? reliability.dispatch_id : reliability?.dry_run ? "dry run" : "not registered"}`,
    `- Cheap triage: ${triage.used ? triage.error ? `error (${triage.error})` : "used" : "skipped"}`,
    "",
  ].join("\n");

  if (stepSummaryPath) appendFileSync(stepSummaryPath, summary);
  return ledger;
}

async function main() {
  const event = readEvent();
  if (event.read_error) {
    const fallbackDecision = {
      wake: false,
      owner: "none",
      urgency: "low",
      reason: `Failed to read GitHub event payload: ${compactText(event.read_error, 200)}`,
      eventCreatedAt: new Date().toISOString(),
      needsTriage: false,
    };
    const eventId = wakeEventId(event, fallbackDecision);
    console.error(fallbackDecision.reason);
    writeLedger({
      eventId,
      event,
      decision: fallbackDecision,
      triage: { used: false, error: fallbackDecision.reason, decision: fallbackDecision },
      result: null,
      reliability: null,
      handoffSync: null,
      status: "wake_failed",
    });
    process.exitCode = 1;
    return;
  }
  const initialDecision = baseDecision(event);
  const brief = eventBrief(event, initialDecision);
  const triage = await cheapTriage(brief, initialDecision);
  const finalDecision = triage.decision;
  const eventId = wakeEventId(event, finalDecision);

  console.log(JSON.stringify({ eventId, brief, finalDecision, triage }, null, 2));

  if (!finalDecision.wake) {
    console.log("No wake needed.");
    writeLedger({
      eventId,
      event,
      decision: finalDecision,
      triage,
      result: null,
      reliability: null,
      handoffSync: null,
      status: "no_wake",
    });
    return;
  }

  const reliability = await registerWakeDispatch({
    eventId,
    decision: finalDecision,
    triage,
    result: null,
    event,
  });
  if (!reliability?.registered && !reliability?.dry_run) {
    console.error("Reliability dispatch registration failed, skipping Fishbowl wake post.");
    writeLedger({
      eventId,
      event,
      decision: finalDecision,
      triage,
      result: null,
      reliability,
      handoffSync: null,
      status: "wake_failed",
    });
    process.exitCode = 1;
    return;
  }
  const result = await postWake(finalDecision, triage, eventId, event);
  if (shouldFailMissingHandoffMessageId(result)) {
    const reliabilityWithError = {
      ...(reliability || {}),
      error: compactText("Fishbowl wake post succeeded but returned no message_id for ACK handoff sync.", 500),
    };
    console.error("Fishbowl wake post succeeded but returned no message_id. Failing closed.");
    writeLedger({
      eventId,
      event,
      decision: finalDecision,
      triage,
      result,
      reliability: reliabilityWithError,
      handoffSync: null,
      status: "wake_failed",
    });
    process.exitCode = 1;
    return;
  }
  const handoffSync = await syncWakeDispatchHandoffMessage({
    eventId,
    decision: finalDecision,
    triage,
    result,
    event,
  });
  const status = result.posted ? "wake_posted" : result.dry_run ? "wake_dry_run" : "wake_failed";
  writeLedger({ eventId, event, decision: finalDecision, triage, result, reliability, handoffSync, status });
  if (
    (!result.posted && !result.dry_run) ||
    (!reliability?.registered && !reliability?.dry_run) ||
    (handoffSync.attempted && !handoffSync.synced)
  ) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
