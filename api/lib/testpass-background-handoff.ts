import { createHash } from "node:crypto";
import type { RunProfile, RunTarget } from "../../packages/testpass/src/types.js";

export const TESTPASS_BACKGROUND_HANDOFF_LEASE_SECONDS = 600;
export const DEFAULT_TESTPASS_BACKGROUND_HANDOFF_AGENT_ID = "chatgpt-55-plex-creativelead";

export interface TestPassBackgroundFailureHandoffInput {
  runId: string;
  packSlug: string;
  packName: string;
  profile: RunProfile;
  target: RunTarget;
  targetAgentId: string | null | undefined;
  errorMessage: string | null | undefined;
}

export interface TestPassBackgroundFailureHandoffPlan {
  source: "testpass";
  targetAgentId: string;
  taskRef: string;
  payload: {
    kind: "testpass_background_failure";
    run_id: string;
    pack_slug: string;
    pack_name: string;
    profile: RunProfile;
    target_url: string;
    error_message: string;
    ack_required: true;
  };
  leaseSeconds: number;
}

export interface TestPassBackgroundFailureDispatchRow {
  api_key_hash: string;
  dispatch_id: string;
  source: "testpass";
  target_agent_id: string;
  task_ref: string;
  status: "leased";
  lease_owner: string;
  lease_expires_at: string;
  payload: TestPassBackgroundFailureHandoffPlan["payload"];
  created_at: string;
  updated_at: string;
}

function truncateError(value: string): string {
  return value.length > 300 ? `${value.slice(0, 297)}...` : value;
}

export function testPassBackgroundFailureDispatchId(runId: string): string {
  const digest = createHash("sha256")
    .update(`testpass-background-failure:${runId}`)
    .digest("hex")
    .slice(0, 32);
  return `dispatch_${digest}`;
}

export function planTestPassBackgroundFailureHandoff(
  input: TestPassBackgroundFailureHandoffInput,
): TestPassBackgroundFailureHandoffPlan | null {
  const targetAgentId = (input.targetAgentId ?? "").trim();
  const errorMessage = (input.errorMessage ?? "").trim();
  if (!targetAgentId || !input.runId || !errorMessage) return null;

  return {
    source: "testpass",
    targetAgentId,
    taskRef: `testpass-run:${input.runId}`,
    payload: {
      kind: "testpass_background_failure",
      run_id: input.runId,
      pack_slug: input.packSlug,
      pack_name: input.packName,
      profile: input.profile,
      target_url: input.target.url ?? "",
      error_message: truncateError(errorMessage),
      ack_required: true,
    },
    leaseSeconds: TESTPASS_BACKGROUND_HANDOFF_LEASE_SECONDS,
  };
}

export function buildTestPassBackgroundFailureDispatchRow(params: {
  apiKeyHash: string;
  dispatchId: string;
  plan: TestPassBackgroundFailureHandoffPlan;
  now: Date;
}): TestPassBackgroundFailureDispatchRow {
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
