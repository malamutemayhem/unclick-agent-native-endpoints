import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import {
  planWorkerMovementWorkflowPilot,
  planWorkerMovementWorkflowPilotProofSignal,
  type WorkerMovementWorkflowPilotAction,
  type WorkerMovementWorkflowPilotProofAction,
  type WorkerMovementWorkflowPilotProofSignalInsertRow,
  type WorkerSelfHealingTodoState,
} from "./fishbowl-watcher.js";

const WORKER_MOVEMENT_PILOT_DEDUP_WINDOW_MS = 30 * 60 * 1000;

export interface WorkerMovementPilotTodoRow extends WorkerSelfHealingTodoState {
  api_key_hash: string;
  title?: string | null;
}

export interface WorkerMovementPilotStore {
  fetchCandidate(nowIso: string): Promise<{
    data: WorkerMovementPilotTodoRow | null;
    error: string | null;
  }>;
  hasRecentProof(params: {
    apiKeyHash: string;
    action: WorkerMovementWorkflowPilotProofAction;
    candidateId: string;
    sinceIso: string;
  }): Promise<{
    data: boolean;
    error: string | null;
  }>;
  insertProof(row: WorkerMovementWorkflowPilotProofSignalInsertRow): Promise<{
    error: string | null;
  }>;
}

export type WorkerMovementPilotRunStatus =
  | "skip_disabled"
  | "skip_no_candidate"
  | "proof_inserted"
  | "proof_recently_emitted"
  | "candidate_fetch_failed"
  | "proof_planning_failed"
  | "proof_dedupe_failed"
  | "proof_insert_failed";

export interface WorkerMovementPilotRunResult {
  ok: boolean;
  mode: "dry_run";
  status: WorkerMovementPilotRunStatus;
  candidate_id: string | null;
  action: WorkerMovementWorkflowPilotAction | "skip_no_candidate" | null;
  proof_signal_action: WorkerMovementWorkflowPilotProofAction | null;
  proof_status: "PASS" | "BLOCKER" | null;
  proof_inserted: boolean;
  proof_deduped: boolean;
  summary: string;
  next_safe_step: string;
  error?: string;
}

export function createWorkerMovementPilotStore(
  supabase: ReturnType<typeof createClient>,
): WorkerMovementPilotStore {
  return {
    async fetchCandidate(nowIso) {
      const { data, error } = await supabase
        .from("mc_fishbowl_todos")
        .select("id, api_key_hash, title, status, assigned_to_agent_id, lease_token, lease_expires_at, reclaim_count")
        .in("status", ["open", "in_progress"])
        .not("lease_expires_at", "is", null)
        .lt("lease_expires_at", nowIso)
        .order("lease_expires_at", { ascending: true })
        .limit(1);
      return {
        data: ((data ?? []) as WorkerMovementPilotTodoRow[])[0] ?? null,
        error: error?.message ?? null,
      };
    },
    async hasRecentProof(params) {
      const { data, error } = await supabase
        .from("mc_signals")
        .select("action, payload, created_at")
        .eq("api_key_hash", params.apiKeyHash)
        .eq("tool", "fishbowl")
        .eq("action", params.action)
        .gt("created_at", params.sinceIso);

      if (error) {
        return { data: false, error: error.message };
      }

      const alreadyEmitted = ((data ?? []) as Array<{
        payload: Record<string, unknown> | null;
      }>).some((signal) => signal.payload?.candidate_id === params.candidateId);
      return { data: alreadyEmitted, error: null };
    },
    async insertProof(row) {
      const { error } = await supabase.from("mc_signals").insert(row);
      return { error: error?.message ?? null };
    },
  };
}

export function isWorkerMovementPilotEnabled(value: string | undefined): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "enabled";
}

export function buildWorkerMovementPilotDisabledResult(): WorkerMovementPilotRunResult {
  return {
    ok: true,
    mode: "dry_run",
    status: "skip_disabled",
    candidate_id: null,
    action: null,
    proof_signal_action: null,
    proof_status: null,
    proof_inserted: false,
    proof_deduped: false,
    summary: "Worker movement pilot is disabled by WORKER_MOVEMENT_PILOT_ENABLED.",
    next_safe_step: "set WORKER_MOVEMENT_PILOT_ENABLED=true after safety review",
  };
}

