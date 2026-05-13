type TodoStatus = "open" | "in_progress" | "done" | "dropped" | string;

export type TodoReconcileDecision =
  | "close_candidate"
  | "needs_proof"
  | "hold"
  | "conflict"
  | "already_done"
  | "ignore";

export interface TodoReconcileInput {
  id?: string;
  title?: string;
  status?: TodoStatus;
  completed_at?: string | null;
  pipeline_progress?: number | null;
  pipeline_source?: string | null;
  pipeline_evidence?: string[] | null;
  proof_refs?: string[] | null;
  comments?: Array<string | { text?: string | null }> | null;
  linked_pull_requests?: Array<{
    url?: string | null;
    state?: string | null;
    merged_at?: string | null;
    checks_conclusion?: string | null;
  }> | null;
  linked_issues?: Array<{
    url?: string | null;
    state?: string | null;
    completion_label?: string | null;
  }> | null;
}

export interface TodoReconcileContext {
  active_blockers?: string[] | null;
}

export interface TodoReconcileResult {
  todo_id: string | null;
  title: string | null;
  decision: TodoReconcileDecision;
  should_close: boolean;
  should_comment: boolean;
  receipt: string;
  proof_refs: string[];
  missing: string[];
  blockers: string[];
  reasons: string[];
}

export interface TodoReconcileReport {
  closed: TodoReconcileResult[];
  blocked: TodoReconcileResult[];
  skipped: TodoReconcileResult[];
  needs_human_review: TodoReconcileResult[];
  counts: {
    closed: number;
    blocked: number;
    skipped: number;
    needs_human_review: number;
  };
}

const FINAL_PROOF_WORDS = [
  "merged",
  "merge commit",
  "testpass",
  "passed",
  "ship",
  "shipped",
  "closed",
  "done",
  "complete",
  "completed",
  "receipt",
];

const FALSE_POSITIVE_WORDS = [
  "scopepack",
  "execution packet",
  "git sync proof",
  "issue sync",
  "research brief",
  "planning",
  "worker execution packet",
];

