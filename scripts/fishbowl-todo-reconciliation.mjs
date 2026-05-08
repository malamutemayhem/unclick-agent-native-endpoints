#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const UUID_RE_SOURCE =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

const TODO_REFERENCE_RE = new RegExp(
  `\\bCloses[ -]+(?:UnClick|Fishbowl)[ -]+todo\\s*:\\s*(${UUID_RE_SOURCE})\\b`,
  "gi",
);

const NO_TODO_RE = /^no-todo:\s*(\S.*)$/gim;

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function textParts(...parts) {
  return parts.flatMap((part) => {
    if (Array.isArray(part)) return textParts(...part);
    if (part == null) return [];
    return [String(part)];
  });
}

function parseTime(value) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function daysBetween(nowMs, thenMs) {
  return (nowMs - thenMs) / 86_400_000;
}

function prText(pr = {}) {
  return textParts(
    pr.body,
    pr.title,
    pr.commit_messages,
    pr.commitMessages,
    pr.commits?.map((commit) => [
      commit.message,
      commit.messageHeadline,
      commit.messageBody,
      commit.commit?.message,
    ]),
  ).join("\n");
}

export function extractTodoReferenceIds(...parts) {
  const text = textParts(...parts).join("\n");
  const ids = new Set();
  for (const match of text.matchAll(TODO_REFERENCE_RE)) {
    ids.add(match[1].toLowerCase());
  }
  return [...ids];
}

export function findNoTodoReason(...parts) {
  const text = textParts(...parts).join("\n");
  for (const match of text.matchAll(NO_TODO_RE)) {
    const reason = String(match[1] ?? "").trim();
    if (reason.length > 0) return reason;
  }
  return null;
}

export function evaluatePrTodoReference({ body = "", commitMessages = [] } = {}) {
  const todoIds = extractTodoReferenceIds(body, commitMessages);
  if (todoIds.length > 0) {
    return { ok: true, reason: "todo_reference_found", todo_ids: todoIds };
  }

  const noTodoReason = findNoTodoReason(body, commitMessages);
  if (noTodoReason) {
    return { ok: true, reason: "explicit_no_todo", no_todo_reason: noTodoReason };
  }

  return {
    ok: false,
    reason: "missing_todo_reference",
    accepted_formats: [
      "Closes UnClick todo: <uuid>",
      "no-todo: <reason>",
    ],
  };
}

export function buildInProgressReconciliationPlan({
  todos = [],
  pullRequests = [],
  now = new Date().toISOString(),
  mergedWindowDays = 30,
  staleAfterDays = 7,
} = {}) {
  const nowMs = parseTime(now);
  if (nowMs === null) {
    return { ok: false, reason: "invalid_now", auto_close: [], stale: [], unchanged: [] };
  }

  const mergedRefs = new Map();
  for (const pr of Array.isArray(pullRequests) ? pullRequests : []) {
    const mergedAt = pr.merged_at ?? pr.mergedAt;
    const mergedMs = parseTime(mergedAt);
    if (mergedMs === null) continue;
    if (daysBetween(nowMs, mergedMs) > mergedWindowDays) continue;

    for (const todoId of extractTodoReferenceIds(prText(pr))) {
      const list = mergedRefs.get(todoId) ?? [];
      list.push({
        number: pr.number ?? pr.pr_number ?? null,
        url: pr.url ?? pr.html_url ?? null,
        merged_at: new Date(mergedMs).toISOString(),
      });
      mergedRefs.set(todoId, list);
    }
  }

  const autoClose = [];
  const stale = [];
  const unchanged = [];

  for (const todo of Array.isArray(todos) ? todos : []) {
    if (todo?.status !== "in_progress" || todo.completed_at != null || todo.completedAt != null) {
      continue;
    }

    const todoId = String(todo.id ?? "").toLowerCase();
    const matchingPrs = mergedRefs.get(todoId) ?? [];
    if (matchingPrs.length > 0) {
      autoClose.push({
        todo_id: todo.id,
        title: todo.title ?? "",
        pr: matchingPrs[0],
      });
      continue;
    }

    const updatedMs = parseTime(todo.updated_at ?? todo.updatedAt ?? todo.created_at ?? todo.createdAt);
    const ageDays = updatedMs === null ? null : daysBetween(nowMs, updatedMs);
    if (ageDays !== null && ageDays >= staleAfterDays) {
      stale.push({
        todo_id: todo.id,
        title: todo.title ?? "",
        assigned_to_agent_id: todo.assigned_to_agent_id ?? null,
        age_days: Number(ageDays.toFixed(2)),
      });
    } else {
      unchanged.push({ todo_id: todo.id, title: todo.title ?? "" });
    }
  }

  return {
    ok: true,
    reason: "reconciliation_plan",
    auto_close: autoClose,
    stale,
    unchanged,
  };
}

export async function readReconciliationInput(filePath) {
  if (!filePath) return { ok: false, reason: "missing_input_path" };
  return JSON.parse(await readFile(filePath, "utf8"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  readReconciliationInput(getArg("input", process.env.FISHBOWL_RECONCILIATION_INPUT || ""))
    .then((input) => {
      if (Array.isArray(input.todos) || Array.isArray(input.pullRequests) || Array.isArray(input.pull_requests)) {
        return buildInProgressReconciliationPlan({
          todos: input.todos,
          pullRequests: input.pullRequests ?? input.pull_requests,
          now: input.now,
          mergedWindowDays: input.mergedWindowDays ?? input.merged_window_days,
          staleAfterDays: input.staleAfterDays ?? input.stale_after_days,
        });
      }
      return evaluatePrTodoReference({
        body: input.body,
        commitMessages: input.commitMessages ?? input.commit_messages,
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