export async function runWorkerMovementPilotDryRun(params: {
  store: WorkerMovementPilotStore;
  nowMs?: number;
  enabled?: boolean;
}): Promise<WorkerMovementPilotRunResult> {
  if (params.enabled === false) {
    return buildWorkerMovementPilotDisabledResult();
  }

  const nowMs = params.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const candidateResult = await params.store.fetchCandidate(nowIso);

  if (candidateResult.error) {
    return failureResult({
      status: "candidate_fetch_failed",
      summary: "Worker movement pilot could not fetch a candidate.",
      nextSafeStep: "fix candidate query or database access, then rerun dry-run",
      error: candidateResult.error,
    });
  }

  const candidate = candidateResult.data;
  if (!candidate) {
    return {
      ok: true,
      mode: "dry_run",
      status: "skip_no_candidate",
      candidate_id: null,
      action: "skip_no_candidate",
      proof_signal_action: null,
      proof_status: null,
      proof_inserted: false,
      proof_deduped: false,
      summary: "Worker movement pilot found no expired todo lease candidate.",
      next_safe_step: "skip workflow start and keep cron watcher as fallback",
    };
  }

  const plan = planWorkerMovementWorkflowPilot({
    todo: candidate,
    title: candidate.title,
    profile: null,
    latestHandoffReceiptId: null,
    nowMs,
  });
  const proof = planWorkerMovementWorkflowPilotProofSignal({
    apiKeyHash: candidate.api_key_hash,
    plan,
    emittedAt: nowIso,
  });

  if (!proof) {
    return failureResult({
      status: "proof_planning_failed",
      candidateId: plan.candidate_id,
      action: plan.action,
      summary: "Worker movement pilot could not build proof signal.",
      nextSafeStep: "check tenant hash and emitted time before rerun",
    });
  }

  const proofStatus = proof.signal.action === "worker_movement_workflow_pilot_blocker"
    ? "BLOCKER"
    : "PASS";
  const dedupeResult = await params.store.hasRecentProof({
    apiKeyHash: candidate.api_key_hash,
    action: proof.insert.action,
    candidateId: plan.candidate_id,
    sinceIso: new Date(nowMs - WORKER_MOVEMENT_PILOT_DEDUP_WINDOW_MS).toISOString(),
  });

  if (dedupeResult.error) {
    return failureResult({
      status: "proof_dedupe_failed",
      candidateId: plan.candidate_id,
      action: plan.action,
      proofSignalAction: proof.signal.action,
      proofStatus,
      summary: "Worker movement pilot could not check recent proof.",
      nextSafeStep: "fix proof dedupe query or database access, then rerun dry-run",
      error: dedupeResult.error,
    });
  }

  if (dedupeResult.data) {
    return {
      ok: true,
      mode: "dry_run",
      status: "proof_recently_emitted",
      candidate_id: plan.candidate_id,
      action: plan.action,
      proof_signal_action: proof.signal.action,
      proof_status: proofStatus,
      proof_inserted: false,
      proof_deduped: true,
      summary: proof.signal.summary,
      next_safe_step: plan.proof.next_safe_step,
    };
  }

  const insertResult = await params.store.insertProof(proof.insert);
  if (insertResult.error) {
    return failureResult({
      status: "proof_insert_failed",
      candidateId: plan.candidate_id,
      action: plan.action,
      proofSignalAction: proof.signal.action,
      proofStatus,
      summary: "Worker movement pilot could not insert proof signal.",
      nextSafeStep: "fix proof insert or database access, then rerun dry-run",
      error: insertResult.error,
    });
  }

  return {
    ok: true,
    mode: "dry_run",
    status: "proof_inserted",
    candidate_id: plan.candidate_id,
    action: plan.action,
    proof_signal_action: proof.signal.action,
    proof_status: proofStatus,
    proof_inserted: true,
    proof_deduped: false,
    summary: proof.signal.summary,
    next_safe_step: plan.proof.next_safe_step,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const enabled = isWorkerMovementPilotEnabled(
    process.env.WORKER_MOVEMENT_PILOT_ENABLED,
  );
  if (!enabled) {
    return res.status(200).json(buildWorkerMovementPilotDisabledResult());
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Database service unavailable" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const result = await runWorkerMovementPilotDryRun({
    store: createWorkerMovementPilotStore(supabase),
    enabled,
  });
  return res.status(result.ok ? 200 : 500).json(result);
}

function failureResult(params: {
  status: Exclude<
    WorkerMovementPilotRunStatus,
    "skip_disabled" | "skip_no_candidate" | "proof_inserted" | "proof_recently_emitted"
  >;
  candidateId?: string | null;
  action?: WorkerMovementWorkflowPilotAction | null;
  proofSignalAction?: WorkerMovementWorkflowPilotProofAction | null;
  proofStatus?: "PASS" | "BLOCKER" | null;
  summary: string;
  nextSafeStep: string;
  error?: string;
}): WorkerMovementPilotRunResult {
  return {
    ok: false,
    mode: "dry_run",
    status: params.status,
    candidate_id: params.candidateId ?? null,
    action: params.action ?? null,
    proof_signal_action: params.proofSignalAction ?? null,
    proof_status: params.proofStatus ?? null,
    proof_inserted: false,
    proof_deduped: false,
    summary: params.summary,
    next_safe_step: params.nextSafeStep,
    ...(params.error ? { error: params.error } : {}),
  };
}