function normalized(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function commentText(todo: TodoReconcileInput): string[] {
  return (todo.comments ?? []).map((comment) => {
    if (typeof comment === "string") return comment;
    return String(comment?.text ?? "");
  }).filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function extractUrls(values: string[]): string[] {
  return unique(values.flatMap((value) => value.match(/https?:\/\/\S+/g) ?? []));
}

function hasCompletionLanguage(values: string[]): boolean {
  const text = normalized(values.join("\n"));
  return FINAL_PROOF_WORDS.some((word) => text.includes(word));
}

function hasFalsePositiveLanguage(values: string[]): boolean {
  const text = normalized(values.join("\n"));
  return FALSE_POSITIVE_WORDS.some((word) => text.includes(word));
}

function hasMergedPullRequest(todo: TodoReconcileInput): boolean {
  return (todo.linked_pull_requests ?? []).some((pr) => {
    const state = normalized(pr.state);
    const checks = normalized(pr.checks_conclusion);
    return Boolean(pr.url) && (state === "merged" || Boolean(pr.merged_at)) && (!checks || checks === "success");
  });
}

function hasClosedCompletionIssue(todo: TodoReconcileInput): boolean {
  return (todo.linked_issues ?? []).some((issue) => {
    const state = normalized(issue.state);
    const label = normalized(issue.completion_label);
    return Boolean(issue.url) && state === "closed" && ["complete", "completed", "done", "shipped"].includes(label);
  });
}

function evidenceHasShipReceipt(todo: TodoReconcileInput): boolean {
  const source = normalized(todo.pipeline_source);
  const evidence = (todo.pipeline_evidence ?? []).map(normalized);
  return source === "receipt: ship" || source.includes("receipt: ship") || evidence.includes("ship");
}

function blockerMatches(todo: TodoReconcileInput, context: TodoReconcileContext): string[] {
  const id = normalized(todo.id);
  const title = normalized(todo.title);
  const proofRefs = (todo.proof_refs ?? []).map(normalized);
  const candidates = [id, ...proofRefs, ...(title ? [title.slice(0, 80)] : [])].filter((candidate) => candidate.length > 8);

  return (context.active_blockers ?? []).filter((blocker) => {
    const text = normalized(blocker);
    return candidates.some((candidate) => text.includes(candidate));
  });
}

export function classifyTodoForReconciliation(
  todo: TodoReconcileInput,
  context: TodoReconcileContext = {},
): TodoReconcileResult {
  const todoId = todo.id ?? null;
  const title = todo.title ?? null;
  const status = normalized(todo.status);
  const comments = commentText(todo);
  const textEvidence = [
    title ?? "",
    todo.pipeline_source ?? "",
    ...(todo.pipeline_evidence ?? []),
    ...(todo.proof_refs ?? []),
    ...comments,
  ];
  const proofRefs = unique([
    ...(todo.proof_refs ?? []),
    ...extractUrls(textEvidence),
    ...((todo.linked_pull_requests ?? []).map((pr) => pr.url ?? "")),
    ...((todo.linked_issues ?? []).map((issue) => issue.url ?? "")),
  ]);
  const blockers = blockerMatches({ ...todo, proof_refs: proofRefs }, context);
  const missing: string[] = [];
  const reasons: string[] = [];

  if (status === "done") {
    return makeResult(todoId, title, "already_done", proofRefs, missing, blockers, ["Todo is already done."]);
  }

  if (status === "dropped") {
    return makeResult(todoId, title, "ignore", proofRefs, missing, blockers, ["Dropped todos are ignored."]);
  }

  if (todo.completed_at) reasons.push("completed_at present");
  if (hasMergedPullRequest(todo)) reasons.push("merged PR proof");
  if (hasClosedCompletionIssue(todo)) reasons.push("closed completion issue");
  if (evidenceHasShipReceipt(todo)) reasons.push("ship receipt evidence");

  const hasAuthoritativeProof = Boolean(todo.completed_at) || hasMergedPullRequest(todo) || hasClosedCompletionIssue(todo);
  const hasReceiptAndPointer = evidenceHasShipReceipt(todo) && proofRefs.length > 0 && hasCompletionLanguage(textEvidence);
  const pipelineComplete = Number(todo.pipeline_progress ?? 0) >= 100;

  if (blockers.length > 0 && (hasAuthoritativeProof || hasReceiptAndPointer || pipelineComplete)) {
    return makeResult(todoId, title, "hold", proofRefs, missing, blockers, [
      ...reasons,
      "Active blocker references this todo or proof source.",
    ]);
  }

  if (pipelineComplete && hasFalsePositiveLanguage(textEvidence) && !hasAuthoritativeProof) {
    missing.push("authoritative completion proof");
    return makeResult(todoId, title, "needs_proof", proofRefs, missing, blockers, [
      "Pipeline looks complete, but evidence is planning, sync, research, or execution-packet text.",
    ]);
  }

  if (!pipelineComplete && hasAuthoritativeProof && status !== "open" && status !== "in_progress") {
    return makeResult(todoId, title, "conflict", proofRefs, missing, blockers, [
      "Authoritative proof exists, but todo status is not an open active state.",
    ]);
  }

  if ((status === "open" || status === "in_progress") && (hasAuthoritativeProof || (pipelineComplete && hasReceiptAndPointer))) {
    return makeResult(todoId, title, "close_candidate", proofRefs, missing, blockers, reasons);
  }

  if (pipelineComplete || hasCompletionLanguage(textEvidence)) {
    if (!pipelineComplete) missing.push("pipeline_progress=100");
    if (!evidenceHasShipReceipt(todo)) missing.push("receipt: ship");
    if (proofRefs.length === 0) missing.push("proof pointer");
    if (!hasCompletionLanguage(textEvidence)) missing.push("final proof language");
    return makeResult(todoId, title, "needs_proof", proofRefs, missing, blockers, [
      "Completion-like evidence is not enough to close safely.",
    ]);
  }

  return makeResult(todoId, title, "ignore", proofRefs, missing, blockers, ["No completion signal."]);
}

function makeResult(
  todoId: string | null,
  title: string | null,
  decision: TodoReconcileDecision,
  proofRefs: string[],
  missing: string[],
  blockers: string[],
  reasons: string[],
): TodoReconcileResult {
  const shouldClose = decision === "close_candidate";
  const shouldComment = ["close_candidate", "needs_proof", "hold", "conflict"].includes(decision);
  return {
    todo_id: todoId,
    title,
    decision,
    should_close: shouldClose,
    should_comment: shouldComment,
    receipt: `TodoProofReconciler ${decision}: ${shouldClose ? "safe close candidate" : reasons[0] ?? "no mutation"}`,
    proof_refs: proofRefs,
    missing,
    blockers,
    reasons,
  };
}

export function buildTodoReconcileReport(results: TodoReconcileResult[]): TodoReconcileReport {
  const closed = results.filter((result) => result.decision === "close_candidate");
  const blocked = results.filter((result) => result.decision === "hold" || result.decision === "conflict");
  const needsHumanReview = results.filter((result) => result.decision === "needs_proof");
  const skipped = results.filter((result) => result.decision === "already_done" || result.decision === "ignore");

  return {
    closed,
    blocked,
    skipped,
    needs_human_review: needsHumanReview,
    counts: {
      closed: closed.length,
      blocked: blocked.length,
      skipped: skipped.length,
      needs_human_review: needsHumanReview.length,
    },
  };
}
