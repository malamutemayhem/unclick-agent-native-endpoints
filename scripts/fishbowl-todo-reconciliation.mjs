#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const UUID_RE_SOURCE =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

const TODO_REFERENCE_RE = new RegExp(
  `\\bCloses[ -]+(?:UnClick|Fishbowl)[ -]+todo\\s*:\\s*(${UUID_RE_SOURCE})\\b`,
  "gi",
);

const NO_TODO_RE = /^no-todo:\s*(\S.*)$/gim;
const PR_URL_RE = /github\.com\/[^\s/)]+\/[^\s/)]+\/pull\/(\d+)/gi;
const PR_NUMBER_RE = /\bPR\s*#(\d{1,7})\b/gi;
const LIVE_OUTCOME_RE =
  /\b(live proof|live outcome|verified live|browser verified|screenshot(?:s)?|api verified|production proof|visible in (?:the )?(?:app|ui|site)|live ui|live api|live product|dogfood(?:ed)?|manual qa)\b/i;
const LIVE_OUTCOME_NEGATIVE_RE =
  /\b(no|not|missing|needs?|needed|without|blocked|waiting for|unverified)\s+(?:live\s+)?(?:proof|outcome|verification|qa|screenshot|ui|api)\b|\b(?:live\s+)?(?:proof|outcome|verification|qa|screenshot|ui|api)\s+(?:missing|needed|unverified|blocked|incomplete)\b/i;
const LIVE_FACING_JOB_RE =
  /\b(live|production|ui|ux|screen|page|site|admin|dashboard|api|memory|library|recall|search|workflow|automation|autopilot|job(?:s)?|boardroom|orchestrator)\b/i;

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

function todoText(todo = {}) {
  return textParts(
    todo.title,
    todo.description,
    todo.pipeline_evidence,
    todo.pipelineEvidence,
    todo.comments,
    todo.comment_text,
    todo.commentText,
    todo.proof,
    todo.proof_text,
    todo.proofText,
  ).join("\n");
}

function hasLiveOutcomeProof(todo = {}) {
  const text = todoText(todo);
  return LIVE_OUTCOME_RE.test(text) && !LIVE_OUTCOME_NEGATIVE_RE.test(text);
}

function needsLiveOutcomeProof(todo = {}) {
  return LIVE_FACING_JOB_RE.test(todoText(todo));
}

function dispatchText(dispatch = {}) {
  return textParts(
    dispatch.text,
    dispatch.summary,
    dispatch.title,
    dispatch.source_url,
    dispatch.sourceUrl,
    dispatch.payload?.source_url,
    dispatch.payload?.sourceUrl,
    dispatch.deep_link,
    dispatch.deepLink,
  ).join("\n");
}

function receiptText(receipt = {}) {
  return textParts(
    receipt.text,
    receipt.summary,
    receipt.title,
    receipt.source_url,
    receipt.sourceUrl,
    receipt.payload?.source_url,
    receipt.payload?.sourceUrl,
  ).join("\n");
}

function normalizedTags(record = {}) {
  return (Array.isArray(record.tags) ? record.tags : [])
    .map((tag) => String(tag ?? "").toLowerCase())
    .filter(Boolean);
}

function hasTag(record, tag) {
  return normalizedTags(record).includes(String(tag).toLowerCase());
}

function firstKnown(...values) {
  return values.find((value) => value != null && String(value).length > 0) ?? null;
}

function pullRequestNumber(pr = {}) {
  const number = Number(pr.number ?? pr.pr_number);
  return Number.isFinite(number) ? number : null;
}

function pullRequestMergedAt(pr = {}) {
  return parseTime(pr.merged_at ?? pr.mergedAt);
}

function pullRequestMergeCommit(pr = {}) {
  return firstKnown(
    pr.merge_commit_sha,
    pr.mergeCommitSha,
    pr.mergeCommit?.oid,
    pr.mergeCommit?.sha,
    pr.merge_commit?.oid,
    pr.merge_commit?.sha,
  );
}

