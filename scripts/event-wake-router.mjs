#!/usr/bin/env node

import { readFileSync } from "node:fs";

const eventName = process.env.GITHUB_EVENT_NAME || "manual";
const eventPath = process.env.GITHUB_EVENT_PATH || "";
const repository = process.env.GITHUB_REPOSITORY || "malamutemayhem/unclick-agent-native-endpoints";
const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
const runId = process.env.GITHUB_RUN_ID || "";
const apiUrl = process.env.UNCLICK_API_URL || "https://unclick.world/api/memory-admin";
const unclickApiKey = process.env.FISHBOWL_WAKE_TOKEN || process.env.FISHBOWL_AUTOCLOSE_TOKEN || "";
const dryRun = process.env.WAKE_ROUTER_DRY_RUN === "1" || process.env.WAKE_ROUTER_DRY_RUN === "true";

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

function baseDecision(event) {
  const action = String(event.action || "");

  if (eventName === "workflow_run") {
    const run = event.workflow_run || {};
    const prs = Array.isArray(run.pull_requests) ? run.pull_requests : [];
    if (run.status === "completed" && run.conclusion === "success" && prs.length > 0) {
      return {
        wake: true,
        owner: "🤖",
        urgency: "high",
        reason: `PR checks completed green for ${run.name || "workflow"} on PR #${prs[0].number}`,
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
        owner: "🤖",
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
    if (body.includes("/wake") || body.includes("wake worker")) {
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

async function postWake(decision, triage) {
  const eventSeconds = secondsSince(decision.eventCreatedAt);
  const wakeSecondsLabel = eventSeconds === null ? "unknown" : `${eventSeconds}s`;
  const recipients = decision.owner === "all" ? ["all"] : [decision.owner];
  const text = [
    `Wake event: ${decision.reason}`,
    `Source: ${sourceUrl(event)}`,
    `Event-to-router: ${wakeSecondsLabel}`,
    `Route: ${decision.owner}`,
    triage.used ? `Cheap triage: ${triage.error ? `error (${triage.error})` : "used"}` : "Cheap triage: skipped",
  ].join("\n");

  const payload = {
    agent_id: "github-action-wake-router",
    recipients,
    tags: ["needs-doing", "wake"],
    text,
  };

  if (dryRun || !unclickApiKey) {
    console.log(JSON.stringify({ dry_run: true, missing_key: !unclickApiKey, payload }, null, 2));
    return { posted: false, dry_run: true };
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
  return { posted: response.ok, status: response.status };
}

const event = readEvent();
const initialDecision = baseDecision(event);
const brief = eventBrief(event, initialDecision);
const triage = await cheapTriage(brief, initialDecision);
const finalDecision = triage.decision;

console.log(JSON.stringify({ brief, finalDecision, triage }, null, 2));

if (!finalDecision.wake) {
  console.log("No wake needed.");
  process.exit(0);
}

const result = await postWake(finalDecision, triage);
if (!result.posted && !result.dry_run) process.exitCode = 1;
