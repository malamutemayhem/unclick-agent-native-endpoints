import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  createCodingRoomJob,
  createCodingRoomJobLedger,
  writeCodingRoomJobLedger,
} from "./pinballwake-coding-room.mjs";
import {
  createCodingRoomJobFromBoardroomTodo,
  createAutonomousRunner,
  evaluateBoardroomTodoAutoClaimEligibility,
  evaluateOrchestratorSeatHandshakeProof,
  extractBoardroomTodoIdFromCodingRoomJob,
  fetchUnClickActionableTodos,
  fetchUnClickOrchestratorContext,
  inspectAutonomousRunnerJobSafety,
  markUnsafeJobsBlockedForAutonomousRunner,
  normalizeAutonomousRunnerMode,
  parseMcpEventStreamPayload,
  runAutonomousRunnerCycle,
  runAutonomousRunnerFile,
} from "./pinballwake-autonomous-runner.mjs";

const runner = createAutonomousRunner({
  id: "runner-plex-1",
  readiness: "builder_ready",
  capabilities: ["implementation", "test_fix", "docs_update"],
});

function safeJob(input = {}) {
  return createCodingRoomJob({
    jobId: input.jobId || "coding-room:autonomous-runner:safe",
    worker: "builder",
    chip: "safe scoped docs chip",
    files: ["docs/runner.md"],
    expectedProof: {
      requiresPr: false,
      requiresChangedFiles: false,
      requiresNonOverlap: true,
      requiresTests: false,
      tests: [],
    },
    ...input,
  });
}