function findWakePassCompletionProof(prNumber, receipts = []) {
  for (const receipt of Array.isArray(receipts) ? receipts : []) {
    const text = receiptText(receipt);
    const textLower = text.toLowerCase();
    const tags = normalizedTags(receipt);
    if (!extractPullRequestNumbers(text).includes(prNumber)) continue;

    const wakePassLike =
      tags.includes("wakepass") ||
      textLower.includes("wakepass") ||
      textLower.includes("wake-pull_request-pr");
    const completionLike =
      tags.includes("ack") ||
      tags.includes("done") ||
      tags.includes("completed") ||
      /\b(ack|merged|completed|handoff complete)\b/i.test(text);

    if (!wakePassLike || !completionLike) continue;

    return {
      receipt_id: firstKnown(receipt.id, receipt.source_id, receipt.message_id),
      receipt_text: text.replace(/\s+/g, " ").trim().slice(0, 220),
    };
  }

  return null;
}

function todoHasShipReceipt(todo = {}) {
  const source = String(todo.pipeline_source ?? todo.pipelineSource ?? "").toLowerCase();
  const evidence = normalizedTags({ tags: todo.pipeline_evidence ?? todo.pipelineEvidence ?? [] });
  const progress = Number(todo.pipeline_progress ?? todo.pipelineProgress ?? 0);
  const stageCount = Number(todo.pipeline_stage_count ?? todo.pipelineStageCount ?? 0);
  return (
    source.includes("receipt: ship") ||
    evidence.includes("ship") ||
    progress >= 100 ||
    stageCount >= 5
  );
}

function findMergedPrProofForTodo(todo, pullRequests, nowMs, mergedWindowDays) {
  if (!todoHasShipReceipt(todo)) return null;
  const mentionedPrs = extractPullRequestNumbers(todoText(todo));
  if (mentionedPrs.length === 0) return null;

  for (const pr of pullRequests) {
    const number = Number(pr?.number ?? pr?.pr_number);
    if (!mentionedPrs.includes(number)) continue;

    const mergedAt = pr?.merged_at ?? pr?.mergedAt;
    const mergedMs = parseTime(mergedAt);
    if (mergedMs === null) continue;
    if (daysBetween(nowMs, mergedMs) > mergedWindowDays) continue;

    return {
      number,
      url: pr.url ?? pr.html_url ?? null,
      merged_at: new Date(mergedMs).toISOString(),
    };
  }

  return null;
}

