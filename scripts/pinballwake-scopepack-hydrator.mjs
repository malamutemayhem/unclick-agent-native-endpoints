#!/usr/bin/env node

import { createHash } from "node:crypto";

function compact(value, max = 500) {
  const text = redactSecretLikeText(value).replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function redactSecretLikeText(value) {
  return String(value ?? "")
    .replace(
      /([?&](?:key|api_key|access_token|refresh_token|client_secret|token)=)[^&\s]+/gi,
      "$1[redacted]",
    )
    .replace(
      /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|token)\s*[:=]\s*([^\s,;]+)/gi,
      "$1=[redacted]",
    );
}

function normalizePath(value) {
  return String(value ?? "").replace(/\\/g, "/").trim();
}

function safeList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => compact(item, 240)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((item) => compact(item, 240))
      .filter(Boolean);
  }
  return [];
}

function parseJsonObject(value) {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseLabeledJsonObjectFromText(value, labels = ["ScopePack", "scopepack", "Scope Pack", "Runner Scope"]) {
  const text = String(value ?? "");
  if (!text.trim()) return null;

  for (const label of labels) {
    const fencePattern = new RegExp(String.raw`${label}\s*:\s*\r?\n\s*` + "```(?:json)?\\s*\\r?\\n([\\s\\S]*?)\\r?\\n```", "i");
    const fence = text.match(fencePattern);
    const parsedFence = parseJsonObject(fence?.[1]);
    if (parsedFence) return parsedFence;

    const inlinePattern = new RegExp(String.raw`(?:^|\n)\s*${label}\s*:\s*(\{[^\r\n]*\})`, "i");
    const inline = text.match(inlinePattern);
    const parsedInline = parseJsonObject(inline?.[1]);
    if (parsedInline) return parsedInline;
  }

  return null;
}

function firstObject(...values) {
  for (const value of values) {
    const parsed = parseJsonObject(value);
    if (parsed) return parsed;
  }
  return null;
}

function firstText(...values) {
  for (const value of values) {
    const text = compact(value, 600);
    if (text) return text;
  }
  return "";
}

function firstList(...values) {
  for (const value of values) {
    const list = safeList(value);
    if (list.length > 0) return list;
  }
  return [];
}

function recentTodoText(todo = {}) {
  const comments = Array.isArray(todo.recent_comments)
    ? todo.recent_comments
    : Array.isArray(todo.comments)
      ? todo.comments
      : [];

  return [
    todo.latest_comment_text,
    todo.last_comment_text,
    ...comments.map((comment) => `${comment?.body || ""}\n${comment?.text || ""}`),
  ].join("\n");
}

export function extractHydratableScopePack(todo = {}) {
  return firstObject(
    todo.scope_pack,
    todo.scopePack,
    todo.runner_scope,
    todo.runnerScope,
    todo.autonomous_scope,
    todo.autonomousScope,
    parseLabeledJsonObjectFromText(todo.description),
    parseLabeledJsonObjectFromText(todo.body),
    parseLabeledJsonObjectFromText(todo.notes),
  );
}

export function scopePackHydrationKey(todo = {}, scope = {}, { headSha = "" } = {}) {
  const sourceHead = firstText(
    headSha,
    todo.head_sha,
    todo.headSha,
    todo.source_head,
    todo.sourceHead,
    scope.head_sha,
    scope.headSha,
    "no-head",
  );
  const seed = [
    todo.id || todo.todo_id || "unknown-todo",
    todo.title || scope.chip_title || scope.title || "",
    sourceHead,
    JSON.stringify(scope.owned_files || scope.ownedFiles || scope.owned_modules || scope.ownedModules || []),
  ].join("|");
  return createHash("sha256").update(seed).digest("hex").slice(0, 16);
}

function normalizeHydrationScope(todo = {}, scope = {}, options = {}) {
  const ownedFiles = firstList(scope.owned_files, scope.ownedFiles, scope.files, scope.paths).map(normalizePath);
  const ownedModules = firstList(scope.owned_modules, scope.ownedModules, scope.owned_surfaces, scope.ownedSurfaces);
  const acceptance = firstList(scope.acceptance, scope.acceptance_criteria, scope.acceptanceCriteria);
  const verification = firstList(
    scope.verification,
    scope.tests,
    scope.test_proof_plan?.allowlist_tests,
    scope.testProofPlan?.allowlistTests,
  );
  const stopConditions = firstList(scope.stop_conditions, scope.stopConditions);
  const nonGoals = firstList(scope.non_goals, scope.nonGoals, scope.out_of_scope, scope.outOfScope);
  const proofRequired = firstText(scope.proof_required, scope.proofRequired, scope.expected_proof, scope.expectedProof);
  const laneHint = firstText(
    scope.owner_hint,
    scope.ownerHint,
    scope.lane,
    scope.worker_lane,
    scope.workerLane,
    scope.worker,
    scope.role,
    todo.owner_hint,
    todo.ownerHint,
    todo.lane,
  );
  const duplicateSuppressionKey = firstText(
    scope.duplicate_suppression_key,
    scope.duplicateSuppressionKey,
    scope.suppression_key,
    scope.suppressionKey,
    scopePackHydrationKey(todo, scope, options),
  );

  return {
    owned_files: ownedFiles,
    owned_modules: ownedModules,
    acceptance,
    verification,
    stop_conditions: stopConditions,
    proof_required: proofRequired,
    owner_or_lane_hint: laneHint,
    non_goals: nonGoals,
    duplicate_suppression_key: duplicateSuppressionKey,
  };
}

function missingHydrationFields(hydrated = {}) {
  const missing = [];
  if (!hydrated.owned_files?.length && !hydrated.owned_modules?.length) missing.push("owned_files_or_owned_modules");
  if (!hydrated.acceptance?.length) missing.push("acceptance");
  if (!hydrated.verification?.length) missing.push("verification");
  if (!hydrated.stop_conditions?.length) missing.push("stop_conditions");
  if (!hydrated.proof_required) missing.push("proof_required");
  if (!hydrated.owner_or_lane_hint) missing.push("owner_or_lane_hint");
  if (!hydrated.non_goals?.length) missing.push("non_goals");
  if (!hydrated.duplicate_suppression_key) missing.push("duplicate_suppression_key");
  return missing;
}

function hydrationAlreadyRecorded(todo = {}, suppressionKey = "") {
  const text = recentTodoText(todo);
  return Boolean(
    suppressionKey &&
      text.includes(`scopepack_hydration_key=${suppressionKey}`) &&
      /scopepack_hydrated|scopepack_hydration_missing_fields|SUPPRESS/i.test(text),
  );
}

function receiptList(label, values) {
  return `${label}=${(values || []).map((value) => compact(value, 160)).join(" | ") || "none"}`;
}

export function buildScopePackHydrationReceipt(todo = {}, options = {}) {
  const scope = extractHydratableScopePack(todo);
  if (!scope) {
    return {
      ok: false,
      action: "needs_manual_scoping",
      reason: "no_hydratable_scopepack",
      receipt: "",
      scopepack_hydration_key: "",
    };
  }

  const hydrated = normalizeHydrationScope(todo, scope, options);
  if (hydrationAlreadyRecorded(todo, hydrated.duplicate_suppression_key)) {
    return {
      ok: true,
      action: "suppress",
      reason: "duplicate_scopepack_hydration_receipt",
      receipt: "",
      scopepack_hydration_key: hydrated.duplicate_suppression_key,
      scopepack: hydrated,
    };
  }

  const missing = missingHydrationFields(hydrated);
  if (missing.length > 0) {
    return {
      ok: false,
      action: "blocker",
      reason: "scopepack_hydration_missing_fields",
      missing_fields: missing,
      receipt: compact(
        [
          "BLOCKER: scopepack_hydration_missing_fields.",
          `scopepack_hydration_key=${hydrated.duplicate_suppression_key}.`,
          `missing_fields=${missing.join(",")}.`,
          "Next: attach the missing ScopePack fields before BuildBait emits an execution_packet.",
        ].join(" "),
        1200,
      ),
      scopepack_hydration_key: hydrated.duplicate_suppression_key,
      scopepack: hydrated,
    };
  }

  return {
    ok: true,
    action: "scopepack_hydrated",
    reason: "scopepack_hydrated",
    receipt: compact(
      [
        "PASS: scopepack_hydrated.",
        `scopepack_hydration_key=${hydrated.duplicate_suppression_key}.`,
        receiptList("owned_files", hydrated.owned_files),
        receiptList("owned_modules", hydrated.owned_modules),
        receiptList("acceptance", hydrated.acceptance),
        receiptList("verification", hydrated.verification),
        receiptList("stop_conditions", hydrated.stop_conditions),
        `proof_required=${compact(hydrated.proof_required, 220)}.`,
        `owner_or_lane_hint=${compact(hydrated.owner_or_lane_hint, 120)}.`,
        receiptList("non_goals", hydrated.non_goals),
        "Next: BuildBait may emit execution_packet only from this bounded ScopePack; Runner still needs owned_files before code claim.",
      ].join(" "),
      2400,
    ),
    scopepack_hydration_key: hydrated.duplicate_suppression_key,
    scopepack: hydrated,
  };
}