describe("PinballWake autonomous Runner seat", () => {
  it("defaults unknown modes back to dry-run", () => {
    assert.equal(normalizeAutonomousRunnerMode("claim"), "claim");
    assert.equal(normalizeAutonomousRunnerMode("ship-it"), "dry-run");
  });

  it("claims safe scoped work through the existing Coding Room runner", () => {
    const result = runAutonomousRunnerCycle({
      ledger: createCodingRoomJobLedger({ jobs: [safeJob()] }),
      runner,
      mode: "claim",
      now: "2026-05-06T03:00:00.000Z",
      leaseSeconds: 60,
    });

    assert.equal(result.ok, true);
    assert.equal(result.action, "claimed");
    assert.equal(result.runner, "runner-plex-1");
    assert.equal(result.ledger.jobs[0].claimed_by, "runner-plex-1");
    assert.equal(result.ledger.jobs[0].lease_expires_at, "2026-05-06T03:01:00.000Z");
  });

  it("does not persist dry-run claims to disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autonomous-runner-"));
    const ledgerPath = join(dir, "ledger.json");
    try {
      await writeCodingRoomJobLedger(ledgerPath, createCodingRoomJobLedger({ jobs: [safeJob()] }));

      const result = await runAutonomousRunnerFile({
        ledgerPath,
        runner,
        mode: "dry-run",
        now: "2026-05-06T03:00:00.000Z",
      });

      assert.equal(result.ok, true);
      assert.equal(result.action, "claimed");
      assert.equal(result.persisted, false);

      const persisted = JSON.parse(await readFile(ledgerPath, "utf8"));
      assert.equal(persisted.jobs[0].status, "queued");
      assert.equal(persisted.jobs[0].claimed_by, null);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("imports real UnClick actionable todos before the claim cycle", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autonomous-runner-"));
    const ledgerPath = join(dir, "ledger.json");
    try {
      await writeCodingRoomJobLedger(ledgerPath, createCodingRoomJobLedger());

      const calls = [];
      const fetchImpl = async (url, init = {}) => {
        calls.push({ url, init });
        return {
          ok: true,
          async json() {
            return {
              jsonrpc: "2.0",
              id: "test",
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      todos: [
                        {
                          id: "b744462e-8e50-4cad-babb-5468adc2a3d9",
                          title: "Coding Room: live runner with CAS/lock for safe racing",
                          status: "open",
                          priority: "urgent",
                          assigned_to_agent_id: null,
                          created_at: "2026-05-04T04:41:45.530Z",
                        },
                      ],
                    }),
                  },
                ],
              },
            };
          },
        };
      };

      const result = await runAutonomousRunnerFile({
        ledgerPath,
        runner,
        mode: "dry-run",
        queueSource: "unclick",
        unclickApiKey: "uc_test",
        unclickMcpUrl: "https://unclick.test/api/mcp",
        fetchImpl,
        now: "2026-05-06T03:00:00.000Z",
      });

      assert.equal(result.ok, true);
      assert.equal(result.action, "idle");
      assert.equal(result.persisted, false);
      assert.equal(result.queue_source.source, "unclick");
      assert.equal(result.queue_source.seen, 1);
      assert.equal(result.queue_source.imported, 1);
      assert.equal(result.ledger.jobs[0].job_id, "boardroom-todo:b744462e-8e50-4cad-babb-5468adc2a3d9");
      assert.deepEqual(result.ledger.jobs[0].owned_files, []);
      assert.equal(result.ledger.jobs[0].build.patch, "");
      assert.equal(result.skipped[0].reason, "boardroom_todo_missing_scopepack");
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, "https://unclick.test/api/mcp");
      assert.equal(calls[0].init.headers.authorization, "Bearer uc_test");
      assert.match(calls[0].init.body, /list_actionable_todos/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("imports a ScopePack embedded in an UnClick todo description", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autonomous-runner-"));
    const ledgerPath = join(dir, "ledger.json");
    try {
      await writeCodingRoomJobLedger(ledgerPath, createCodingRoomJobLedger());

      const scopePack = {
        owned_files: ["docs/autonomous-runner-scopepack.md"],
        patch: "diff --git a/docs/autonomous-runner-scopepack.md b/docs/autonomous-runner-scopepack.md\n--- a/docs/autonomous-runner-scopepack.md\n+++ b/docs/autonomous-runner-scopepack.md\n@@ -1 +1 @@\n-old\n+new\n",
        tests: ["node --test scripts/pinballwake-autonomous-runner.test.mjs"],
      };

      const fetchImpl = async () => ({
        ok: true,
        async json() {
          return {
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    todos: [
                      {
                        id: "todo-description-scopepack",
                        title: "Document autonomous runner ScopePack parsing",
                        status: "open",
                        priority: "high",
                        assigned_to_agent_id: null,
                        description: [
                          "Small safe implementation chip.",
                          "ScopePack:",
                          "```json",
                          JSON.stringify(scopePack, null, 2),
                          "```",
                        ].join("\n"),
                      },
                    ],
                  }),
                },
              ],
            },
          };
        },
      });

      const result = await runAutonomousRunnerFile({
        ledgerPath,
        runner,
        mode: "dry-run",
        queueSource: "unclick",
        unclickApiKey: "uc_test",
        unclickMcpUrl: "https://unclick.test/api/mcp",
        fetchImpl,
        now: "2026-05-09T10:30:00.000Z",
      });

      assert.equal(result.ok, true);
      assert.equal(result.action, "claimed");
      assert.equal(result.persisted, false);
      assert.equal(result.queue_source.imported, 1);
      assert.deepEqual(result.ledger.jobs[0].owned_files, ["docs/autonomous-runner-scopepack.md"]);
      assert.match(result.ledger.jobs[0].build.patch, /docs\/autonomous-runner-scopepack\.md/);
      assert.deepEqual(result.ledger.jobs[0].expected_proof.tests, [
        "node --test scripts/pinballwake-autonomous-runner.test.mjs",
      ]);
      assert.match(result.ledger.jobs[0].context, /scopepack=present/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("quietly skips scoped UnClick todos that are not safe to auto-claim", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autonomous-runner-"));
    const ledgerPath = join(dir, "ledger.json");
    const scopePack = {
      owned_files: ["docs/safe-chip.md"],
      patch: "diff --git a/docs/safe-chip.md b/docs/safe-chip.md\n--- a/docs/safe-chip.md\n+++ b/docs/safe-chip.md\n@@ -1 +1 @@\n-old\n+new\n",
      tests: [],
    };

    try {
      await writeCodingRoomJobLedger(ledgerPath, createCodingRoomJobLedger());

      const fetchImpl = async () => ({
        ok: true,
        async json() {
          return {
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    todos: [
                      {
                        id: "todo-low",
                        title: "Low priority safe chip",
                        status: "open",
                        priority: "normal",
                        assigned_to_agent_id: null,
                        actionability_reason: "unassigned_open",
                        scope_pack: scopePack,
                      },
                      {
                        id: "todo-hold",
                        title: "Builder HOLD on owner decision",
                        status: "open",
                        priority: "urgent",
                        assigned_to_agent_id: null,
                        actionability_reason: "unassigned_open",
                        scope_pack: scopePack,
                      },
                      {
                        id: "todo-auth",
                        title: "Auth session hardening",
                        status: "open",
                        priority: "urgent",
                        assigned_to_agent_id: null,
                        actionability_reason: "unassigned_open",
                        scope_pack: scopePack,
                      },
                      {
                        id: "todo-assigned",
                        title: "Assigned scoped chip",
                        status: "open",
                        priority: "urgent",
                        assigned_to_agent_id: "other-seat",
                        actionability_reason: "unassigned_open",
                        scope_pack: scopePack,
                      },
                      {
                        id: "todo-safe",
                        title: "Safe docs chip",
                        status: "open",
                        priority: "urgent",
                        assigned_to_agent_id: null,
                        actionability_reason: "unassigned_open",
                        scope_pack: scopePack,
                      },
                    ],
                  }),
                },
              ],
            },
          };
        },
      });

      const result = await runAutonomousRunnerFile({
        ledgerPath,
        runner,
        mode: "dry-run",
        queueSource: "unclick",
        unclickApiKey: "uc_test",
        unclickMcpUrl: "https://unclick.test/api/mcp",
        fetchImpl,
        now: "2026-05-09T11:00:00.000Z",
      });

      assert.equal(result.ok, true);
      assert.equal(result.action, "claimed");
      assert.equal(result.queue_source.seen, 5);
      assert.equal(result.queue_source.imported, 1);
      assert.deepEqual(result.queue_source.claimability_scorecard, {
        seen: 5,
        claimable: 1,
        imported: 1,
        skipped: 4,
        skip_reasons: {
          boardroom_todo_already_assigned: 1,
          boardroom_todo_hold_or_blocker_marker: 1,
          boardroom_todo_priority_not_allowed: 1,
          protected_surface_auth: 1,
        },
        state: "claimable",
        healthy: true,
      });
      assert.equal(result.claimability_scorecard.claimed, 1);
      assert.equal(result.claimability_scorecard.last_action, "claimed");
      assert.equal(result.ledger.jobs[0].job_id, "boardroom-todo:todo-safe");
      assert.deepEqual(
        result.queue_source.skipped.map((skip) => skip.reason).sort(),
        [
          "boardroom_todo_already_assigned",
          "boardroom_todo_hold_or_blocker_marker",
          "boardroom_todo_priority_not_allowed",
          "protected_surface_auth",
        ].sort(),
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("keeps a scoped todo eligible only for the builder allowlist and open unassigned queue", () => {
    const base = {
      id: "todo-role",
      title: "Safe docs chip",
      status: "open",
      priority: "urgent",
      assigned_to_agent_id: null,
      actionability_reason: "unassigned_open",
      scope_pack: {
        owned_files: ["docs/safe-chip.md"],
        patch: "diff --git a/docs/safe-chip.md b/docs/safe-chip.md\n--- a/docs/safe-chip.md\n+++ b/docs/safe-chip.md\n@@ -1 +1 @@\n-old\n+new\n",
        role: "builder",
      },
    };

    assert.equal(evaluateBoardroomTodoAutoClaimEligibility(base).ok, true);
    assert.equal(
      evaluateBoardroomTodoAutoClaimEligibility({
        ...base,
        scope_pack: {
          ...base.scope_pack,
          role: "coordinator",
        },
      }).reason,
      "boardroom_todo_role_not_allowed",
    );
  });

  it("allows unassigned orchestrator ScopePacks with builder-compatible owner hints", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autonomous-runner-"));
    const ledgerPath = join(dir, "ledger.json");
    try {
      const todo = {
        id: "e9e308cd-7711-4f30-8ebd-d5402fefd205",
        title: "Orchestrator continuity wiring: plug missing source-kinds into Orchestrator",
        status: "open",
        priority: "urgent",
        assigned_to_agent_id: null,
        actionability_reason: "unassigned_open",
        created_at: "2026-05-11T01:38:48.701Z",
        scope_pack: {
          lane: "orchestrator",
          owner_hint: "live_builder_or_orchestrator_seat",
          owned_files: ["api/lib/orchestrator-context.ts"],
          patch:
            "diff --git a/api/lib/orchestrator-context.ts b/api/lib/orchestrator-context.ts\n--- a/api/lib/orchestrator-context.ts\n+++ b/api/lib/orchestrator-context.ts\n@@ -1 +1 @@\n-old\n+new\n",
          tests: ["node --test api/orchestrator-context.test.ts"],
        },
      };

      assert.equal(evaluateBoardroomTodoAutoClaimEligibility(todo).ok, true);
      assert.equal(
        evaluateBoardroomTodoAutoClaimEligibility({
          ...todo,
          scope_pack: {
            ...todo.scope_pack,
            owner_hint: "",
          },
        }).reason,
        "boardroom_todo_role_not_allowed",
      );

      await writeCodingRoomJobLedger(ledgerPath, createCodingRoomJobLedger());
      const fetchImpl = async () => ({
        ok: true,
        async json() {
          return {
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ todos: [todo] }),
                },
              ],
            },
          };
        },
      });

      const result = await runAutonomousRunnerFile({
        ledgerPath,
        runner,
        mode: "dry-run",
        queueSource: "unclick",
        unclickApiKey: "uc_test",
        unclickMcpUrl: "https://unclick.test/api/mcp",
        fetchImpl,
        now: "2026-05-12T01:00:00.000Z",
      });

      assert.equal(result.ok, true);
      assert.equal(result.action, "claimed");
      assert.equal(result.queue_source.imported, 1);
      assert.equal(result.queue_source.skipped.length, 0);
      assert.equal(result.queue_source.todos[0].scope_pack_seen, true);
      assert.equal(result.queue_source.todos[0].lane, "orchestrator");
      assert.equal(result.queue_source.todos[0].owner_hint, "live_builder_or_orchestrator_seat");
      assert.equal(result.ledger.jobs[0].job_id, "boardroom-todo:e9e308cd-7711-4f30-8ebd-d5402fefd205");
      assert.equal(result.ledger.jobs[0].worker, "builder");
      assert.deepEqual(result.ledger.jobs[0].owned_files, ["api/lib/orchestrator-context.ts"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("does not pretend the queue is empty when UnClick queue auth is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autonomous-runner-"));
    const ledgerPath = join(dir, "ledger.json");
    try {
      await writeCodingRoomJobLedger(ledgerPath, createCodingRoomJobLedger());

      const result = await runAutonomousRunnerFile({
        ledgerPath,
        runner,
        mode: "dry-run",
        queueSource: "unclick",
        now: "2026-05-06T03:00:00.000Z",
      });

      assert.equal(result.ok, false);
      assert.equal(result.action, "blocked");
      assert.equal(result.reason, "queue_source_unavailable");
      assert.equal(result.queue_source.reason, "missing_unclick_api_key");
      assert.equal(result.cycles.length, 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("parses UnClick MCP actionable todo responses", async () => {
    const result = await fetchUnClickActionableTodos({
      agentId: "runner-test",
      apiKey: "uc_test",
      mcpUrl: "https://unclick.test/api/mcp",
      fetchImpl: async () => ({
        ok: true,
        async json() {
          return {
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ todos: [{ id: "todo-1", title: "Ship a tiny chip" }] }),
                },
              ],
            },
          };
        },
      }),
    });

    assert.equal(result.ok, true);
    assert.equal(result.todos.length, 1);
    assert.equal(result.todos[0].id, "todo-1");
  });

  it("parses streamed UnClick MCP actionable todo responses", async () => {
    const streamedPayload = {
      jsonrpc: "2.0",
      id: "test",
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              todos: [{ id: "todo-sse", title: "Claim from streamed MCP" }],
            }),
          },
        ],
      },
    };
    const streamText = [
      "event: message",
      `data: ${JSON.stringify(streamedPayload)}`,
      "",
    ].join("\n");

    assert.equal(parseMcpEventStreamPayload(streamText)?.id, "test");

    const result = await fetchUnClickActionableTodos({
      agentId: "runner-test",
      apiKey: "uc_test",
      mcpUrl: "https://unclick.test/api/mcp",
      fetchImpl: async () => ({
        ok: true,
        async text() {
          return streamText;
        },
      }),
    });

    assert.equal(result.ok, true);
    assert.equal(result.todos.length, 1);
    assert.equal(result.todos[0].id, "todo-sse");
  });

  it("reads Orchestrator context for a scheduled seat_handshake proof", async () => {
    const calls = [];
    const result = await runAutonomousRunnerFile({
      orchestratorProof: true,
      orchestratorProofSource: "github_schedule",
      unclickApiKey: "uc_test",
      unclickMcpUrl: "https://unclick.test/api/mcp",
      fetchImpl: async (url, init = {}) => {
        calls.push({ url, body: JSON.parse(init.body), auth: init.headers.authorization });
        return {
          ok: true,
          async json() {
            return {
              context: {
                seat_handshake: {
                  mode: "fresh-seat-pickup",
                  active_decision: "Chris greenlit Orchestrator V1 proof with AutoPilotKit and PinballWake.",
                  active_job: "urgent open: Orchestrator chip: PinballWake scheduled proof reads seat_handshake.",
                  recent_proof: "PASS: PR #653 shipped seat_handshake.",
                  active_blocker: null,
                  seat_freshness: ["PinballWake: Live"],
                  source_pointers: [{ source_kind: "todo", source_id: "fa3801d1" }],
                },
              },
            };
          },
        };
      },
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://unclick.test/api/memory-admin?action=orchestrator_context_read");
    assert.equal(calls[0].body.limit, 10);
    assert.equal(calls[0].auth, "Bearer uc_test");
    assert.equal(result.ok, true);
    assert.equal(result.action, "orchestrator_proof_passed");
    assert.match(result.proof_line, /^PASS: Orchestrator seat_handshake readable/);
    assert.equal(result.orchestrator_proof.source_pointer_count, 1);
    assert.equal(result.wake_gate.reason, "scheduled_proof_source");
  });

  it("blocks workflow_dispatch from counting as Orchestrator scheduled proof", async () => {
    let called = false;
    const result = await runAutonomousRunnerFile({
      orchestratorProof: true,
      orchestratorProofSource: "workflow_dispatch",
      unclickApiKey: "uc_test",
      unclickMcpUrl: "https://unclick.test/api/mcp",
      fetchImpl: async () => {
        called = true;
        return { ok: false };
      },
    });

    assert.equal(called, false);
    assert.equal(result.ok, false);
    assert.equal(result.reason, "manual_dispatch_is_not_scheduled_proof");
    assert.match(result.proof_line, /^BLOCKER: manual_dispatch_is_not_scheduled_proof/);
    assert.equal(result.wake_gate.safe_mode.no_manual_dispatch_as_schedule, true);
  });

  it("allows a trusted UnClick fallback proof only when the schedule is stale and the heartbeat is fresh", async () => {
    const calls = [];
    const result = await runAutonomousRunnerFile({
      orchestratorProof: true,
      orchestratorProofSource: "trusted_unclick_fallback",
      lastScheduledProofAt: "2026-05-10T01:24:03.000Z",
      trustedFallbackSource: "unclick_heartbeat",
      trustedFallbackAt: "2026-05-10T03:46:00.000Z",
      trustedFallbackId: "heartbeat-03-46",
      now: "2026-05-10T03:46:57.000Z",
      unclickApiKey: "uc_test",
      unclickMcpUrl: "https://unclick.test/api/mcp",
      fetchImpl: async (url, init = {}) => {
        calls.push({ url, body: JSON.parse(init.body) });
        return {
          ok: true,
          async json() {
            return {
              context: {
                seat_handshake: {
                  mode: "fresh-seat-pickup",
                  active_decision: "Use trusted UnClick fallback if the schedule misses.",
                  active_job: "Orchestrator proof via AutoPilotKit fallback.",
                  recent_proof: "PASS: heartbeat fallback gate opened.",
                  active_blocker: null,
                  seat_freshness: ["PinballWake: Live"],
                  source_pointers: [{ source_kind: "boardroom_message", source_id: "heartbeat-03-46" }],
                },
              },
            };
          },
        };
      },
    });

    assert.equal(calls.length, 1);
    assert.equal(result.ok, true);
    assert.equal(result.wake_gate.reason, "trusted_unclick_fallback_due");
    assert.equal(result.wake_gate.scheduler_watchdog.action, "tap_orchestrator_with_trusted_unclick_fallback");
  });

  it("accepts empty active work but blocks noisy Orchestrator seat_handshake proof packets", async () => {
    const direct = evaluateOrchestratorSeatHandshakeProof({
      seat_handshake: {
        active_decision: null,
        active_job: "",
        recent_proof: null,
        seat_freshness: ["PinballWake: Live"],
        source_pointers: [{ source_id: "todo-1" }],
      },
    });

    assert.equal(direct.ok, true);
    assert.equal(direct.reason, "seat_handshake_ready");

    const fetched = await fetchUnClickOrchestratorContext({
      apiKey: "uc_test",
      mcpUrl: "https://unclick.test/api/mcp",
      fetchImpl: async () => ({
        ok: true,
        async json() {
          return {
            context: {
              seat_handshake: {
                active_decision: "Chris greenlit Orchestrator V1.",
                active_job: "Orchestrator proof",
                recent_proof: "PASS: proof exists.",
                seat_freshness: ["PinballWake: Live"],
                source_pointers: [{ source_id: "todo-1" }],
                next_prompt: "Run UnClick Heartbeat. Use the Seats > Heartbeat policy.",
                raw_wake: "<heartbeat><current_time_iso>2026-05-11T09:00:00Z</current_time_iso></heartbeat>",
              },
            },
          };
        },
      }),
    });
    const noisy = evaluateOrchestratorSeatHandshakeProof(fetched.context);

    assert.equal(noisy.ok, false);
    assert(noisy.missing.includes("noise_free_handoff"));
    assert.match(noisy.proof_line, /^BLOCKER:/);
  });

  it("allows safe heartbeat wording inside seat_handshake next_prompt", () => {
    const proof = evaluateOrchestratorSeatHandshakeProof({
      seat_handshake: {
        mode: "fresh-seat-pickup",
        active_decision: null,
        active_job: null,
        recent_proof: null,
        seat_freshness: ["QueuePush: Live"],
        source_pointers: [{ source_id: "dispatch-1" }],
        next_prompt: "Run UnClick Heartbeat. Use the Seats > Heartbeat policy.",
      },
    });

    assert.equal(proof.ok, true);
    assert.equal(proof.reason, "seat_handshake_ready");
  });

  it("allows compact Orchestrator log summaries that mention heartbeat", () => {
    const proof = evaluateOrchestratorSeatHandshakeProof({
      seat_handshake: {
        mode: "fresh-seat-pickup",
        active_decision: "Continue from latest heartbeat proof.",
        active_job: null,
        recent_proof: "UnClick heartbeat result: PASS, job hunt checked.",
        active_blocker: "Runner has no fresh run after unclick-heartbeat.",
        seat_freshness: ["QueuePush: Live"],
        source_pointers: [{ source_kind: "conversation_turn", source_id: "receipt-1" }],
      },
    });

    assert.equal(proof.ok, true);
    assert.equal(proof.reason, "seat_handshake_ready");
  });

  it("blocks raw heartbeat payload text without blocking compact summaries", () => {
    const proof = evaluateOrchestratorSeatHandshakeProof({
      seat_handshake: {
        mode: "fresh-seat-pickup",
        recent_proof: "UnClick heartbeat result: PASS, compact summary only.",
        raw_turn: "Run UnClick Heartbeat. Use the Seats > Heartbeat policy.",
        seat_freshness: ["QueuePush: Live"],
        source_pointers: [{ source_kind: "conversation_turn", source_id: "receipt-1" }],
      },
    });

    assert.equal(proof.ok, false);
    assert(proof.missing.includes("noise_free_handoff"));
  });

  it("extracts Boardroom todo ids only from imported UnClick jobs", () => {
    const job = createCodingRoomJobFromBoardroomTodo({
      id: "todo-claim-1",
      title: "Auto-flip todo open to in_progress on start_code_task fire",
    });

    assert.equal(extractBoardroomTodoIdFromCodingRoomJob(job), "todo-claim-1");
    assert.equal(extractBoardroomTodoIdFromCodingRoomJob(safeJob()), "");
  });

  it("syncs claimed UnClick todos back to in_progress in claim mode", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autonomous-runner-"));
    const ledgerPath = join(dir, "ledger.json");
    try {
      await writeCodingRoomJobLedger(ledgerPath, createCodingRoomJobLedger());

      const calls = [];
      const fetchImpl = async (url, init = {}) => {
        calls.push({ url, init, body: JSON.parse(init.body) });
        const toolName = calls.at(-1).body.params.name;
        if (toolName === "list_actionable_todos") {
          return {
            ok: true,
            async json() {
              return {
                result: {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify({
                        todos: [
                          {
                            id: "todo-claim-1",
                            title: "Auto-flip todo open to in_progress on start_code_task fire",
                            status: "open",
                            priority: "high",
                            assigned_to_agent_id: null,
                            created_at: "2026-05-08T05:00:00.000Z",
                            scope_pack: {
                              owned_files: ["docs/runner-scope.md"],
                              patch: "diff --git a/docs/runner-scope.md b/docs/runner-scope.md\n--- a/docs/runner-scope.md\n+++ b/docs/runner-scope.md\n@@ -1 +1 @@\n-old\n+new\n",
                              tests: [],
                            },
                          },
                        ],
                      }),
                    },
                  ],
                },
              };
            },
          };
        }

        if (toolName === "update_todo") {
          return {
            ok: true,
            async json() {
              return {
                result: {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify({
                        todo: {
                          id: "todo-claim-1",
                          status: "in_progress",
                          assigned_to_agent_id: "runner-plex-1",
                        },
                      }),
                    },
                  ],
                },
              };
            },
          };
        }

        if (toolName === "comment_on") {
          return {
            ok: true,
            async json() {
              return {
                result: {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify({ comment: { id: "comment-1" } }),
                    },
                  ],
                },
              };
            },
          };
        }

        throw new Error(`unexpected tool ${toolName}`);
      };

      const result = await runAutonomousRunnerFile({
        ledgerPath,
        runner,
        mode: "claim",
        queueSource: "unclick",
        unclickApiKey: "uc_test",
        unclickMcpUrl: "https://unclick.test/api/mcp",
        fetchImpl,
        now: "2026-05-08T05:30:00.000Z",
        wakeSource: "queuepush",
      });

      assert.equal(result.ok, true);
      assert.equal(result.action, "claimed");
      assert.equal(result.persisted, true);
      assert.deepEqual(calls.map((call) => call.body.params.name), [
        "list_actionable_todos",
        "update_todo",
        "comment_on",
      ]);
      assert.equal(calls[0].body.params.arguments.include_description, true);
      assert.deepEqual(calls[1].body.params.arguments, {
        agent_id: "runner-plex-1",
        todo_id: "todo-claim-1",
        status: "in_progress",
        assigned_to_agent_id: "runner-plex-1",
      });
      assert.equal(calls[2].body.params.arguments.target_id, "todo-claim-1");
      assert.match(calls[2].body.params.arguments.text, /dispatch=coding-room-claim:/);
      assert.match(calls[2].body.params.arguments.text, /lease_token=coding-room-claim:/);
      assert.match(calls[2].body.params.arguments.text, /wake_source=queuepush/);
      assert.equal(result.todo_claim_sync.ok, true);
      assert.equal(result.todo_claim_sync.todo_id, "todo-claim-1");

      const persisted = JSON.parse(await readFile(ledgerPath, "utf8"));
      assert.equal(persisted.jobs[0].status, "claimed");
      assert.equal(persisted.jobs[0].claimed_by, "runner-plex-1");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reopens scoped Boardroom todos for file-level scoping when owned files are missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autonomous-runner-"));
    const ledgerPath = join(dir, "ledger.json");
    try {
      await writeCodingRoomJobLedger(ledgerPath, createCodingRoomJobLedger());

      const calls = [];
      const fetchImpl = async (url, init = {}) => {
        calls.push({ url, init, body: JSON.parse(init.body) });
        const toolName = calls.at(-1).body.params.name;
        if (toolName === "list_actionable_todos") {
          return {
            ok: true,
            async json() {
              return {
                result: {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify({
                        todos: [
                          {
                            id: "todo-orchestrator-scope",
                            title: "Orchestrator continuity wiring",
                            status: "open",
                            priority: "urgent",
                            assigned_to_agent_id: null,
                            actionability_reason: "unassigned_open",
                            scope_pack: {
                              lane: "orchestrator",
                              owner_hint: "live_builder_or_orchestrator_seat",
                              owned_surfaces: [
                                "Orchestrator pointer-index hooks",
                                "read_orchestrator_context filtering",
                              ],
                              tests: ["node --test scripts/pinballwake-autonomous-runner.test.mjs"],
                            },
                          },
                        ],
                      }),
                    },
                  ],
                },
              };
            },
          };
        }

        if (toolName === "update_todo") {
          return {
            ok: true,
            async json() {
              return {
                result: {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify({
                        todo: {
                          id: "todo-orchestrator-scope",
                          status: "open",
                          assigned_to_agent_id: null,
                        },
                      }),
                    },
                  ],
                },
              };
            },
          };
        }

        if (toolName === "comment_on") {
          return {
            ok: true,
            async json() {
              return {
                result: {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify({ comment: { id: "comment-scope-1" } }),
                    },
                  ],
                },
              };
            },
          };
        }

        throw new Error(`unexpected tool ${toolName}`);
      };

      const result = await runAutonomousRunnerFile({
        ledgerPath,
        runner,
        mode: "claim",
        queueSource: "unclick",
        unclickApiKey: "uc_test",
        unclickMcpUrl: "https://unclick.test/api/mcp",
        fetchImpl,
        now: "2026-05-12T00:40:00.000Z",
      });

      assert.equal(result.ok, true);
      assert.equal(result.action, "scoping_requested");
      assert.equal(result.reason, "boardroom_todo_reopened_for_scoping");
      assert.equal(result.queue_source.imported, 1);
      assert.equal(result.skipped[0].reason, "boardroom_todo_missing_scopepack");
      assert.equal(result.claimability_scorecard.imported_claimable, 1);
      assert.equal(result.claimability_scorecard.claim_attemptable_after_safety, 0);
      assert.equal(result.claimability_scorecard.scoping_requested, 1);
      assert.equal(result.claimability_scorecard.protected_blocked, 0);
      assert.equal(result.claimability_scorecard.last_action, "scoping_requested");
      assert.equal(result.claimability_scorecard.last_reason, "boardroom_todo_reopened_for_scoping");
      assert.equal(result.claimability_scorecard.final_action, "scoping_requested");
      assert.equal(result.claimability_scorecard.final_reason, "boardroom_todo_reopened_for_scoping");
      assert.equal(result.todo_scoping_sync.todo_id, "todo-orchestrator-scope");
      assert.equal(result.todo_scoping_sync.comment_ok, true);

      const updateCall = calls.find((call) => call.body.params.name === "update_todo");
      assert.equal(updateCall.body.params.arguments.todo_id, "todo-orchestrator-scope");
      assert.equal(updateCall.body.params.arguments.assigned_to_agent_id, "");

      const commentCall = calls.find((call) => call.body.params.name === "comment_on");
      assert.match(commentCall.body.params.arguments.text, /file-level ScopePack/);
      assert.match(commentCall.body.params.arguments.text, /exact owned files/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("quietly skips stale assigned UnClick todo claims before syncing ownership", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autonomous-runner-"));
    const ledgerPath = join(dir, "ledger.json");
    try {
      await writeCodingRoomJobLedger(ledgerPath, createCodingRoomJobLedger());

      const calls = [];
      const fetchImpl = async (_url, init = {}) => {
        calls.push({ body: JSON.parse(init.body) });
        const toolName = calls.at(-1).body.params.name;
        if (toolName === "list_actionable_todos") {
          return {
            ok: true,
            async json() {
              return {
                result: {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify({
                        todos: [
                          {
                            id: "todo-stale-scoped-1",
                            title: "Scoped but stale runner chip",
                            status: "in_progress",
                            priority: "urgent",
                            assigned_to_agent_id: "old-worker",
                            actionability_reason: "stale_in_progress",
                            created_at: "2026-05-08T05:00:00.000Z",
                            updated_at: "2026-05-08T05:05:00.000Z",
                            scope_pack: {
                              owned_files: ["docs/stale-scoped-chip.md"],
                              patch: "diff --git a/docs/stale-scoped-chip.md b/docs/stale-scoped-chip.md\n--- a/docs/stale-scoped-chip.md\n+++ b/docs/stale-scoped-chip.md\n@@ -1 +1 @@\n-old\n+new\n",
                              tests: [],
                            },
                          },
                        ],
                      }),
                    },
                  ],
                },
              };
            },
          };
        }

        throw new Error(`unexpected tool ${toolName}`);
      };

      const result = await runAutonomousRunnerFile({
        ledgerPath,
        runner,
        mode: "claim",
        queueSource: "unclick",
        unclickApiKey: "uc_test",
        unclickMcpUrl: "https://unclick.test/api/mcp",
        fetchImpl,
        now: "2026-05-09T12:35:00.000Z",
      });

      assert.equal(result.ok, true);
      assert.equal(result.action, "idle");
      assert.equal(result.reason, "no_claimable_jobs");
      assert.deepEqual(result.queue_source.claimability_scorecard, {
        seen: 1,
        claimable: 0,
        imported: 0,
        skipped: 1,
        skip_reasons: {
          boardroom_todo_not_open: 1,
        },
        state: "blocked_no_claimable",
        healthy: false,
      });
      assert.equal(result.claimability_scorecard.claimed, 0);
      assert.equal(result.claimability_scorecard.last_action, "idle");
      assert.equal(result.claimability_scorecard.last_reason, "no_claimable_jobs");
      assert.equal(result.queue_source.skipped[0].id, "todo-stale-scoped-1");
      assert.equal(result.queue_source.skipped[0].reason, "boardroom_todo_not_open");
      assert.deepEqual(calls.map((call) => call.body.params.name), ["list_actionable_todos"]);

      const persisted = JSON.parse(await readFile(ledgerPath, "utf8"));
      assert.equal(persisted.jobs.length, 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("blocks stale UnClick todo lease tokens before syncing ownership", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autonomous-runner-"));
    const ledgerPath = join(dir, "ledger.json");
    try {
      await writeCodingRoomJobLedger(ledgerPath, createCodingRoomJobLedger());

      const calls = [];
      const fetchImpl = async (_url, init = {}) => {
        calls.push({ body: JSON.parse(init.body) });
        const toolName = calls.at(-1).body.params.name;
        if (toolName === "list_actionable_todos") {
          return {
            ok: true,
            async json() {
              return {
                result: {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify({
                        todos: [
                          {
                            id: "todo-stale-lease-1",
                            title: "Scoped stale lease runner chip",
                            status: "open",
                            priority: "urgent",
                            assigned_to_agent_id: null,
                            lease_token: "other-active-lease",
                            lease_expires_at: "2026-05-09T12:40:00.000Z",
                            reclaim_count: 1,
                            actionability_reason: "unassigned_open",
                            created_at: "2026-05-08T05:00:00.000Z",
                            updated_at: "2026-05-08T05:05:00.000Z",
                            scope_pack: {
                              owned_files: ["docs/stale-lease-chip.md"],
                              patch: "diff --git a/docs/stale-lease-chip.md b/docs/stale-lease-chip.md\n--- a/docs/stale-lease-chip.md\n+++ b/docs/stale-lease-chip.md\n@@ -1 +1 @@\n-old\n+new\n",
                              tests: [],
                            },
                          },
                        ],
                      }),
                    },
                  ],
                },
              };
            },
          };
        }

        throw new Error(`unexpected tool ${toolName}`);
      };

      const result = await runAutonomousRunnerFile({
        ledgerPath,
        runner,
        mode: "claim",
        queueSource: "unclick",
        unclickApiKey: "uc_test",
        unclickMcpUrl: "https://unclick.test/api/mcp",
        fetchImpl,
        now: "2026-05-09T12:35:00.000Z",
      });

      assert.equal(result.ok, false);
      assert.equal(result.action, "blocked");
      assert.equal(result.reason, "todo_claim_sync_failed");
      assert.equal(result.todo_claim_sync.reason, "claim_source_state_mismatch");
      assert.equal(result.todo_claim_sync.detail, "boardroom_todo_lease_token_mismatch");
      assert.deepEqual(calls.map((call) => call.body.params.name), ["list_actionable_todos"]);

      const persisted = JSON.parse(await readFile(ledgerPath, "utf8"));
      assert.equal(persisted.jobs.length, 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reopens stale unscoped UnClick todos for scoping instead of idling forever", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autonomous-runner-"));
    const ledgerPath = join(dir, "ledger.json");
    try {
      await writeCodingRoomJobLedger(ledgerPath, createCodingRoomJobLedger());

      const calls = [];
      const fetchImpl = async (url, init = {}) => {
        calls.push({ url, init, body: JSON.parse(init.body) });
        const toolName = calls.at(-1).body.params.name;
        if (toolName === "list_actionable_todos") {
          return {
            ok: true,
            async json() {
              return {
                result: {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify({
                        todos: [
                          {
                            id: "todo-stale-1",
                            title: "Stale vague build job",
                            status: "in_progress",
                            priority: "urgent",
                            assigned_to_agent_id: "old-worker",
                            actionability_reason: "stale_in_progress",
                            created_at: "2026-05-08T05:00:00.000Z",
                          },
                        ],
                      }),
                    },
                  ],
                },
              };
            },
          };
        }

        if (toolName === "update_todo") {
          return {
            ok: true,
            async json() {
              return {
                result: {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify({
                        todo: {
                          id: "todo-stale-1",
                          status: "open",
                          assigned_to_agent_id: null,
                        },
                      }),
                    },
                  ],
                },
              };
            },
          };
        }

        if (toolName === "comment_on") {
          return {
            ok: true,
            async json() {
              return {
                result: {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify({ comment: { id: "comment-scope-1" } }),
                    },
                  ],
                },
              };
            },
          };
        }

        throw new Error(`unexpected tool ${toolName}`);
      };

      const result = await runAutonomousRunnerFile({
        ledgerPath,
        runner,
        mode: "claim",
        queueSource: "unclick",
        unclickApiKey: "uc_test",
        unclickMcpUrl: "https://unclick.test/api/mcp",
        fetchImpl,
        now: "2026-05-08T05:30:00.000Z",
      });

      assert.equal(result.ok, true);
      assert.equal(result.action, "scoping_requested");
      assert.equal(result.reason, "boardroom_todo_reopened_for_scoping");
      assert.deepEqual(calls.map((call) => call.body.params.name), [
        "list_actionable_todos",
        "update_todo",
        "comment_on",
      ]);
      assert.deepEqual(calls[1].body.params.arguments, {
        agent_id: "runner-plex-1",
        todo_id: "todo-stale-1",
        status: "open",
        assigned_to_agent_id: "",
      });
      assert.match(calls[2].body.params.arguments.text, /Reopened for scoping/);
      assert.equal(result.todo_scoping_sync.ok, true);
      assert.equal(result.todo_scoping_sync.todo_id, "todo-stale-1");

      const persisted = JSON.parse(await readFile(ledgerPath, "utf8"));
      assert.equal(persisted.jobs[0].status, "queued");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("blocks and avoids persisting when UnClick todo claim sync fails", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autonomous-runner-"));
    const ledgerPath = join(dir, "ledger.json");
    try {
      await writeCodingRoomJobLedger(ledgerPath, createCodingRoomJobLedger());

      const fetchImpl = async (_url, init = {}) => {
        const body = JSON.parse(init.body);
        if (body.params.name === "list_actionable_todos") {
          return {
            ok: true,
            async json() {
              return {
                result: {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify({
                        todos: [
                          {
                            id: "todo-claim-2",
                            title: "Safe docs chip",
                            status: "open",
                            priority: "high",
                            assigned_to_agent_id: null,
                            scope_pack: {
                              owned_files: ["docs/safe-chip.md"],
                              patch: "diff --git a/docs/safe-chip.md b/docs/safe-chip.md\n--- a/docs/safe-chip.md\n+++ b/docs/safe-chip.md\n@@ -1 +1 @@\n-old\n+new\n",
                            },
                          },
                        ],
                      }),
                    },
                  ],
                },
              };
            },
          };
        }

        return {
          ok: false,
          status: 503,
          async json() {
            return {};
          },
        };
      };

      const result = await runAutonomousRunnerFile({
        ledgerPath,
        runner,
        mode: "claim",
        queueSource: "unclick",
        unclickApiKey: "uc_test",
        unclickMcpUrl: "https://unclick.test/api/mcp",
        fetchImpl,
        now: "2026-05-08T05:30:00.000Z",
      });

      assert.equal(result.ok, false);
      assert.equal(result.action, "blocked");
      assert.equal(result.reason, "todo_claim_sync_failed");
      assert.equal(result.persisted, false);
      assert.equal(result.todo_claim_sync.reason, "update_todo_failed");

      const persisted = JSON.parse(await readFile(ledgerPath, "utf8"));
      assert.equal(persisted.jobs.length, 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("marks sensitive Boardroom todos unsafe before autonomous claim", () => {
    const job = createCodingRoomJobFromBoardroomTodo({
      id: "security-1",
      title: "SECURITY: deactivate legacy plaintext api_keys_legacy rows after owner auth",
      priority: "high",
      status: "open",
    });

    const safety = inspectAutonomousRunnerJobSafety(job);
    assert.equal(safety.ok, false);
    assert.match(safety.reason, /^protected_surface_(auth|secret)$/);
  });

  it("persists claim mode to disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autonomous-runner-"));
    const ledgerPath = join(dir, "ledger.json");
    try {
      await writeCodingRoomJobLedger(ledgerPath, createCodingRoomJobLedger({ jobs: [safeJob()] }));

      const result = await runAutonomousRunnerFile({
        ledgerPath,
        runner,
        mode: "claim",
        now: "2026-05-06T03:00:00.000Z",
      });

      assert.equal(result.ok, true);
      assert.equal(result.persisted, true);

      const persisted = JSON.parse(await readFile(ledgerPath, "utf8"));
      assert.equal(persisted.jobs[0].status, "claimed");
      assert.equal(persisted.jobs[0].claimed_by, "runner-plex-1");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("blocks protected surfaces before claim", () => {
    const unsafe = safeJob({
      jobId: "coding-room:autonomous-runner:unsafe",
      chip: "rotate billing secret",
      files: ["api/billing/stripe.ts"],
    });

    assert.equal(inspectAutonomousRunnerJobSafety(unsafe).ok, false);

    const result = runAutonomousRunnerCycle({
      ledger: createCodingRoomJobLedger({ jobs: [unsafe] }),
      runner,
      mode: "claim",
      now: "2026-05-06T03:00:00.000Z",
    });

    assert.equal(result.ok, true);
    assert.equal(result.action, "idle");
    assert.equal(result.safety_blocked.length, 1);
    assert.equal(result.ledger.jobs[0].status, "blocked");
    assert.match(result.ledger.jobs[0].proof.blocker, /protected work/);
  });

  it("supports a hard kill switch", () => {
    const result = runAutonomousRunnerCycle({
      ledger: createCodingRoomJobLedger({ jobs: [safeJob()] }),
      runner,
      mode: "claim",
      policy: { disabled: true },
      now: "2026-05-06T03:00:00.000Z",
    });

    assert.equal(result.ok, true);
    assert.equal(result.action, "disabled");
    assert.equal(result.reason, "kill_switch_enabled");
    assert.equal(result.ledger.jobs[0].status, "queued");
  });

  it("does not enter execute mode unless explicitly enabled", () => {
    const result = runAutonomousRunnerCycle({
      ledger: createCodingRoomJobLedger({ jobs: [safeJob()] }),
      runner,
      mode: "execute",
      now: "2026-05-06T03:00:00.000Z",
    });

    assert.equal(result.ok, true);
    assert.equal(result.action, "blocked");
    assert.equal(result.reason, "execute_mode_disabled");
    assert.equal(result.ledger.jobs[0].status, "queued");
  });

  it("does not persist blocked execute-mode invocations", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autonomous-runner-"));
    const ledgerPath = join(dir, "ledger.json");
    try {
      await writeCodingRoomJobLedger(ledgerPath, createCodingRoomJobLedger({ jobs: [safeJob()] }));

      const result = await runAutonomousRunnerFile({
        ledgerPath,
        runner,
        mode: "execute",
        now: "2026-05-06T03:00:00.000Z",
      });

      assert.equal(result.ok, true);
      assert.equal(result.action, "blocked");
      assert.equal(result.reason, "execute_mode_disabled");
      assert.equal(result.persisted, false);

      const persisted = JSON.parse(await readFile(ledgerPath, "utf8"));
      assert.equal(persisted.jobs[0].status, "queued");
      assert.equal(persisted.jobs[0].claimed_by, null);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("can block unsafe queued jobs without protected-surface exemptions", () => {
    const result = markUnsafeJobsBlockedForAutonomousRunner({
      ledger: createCodingRoomJobLedger({
        jobs: [
          safeJob({
            jobId: "coding-room:autonomous-runner:migration",
            chip: "alter table for auth sessions",
            files: ["supabase/migrations/001.sql"],
          }),
        ],
      }),
      now: "2026-05-06T03:00:00.000Z",
    });

    assert.equal(result.ok, true);
    assert.equal(result.blocked.length, 1);
    assert.equal(result.ledger.jobs[0].status, "blocked");
  });

  it("wires the scheduled workflow to claim by default with execute locked off", async () => {
    const workflow = await readFile(".github/workflows/autonomous-runner.yml", "utf8");

    assert.match(workflow, /cron:\s*"3,13,23,33,43,53 \* \* \* \*"/);
    assert.match(workflow, /workflow_run:/);
    assert.match(workflow, /Fleet Throughput Watch/);
    assert.match(workflow, /Prove Orchestrator seat handoff/);
    assert.match(workflow, /github\.event_name == 'schedule' \|\| \(github\.event_name == 'workflow_run' && github\.event\.workflow_run\.event == 'schedule'\)/);
    assert.doesNotMatch(workflow, /if:\s*github\.event_name == 'workflow_run'\s*$/m);
    assert.match(workflow, /AUTONOMOUS_RUNNER_ORCHESTRATOR_PROOF:\s*"true"/);
    assert.match(workflow, /AUTONOMOUS_RUNNER_ORCHESTRATOR_PROOF_SOURCE:.*workflow_run_schedule.*github_schedule/);
    assert.match(workflow, /node scripts\/pinballwake-autonomous-runner\.mjs/);
    assert.match(workflow, /AUTONOMOUS_RUNNER_QUEUE_SOURCE:.*'unclick'/);
    assert.match(workflow, /AUTONOMOUS_RUNNER_WAKE_SOURCE:.*queuepush/);
    assert.match(workflow, /UNCLICK_API_KEY:.*secrets\.UNCLICK_API_KEY.*secrets\.FISHBOWL_AUTOCLOSE_TOKEN.*secrets\.FISHBOWL_WAKE_TOKEN/);
    assert.match(workflow, /AUTONOMOUS_RUNNER_MODE:.*'claim'/);
    assert.match(workflow, /AUTONOMOUS_RUNNER_ALLOW_EXECUTE:\s*"false"/);
    assert.match(workflow, /AUTONOMOUS_RUNNER_ALLOW_PROTECTED_SURFACES:\s*"false"/);
    assert.match(workflow, /AUTONOMOUS_RUNNER_ALLOWED_PRIORITIES:.*urgent,high/);
    assert.match(workflow, /AUTONOMOUS_RUNNER_ALLOWED_ACTION_REASONS:.*unassigned_open/);
    assert.match(workflow, /kill_switch:/);
    assert.doesNotMatch(workflow, /^\s+- execute$/m);
  });
});