export function extractPullRequestNumbers(...parts) {
  const text = textParts(...parts).join("\n");
  const numbers = new Set();
  for (const match of text.matchAll(PR_URL_RE)) numbers.add(Number(match[1]));
  for (const match of text.matchAll(PR_NUMBER_RE)) numbers.add(Number(match[1]));
  return [...numbers].filter(Number.isFinite).sort((a, b) => a - b);
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
    return { ok: false, reason: "invalid_now", auto_close: [], needs_verification: [], stale: [], unchanged: [] };
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
  const needsVerification = [];
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
        reason: "linked_pr_marker",
      });
      continue;
    }

    const proofPr = findMergedPrProofForTodo(todo, pullRequests, nowMs, mergedWindowDays);
    if (proofPr) {
      needsVerification.push({
        todo_id: todo.id,
        title: todo.title ?? "",
        pr: proofPr,
        reason: "pipeline_ship_proof_needs_outcome_verification",
        next: "Do not auto-close from pipeline text alone. Verify the live outcome or exact acceptance proof first.",
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
    needs_verification: needsVerification,
    stale,
    unchanged,
  };
}

export function buildJobsGithubSyncPlan({
  todos = [],
  pullRequests = [],
} = {}) {
  const safeTodos = Array.isArray(todos) ? todos : [];
  const safePrs = Array.isArray(pullRequests) ? pullRequests : [];
  const todoById = new Map(
    safeTodos
      .map((todo) => [String(todo?.id ?? "").toLowerCase(), todo])
      .filter(([id]) => id),
  );
  const prByNumber = new Map(
    safePrs
      .map((pr) => [Number(pr?.number ?? pr?.pr_number), pr])
      .filter(([number]) => Number.isFinite(number)),
  );
  const prsByTodo = new Map();
  const issues = [];
  const linked = [];

  for (const pr of safePrs) {
    const number = Number(pr?.number ?? pr?.pr_number);
    if (!Number.isFinite(number)) continue;

    const text = prText(pr);
    const todoIds = extractTodoReferenceIds(text);
    const noTodoReason = findNoTodoReason(text);

    if (todoIds.length === 0 && !noTodoReason) {
      issues.push({
        kind: "pr_needs_job_link",
        severity: "high",
        pr_number: number,
        message: `PR #${number} is not linked to an UnClick Job.`,
        next: "Add `Closes UnClick todo: <job id>` to the PR body, or add `no-todo: <reason>` for tiny safe changes.",
      });
      continue;
    }

    for (const todoId of todoIds) {
      const list = prsByTodo.get(todoId) ?? [];
      list.push(number);
      prsByTodo.set(todoId, list);

      if (!todoById.has(todoId)) {
        issues.push({
          kind: "pr_points_to_missing_job",
          severity: "medium",
          pr_number: number,
          todo_id: todoId,
          message: `PR #${number} points to a Job ID that is not visible in the current Jobs list.`,
          next: "Confirm the Job exists, then refresh the Jobs list or correct the PR marker.",
        });
      } else {
        linked.push({ pr_number: number, todo_id: todoId });
      }
    }
  }

  for (const todo of safeTodos) {
    const todoId = String(todo?.id ?? "").toLowerCase();
    if (!todoId || todo?.status === "dropped") continue;

    const mentionedPrs = extractPullRequestNumbers(todoText(todo));
    const markedPrs = new Set(prsByTodo.get(todoId) ?? []);

    for (const prNumber of mentionedPrs) {
      if (markedPrs.has(prNumber)) continue;
      if (!prByNumber.has(prNumber)) continue;
      issues.push({
        kind: "job_mentions_pr_without_marker",
        severity: "high",
        todo_id: todo.id,
        pr_number: prNumber,
        message: `Job ${todo.id} mentions PR #${prNumber}, but the PR does not carry this Job ID.`,
        next: `Add \`Closes UnClick todo: ${todo.id}\` to PR #${prNumber} before merge.`,
      });
    }

    const mergedMarkedPr = [...markedPrs]
      .map((number) => prByNumber.get(number))
      .find((pr) => parseTime(pr?.merged_at ?? pr?.mergedAt) !== null);
    if (todo.status === "in_progress" && mergedMarkedPr) {
      issues.push({
        kind: "job_ready_to_complete",
        severity: "high",
        todo_id: todo.id,
        pr_number: Number(mergedMarkedPr.number ?? mergedMarkedPr.pr_number),
        message: `Job ${todo.id} has a merged linked PR but is still active.`,
        next: "Run the auto-close reconciliation or complete the Job with the linked PR as proof.",
      });
    }

    if (todo.status === "done" && markedPrs.size === 0 && mentionedPrs.length === 0) {
      issues.push({
        kind: "done_job_missing_proof",
        severity: "medium",
        todo_id: todo.id,
        message: `Completed Job ${todo.id} has no visible GitHub proof link.`,
        next: "Add the PR, run, or deployment link to the Job proof so future seats can audit it.",
      });
    }

    if (todo.status === "done" && needsLiveOutcomeProof(todo) && !hasLiveOutcomeProof(todo)) {
      issues.push({
        kind: "done_job_missing_live_outcome_proof",
        severity: "high",
        todo_id: todo.id,
        message: `Completed Job ${todo.id} looks live-facing but has no visible live outcome proof.`,
        next: "Attach screenshot, browser/API verification, or reopen the Job until the promised result is visible.",
      });
    }
  }

  return {
    ok: true,
    reason: "jobs_github_sync_plan",
    issues,
    linked,
  };
}

export function buildMergedPrDispatchReconciliationPlan({
  dispatches = [],
  pullRequests = [],
  receipts = [],
  completionReceipts = [],
} = {}) {
  const safePrs = Array.isArray(pullRequests) ? pullRequests : [];
  const prByNumber = new Map(
    safePrs
      .map((pr) => [pullRequestNumber(pr), pr])
      .filter(([number]) => Number.isFinite(number)),
  );
  const proofReceipts = [
    ...(Array.isArray(receipts) ? receipts : []),
    ...(Array.isArray(completionReceipts) ? completionReceipts : []),
  ];
  const completeDispatches = [];
  const suppressBlockers = [];
  const untouched = [];

  for (const dispatch of Array.isArray(dispatches) ? dispatches : []) {
    const dispatchId = firstKnown(dispatch.id, dispatch.source_id, dispatch.dispatch_id);
    const text = dispatchText(dispatch);
    const prNumbers = extractPullRequestNumbers(text);

    if (prNumbers.length === 0) {
      untouched.push({ dispatch_id: dispatchId, reason: "no_pr_reference" });
      continue;
    }

    for (const prNumber of prNumbers) {
      const pr = prByNumber.get(prNumber);
      if (!pr) {
        untouched.push({ dispatch_id: dispatchId, pr_number: prNumber, reason: "missing_pr" });
        continue;
      }

      if (pr.isDraft === true || pr.draft === true) {
        untouched.push({ dispatch_id: dispatchId, pr_number: prNumber, reason: "pr_draft" });
        continue;
      }

      const mergedAt = pullRequestMergedAt(pr);
      if (mergedAt === null) {
        untouched.push({ dispatch_id: dispatchId, pr_number: prNumber, reason: "pr_not_merged" });
        continue;
      }

      const proof = findWakePassCompletionProof(prNumber, proofReceipts);
      if (!proof) {
        untouched.push({
          dispatch_id: dispatchId,
          pr_number: prNumber,
          reason: "missing_wakepass_completion_proof",
        });
        continue;
      }

      const staleBlocker =
        String(dispatch.kind ?? "").toLowerCase() === "blocker" ||
        hasTag(dispatch, "blocker") ||
        hasTag(dispatch, "stale") ||
        /\b(blocker|stale)\b/i.test(text);
      const item = {
        kind: staleBlocker ? "suppress_blocker" : "complete_dispatch",
        dispatch_id: dispatchId,
        pr_number: prNumber,
        pr_url: firstKnown(pr.url, pr.html_url),
        merge_commit: pullRequestMergeCommit(pr),
        merged_at: new Date(mergedAt).toISOString(),
        receipt_id: proof.receipt_id,
        receipt_text: proof.receipt_text,
      };

      if (staleBlocker) {
        suppressBlockers.push(item);
      } else {
        completeDispatches.push(item);
      }
    }
  }

  return {
    ok: true,
    reason: "merged_pr_dispatch_reconciliation_plan",
    complete_dispatches: completeDispatches,
    suppress_blockers: suppressBlockers,
    untouched,
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
        if (input.mode === "jobs_github_sync") {
          return buildJobsGithubSyncPlan({
            todos: input.todos,
            pullRequests: input.pullRequests ?? input.pull_requests,
          });
        }
        if (input.mode === "merged_pr_dispatch_reconciliation") {
          return buildMergedPrDispatchReconciliationPlan({
            dispatches: input.dispatches,
            pullRequests: input.pullRequests ?? input.pull_requests,
            receipts: input.receipts,
            completionReceipts: input.completionReceipts ?? input.completion_receipts,
          });
        }
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
