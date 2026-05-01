import { createHash } from "node:crypto";

export const UXPASS_RUN_HANDOFF_LEASE_SECONDS = 600;
export const DEFAULT_UXPASS_RUN_HANDOFF_AGENT_ID = "chatgpt-55-plex-creativelead";

export interface UxPassRunFailureHandoffInput {
  runId: string;
  targetUrl: string;
  targetAgentId: string | null | undefined;
  isScheduled: boolean;
  status?: string | null;
  errorMessage?: string | null;
  taskId?: string | null;
}

export interface UxPassRunFailureHandoffPlan {
  source: "uxpass";
  targetAgentId: string;
  taskRef: string;
  payload: {
    kind: "uxpass_run_failure";
    run_id: string;
    target_url: string;
    status: "failed";
    error_message: string;
    task_id: string | null;
    ack_required: true;
  };
  leaseSeconds: number;
}

export interface UxPassRunFailureDispatchRow {
  api_key_hash: string;
  dispatch_id: string;
  source: "uxpass";
  target_agent_id: string;
  task_ref: string;
  status: "leased";
  lease_owner: string;
  lease_expires_at: string;
  payload: UxPassRunFailureHandoffPlan["payload"];
  created_at: string;
  updated_at: string;
}

function truncateMessage(value: string): string {
  return value.length > 300 ? `${value.slice(0, 297)}...` : value;
}

export function uxPassRunFailureDispatchId(runId: string): string {
  const digest = createHash("sha256")
    .update(`uxpass-run-failure:${runId}`)
    .digest("hex")
    .slice(0, 32);
  return `dispatch_${digest}`;
}

export function planUxPassRunFailureHandoff(
  input: UxPassRunFailureHandoffInput,
): UxPassRunFailureHandoffPlan | null {
  const targetAgentId = (input.targetAgentId ?? "").trim();
  if (!input.isScheduled || !targetAgentId || !input.runId) return null;

  const status = (input.status ?? "").trim();
  const rawError = (input.errorMessage ?? "").trim();
  if (status !== "failed" && !rawError) return null;

  return {
    source: "uxpass",
    targetAgentId,
    taskRef: `uxpass-run:${input.runId}`,
    payload: {
      kind: "uxpass_run_failure",
      run_id: input.runId,
      target_url: input.targetUrl,
      status: "failed",
      error_message: truncateMessage(rawError || "Scheduled UXPass run returned failed status"),
      task_id: input.taskId ?? null,
      ack_required: true,
    },
    leaseSeconds: UXPASS_RUN_HANDOFF_LEASE_SECONDS,
  };
}

export function buildUxPassRunFailureDispatchRow(params: {
  apiKeyHash: string;
  dispatchId: string;
  plan: UxPassRunFailureHandoffPlan;
  now: Date;
}): UxPassRunFailureDispatchRow {
  const nowIso = params.now.toISOString();
  return {
    api_key_hash: params.apiKeyHash,
    dispatch_id: params.dispatchId,
    source: params.plan.source,
    target_agent_id: params.plan.targetAgentId,
    task_ref: params.plan.taskRef,
    status: "leased",
    lease_owner: params.plan.targetAgentId,
    lease_expires_at: new Date(
      params.now.getTime() + params.plan.leaseSeconds * 1000,
    ).toISOString(),
    payload: params.plan.payload,
    created_at: nowIso,
    updated_at: nowIso,
  };
}
