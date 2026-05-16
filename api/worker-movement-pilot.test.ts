import { readFileSync } from "node:fs";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { afterEach, describe, expect, it } from "vitest";
import handler, {
  isWorkerMovementPilotEnabled,
  isWorkerMovementPilotHttpMethodAllowed,
  isWorkerMovementPilotProofWriteEnabled,
  runWorkerMovementPilotDryRun,
  type WorkerMovementPilotStore,
  type WorkerMovementPilotTodoRow,
} from "./worker-movement-pilot.js";

const nowMs = Date.parse("2026-05-01T01:22:00.000Z");
const originalCronSecret = process.env.CRON_SECRET;
const originalWorkerMovementPilotEnabled = process.env.WORKER_MOVEMENT_PILOT_ENABLED;
const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalViteSupabaseUrl = process.env.VITE_SUPABASE_URL;
const originalSupabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function restoreEnvValue(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function restoreWorkerMovementPilotEnv() {
  restoreEnvValue("CRON_SECRET", originalCronSecret);
  restoreEnvValue("WORKER_MOVEMENT_PILOT_ENABLED", originalWorkerMovementPilotEnabled);
  restoreEnvValue("SUPABASE_URL", originalSupabaseUrl);
  restoreEnvValue("VITE_SUPABASE_URL", originalViteSupabaseUrl);
  restoreEnvValue("SUPABASE_SERVICE_ROLE_KEY", originalSupabaseServiceRoleKey);
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

async function callHandler(params: {
  method?: string;
  authorization?: string;
}) {
  const response = createResponse();
  await handler(
    {
      method: params.method,
      headers: {
        authorization: params.authorization,
      },
    } as unknown as VercelRequest,
    response as unknown as VercelResponse,
  );
  return response;
}

function buildStore(params: {
  candidate: WorkerMovementPilotTodoRow | null;
  recentProof?: boolean;
  fetchError?: string | null;
  dedupeError?: string | null;
  insertError?: string | null;
}) {
  const inserted: unknown[] = [];
  const dedupeChecks: unknown[] = [];
  const fetches: string[] = [];
  const store: WorkerMovementPilotStore = {
    async fetchCandidate(nowIso) {
      fetches.push(nowIso);
      return {
        data: params.candidate,
        error: params.fetchError ?? null,
      };
    },
    async hasRecentProof(check) {
      dedupeChecks.push(check);
      return {
        data: params.recentProof ?? false,
        error: params.dedupeError ?? null,
      };
    },
    async insertProof(row) {
      inserted.push(row);
      return { error: params.insertError ?? null };
    },
  };
  return { store, inserted, dedupeChecks, fetches };
}

function expiredLeaseCandidate(overrides: Partial<WorkerMovementPilotTodoRow> = {}) {
  return {
    id: "todo-expired-lease",
    api_key_hash: "hash_123",
    title: "Worker self-healing: heartbeat timeout, reclaim, and resume-safe queue behavior",
    status: "in_progress",
    assigned_to_agent_id: "worker-1",
    lease_token: "lease-secret",
    lease_expires_at: "2026-05-01T01:10:00.000Z",
    reclaim_count: 2,
    ...overrides,
  };
}

describe("worker movement pilot API dry-run", () => {
  afterEach(() => {
    restoreWorkerMovementPilotEnv();
  });

  it("requires an explicit opt-in before polling candidates", async () => {
    const { store, inserted, dedupeChecks, fetches } = buildStore({
      candidate: expiredLeaseCandidate(),
    });

    const result = await runWorkerMovementPilotDryRun({
      store,
      nowMs,
      enabled: false,
    });

    expect(result).toMatchObject({
      ok: true,
      mode: "dry_run",
      status: "skip_disabled",
      candidate_id: null,
      proof_inserted: false,
      next_safe_step: "set WORKER_MOVEMENT_PILOT_ENABLED=true after safety review",
    });
    expect(fetches).toEqual([]);
    expect(dedupeChecks).toEqual([]);
    expect(inserted).toEqual([]);
  });

  it("accepts only explicit enabled values for the scheduler gate", () => {
    expect(isWorkerMovementPilotEnabled(undefined)).toBe(false);
    expect(isWorkerMovementPilotEnabled("")).toBe(false);
    expect(isWorkerMovementPilotEnabled("0")).toBe(false);
    expect(isWorkerMovementPilotEnabled("false")).toBe(false);
    expect(isWorkerMovementPilotEnabled("1")).toBe(true);
    expect(isWorkerMovementPilotEnabled("true")).toBe(true);
    expect(isWorkerMovementPilotEnabled("enabled")).toBe(true);
  });

  it("accepts only explicit enabled values for proof writes", () => {
    expect(isWorkerMovementPilotProofWriteEnabled(undefined)).toBe(false);
    expect(isWorkerMovementPilotProofWriteEnabled("")).toBe(false);
    expect(isWorkerMovementPilotProofWriteEnabled("0")).toBe(false);
    expect(isWorkerMovementPilotProofWriteEnabled("false")).toBe(false);
    expect(isWorkerMovementPilotProofWriteEnabled("1")).toBe(true);
    expect(isWorkerMovementPilotProofWriteEnabled("true")).toBe(true);
    expect(isWorkerMovementPilotProofWriteEnabled("enabled")).toBe(true);
  });

  it("allows only cron GET and manual POST methods", () => {
    expect(isWorkerMovementPilotHttpMethodAllowed(undefined)).toBe(true);
    expect(isWorkerMovementPilotHttpMethodAllowed("GET")).toBe(true);
    expect(isWorkerMovementPilotHttpMethodAllowed("post")).toBe(true);
    expect(isWorkerMovementPilotHttpMethodAllowed("DELETE")).toBe(false);
    expect(isWorkerMovementPilotHttpMethodAllowed("PUT")).toBe(false);
  });

  it("requires cron auth before returning disabled proof status", async () => {
    process.env.CRON_SECRET = "cron-secret";
    delete process.env.WORKER_MOVEMENT_PILOT_ENABLED;
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await callHandler({ method: "GET" });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  it("returns disabled status without database setup when authorized but not enabled", async () => {
    process.env.CRON_SECRET = "cron-secret";
    delete process.env.WORKER_MOVEMENT_PILOT_ENABLED;
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await callHandler({
      method: "GET",
      authorization: "Bearer cron-secret",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      status: "skip_disabled",
      proof_inserted: false,
      proof_deduped: false,
    });
  });

  it("rejects unsupported authorized methods before database setup", async () => {
    process.env.CRON_SECRET = "cron-secret";
    process.env.WORKER_MOVEMENT_PILOT_ENABLED = "true";
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await callHandler({
      method: "DELETE",
      authorization: "Bearer cron-secret",
    });

    expect(response.statusCode).toBe(405);
    expect(response.body).toEqual({ error: "Method not allowed" });
  });

  it("skips cleanly when no expired todo lease candidate exists", async () => {
    const { store, inserted, dedupeChecks, fetches } = buildStore({ candidate: null });

    const result = await runWorkerMovementPilotDryRun({ store, nowMs });

    expect(result).toMatchObject({
      ok: true,
      mode: "dry_run",
      status: "skip_no_candidate",
      candidate_id: null,
      action: "skip_no_candidate",
      proof_inserted: false,
      proof_deduped: false,
      next_safe_step: "skip workflow start and keep cron watcher as fallback",
    });
    expect(fetches).toEqual(["2026-05-01T01:22:00.000Z"]);
    expect(dedupeChecks).toEqual([]);
    expect(inserted).toEqual([]);
  });

  it("inserts PASS proof for one safe expired lease candidate", async () => {
    const { store, inserted, dedupeChecks } = buildStore({
      candidate: expiredLeaseCandidate(),
    });

    const result = await runWorkerMovementPilotDryRun({ store, nowMs });

    expect(result).toMatchObject({
      ok: true,
      status: "proof_inserted",
      candidate_id: "todo-expired-lease",
      action: "start_dry_run",
      proof_signal_action: "worker_movement_workflow_pilot_pass",
      proof_status: "PASS",
      proof_inserted: true,
      proof_deduped: false,
      next_safe_step: "start Vercel Workflow in dry-run mode and post proof only",
    });
    expect(dedupeChecks).toMatchObject([
      {
        apiKeyHash: "hash_123",
        action: "worker_movement_workflow_pilot_pass",
        candidateId: "todo-expired-lease",
        sinceIso: "2026-05-01T00:52:00.000Z",
      },
    ]);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      api_key_hash: "hash_123",
      tool: "fishbowl",
      action: "worker_movement_workflow_pilot_pass",
      severity: "info",
      deep_link: "/admin/jobs#todo-todo-expired-lease",
      payload: {
        proof_status: "PASS",
        candidate_id: "todo-expired-lease",
        has_lease_token: true,
        action: "start_dry_run",
      },
    });
    expect(JSON.stringify(inserted[0])).not.toContain("lease-secret");
  });

  it("plans proof without dedupe or insert when proof writes are disabled", async () => {
    const { store, inserted, dedupeChecks } = buildStore({
      candidate: expiredLeaseCandidate(),
    });

    const result = await runWorkerMovementPilotDryRun({
      store,
      nowMs,
      proofWritesEnabled: false,
    });

    expect(result).toMatchObject({
      ok: true,
      status: "proof_planned",
      candidate_id: "todo-expired-lease",
      action: "start_dry_run",
      proof_signal_action: "worker_movement_workflow_pilot_pass",
      proof_status: "PASS",
      proof_inserted: false,
      proof_deduped: false,
      next_safe_step:
        "enable WORKER_MOVEMENT_PILOT_PROOF_WRITES_ENABLED=true after planned proof looks safe",
    });
    expect(dedupeChecks).toEqual([]);
    expect(inserted).toEqual([]);
  });

  it("plans blocker proof without insert when proof writes are disabled", async () => {
    const { store, inserted, dedupeChecks } = buildStore({
      candidate: expiredLeaseCandidate({
        id: "todo-security",
        title: "SECURITY: deactivate legacy plaintext api_keys_legacy rows after owner auth",
      }),
    });

    const result = await runWorkerMovementPilotDryRun({
      store,
      nowMs,
      proofWritesEnabled: false,
    });

    expect(result).toMatchObject({
      ok: true,
      status: "proof_planned",
      candidate_id: "todo-security",
      action: "post_refusal_proof",
      proof_signal_action: "worker_movement_workflow_pilot_blocker",
      proof_status: "BLOCKER",
      proof_inserted: false,
      proof_deduped: false,
    });
    expect(dedupeChecks).toEqual([]);
    expect(inserted).toEqual([]);
  });

  it("inserts BLOCKER proof for an owner or security gated candidate", async () => {
    const { store, inserted } = buildStore({
      candidate: expiredLeaseCandidate({
        id: "todo-security",
        title: "SECURITY: deactivate legacy plaintext api_keys_legacy rows after owner auth",
      }),
    });

    const result = await runWorkerMovementPilotDryRun({ store, nowMs });

    expect(result).toMatchObject({
      ok: true,
      status: "proof_inserted",
      candidate_id: "todo-security",
      action: "post_refusal_proof",
      proof_signal_action: "worker_movement_workflow_pilot_blocker",
      proof_status: "BLOCKER",
      next_safe_step:
        "post refusal proof and leave the job with its owner (owner_or_security_gated_job)",
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      action: "worker_movement_workflow_pilot_blocker",
      severity: "action_needed",
      payload: {
        proof_status: "BLOCKER",
        candidate_id: "todo-security",
        safety_reason: "owner_or_security_gated_job",
      },
    });
    expect(JSON.stringify(inserted[0])).not.toContain("lease-secret");
  });

  it("dedupes proof when the same candidate was recently emitted", async () => {
    const { store, inserted } = buildStore({
      candidate: expiredLeaseCandidate(),
      recentProof: true,
    });

    const result = await runWorkerMovementPilotDryRun({ store, nowMs });

    expect(result).toMatchObject({
      ok: true,
      status: "proof_recently_emitted",
      candidate_id: "todo-expired-lease",
      proof_inserted: false,
      proof_deduped: true,
    });
    expect(inserted).toEqual([]);
  });

  it("reports proof insert failure without mutating the candidate", async () => {
    const { store } = buildStore({
      candidate: expiredLeaseCandidate(),
      insertError: "temporary insert failure",
    });

    const result = await runWorkerMovementPilotDryRun({ store, nowMs });

    expect(result).toMatchObject({
      ok: false,
      status: "proof_insert_failed",
      candidate_id: "todo-expired-lease",
      action: "start_dry_run",
      proof_signal_action: "worker_movement_workflow_pilot_pass",
      proof_status: "PASS",
      proof_inserted: false,
      proof_deduped: false,
      error: "temporary insert failure",
    });
  });

  it("keeps the Vercel cron pointed at the protected proof endpoint", () => {
    const config = JSON.parse(
      readFileSync("vercel.json", "utf8"),
    ) as { crons?: Array<{ path: string; schedule: string }> };

    expect(config.crons).toContainEqual({
      path: "/api/worker-movement-pilot",
      schedule: "*/15 * * * *",
    });
  });
});
