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
  extractBoardroomTodoIdFromCodingRoomJob,
  fetchUnClickActionableTodos,
  inspectAutonomousRunnerJobSafety,
  markUnsafeJobsBlockedForAutonomousRunner,
  normalizeAutonomousRunnerMode,
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
      assert.equal(result.action, "claimed");
      assert.equal(result.persisted, false);
      assert.equal(result.queue_source.source, "unclick");
      assert.equal(result.queue_source.seen, 1);
      assert.equal(result.queue_source.imported, 1);
      assert.equal(result.job.job_id, "boardroom-todo:b744462e-8e50-4cad-babb-5468adc2a3d9");
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, "https://unclick.test/api/mcp");
      assert.equal(calls[0].init.headers.authorization, "Bearer uc_test");
      assert.match(calls[0].init.body, /list_actionable_todos/);
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
      });

      assert.equal(result.ok, true);
      assert.equal(result.action, "claimed");
      assert.equal(result.persisted, true);
      assert.deepEqual(calls.map((call) => call.body.params.name), [
        "list_actionable_todos",
        "update_todo",
        "comment_on",
      ]);
      assert.deepEqual(calls[1].body.params.arguments, {
        agent_id: "runner-plex-1",
        todo_id: "todo-claim-1",
        status: "in_progress",
        assigned_to_agent_id: "runner-plex-1",
      });
      assert.equal(calls[2].body.params.arguments.target_id, "todo-claim-1");
      assert.match(calls[2].body.params.arguments.text, /dispatch=coding-room-claim:/);
      assert.equal(result.todo_claim_sync.ok, true);
      assert.equal(result.todo_claim_sync.todo_id, "todo-claim-1");

      const persisted = JSON.parse(await readFile(ledgerPath, "utf8"));
      assert.equal(persisted.jobs[0].status, "claimed");
      assert.equal(persisted.jobs[0].claimed_by, "runner-plex-1");
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

  it("wires the scheduled workflow to dry-run by default with execute locked off", async () => {
    const workflow = await readFile(".github/workflows/autonomous-runner.yml", "utf8");

    assert.match(workflow, /cron:\s*"3,13,23,33,43,53 \* \* \* \*"/);
    assert.match(workflow, /node scripts\/pinballwake-autonomous-runner\.mjs/);
    assert.match(workflow, /AUTONOMOUS_RUNNER_QUEUE_SOURCE:.*'unclick'/);
    assert.match(workflow, /UNCLICK_API_KEY:\s*\$\{\{ secrets\.UNCLICK_API_KEY \}\}/);
    assert.match(workflow, /AUTONOMOUS_RUNNER_MODE:.*'dry-run'/);
    assert.match(workflow, /AUTONOMOUS_RUNNER_ALLOW_EXECUTE:\s*"false"/);
    assert.match(workflow, /AUTONOMOUS_RUNNER_ALLOW_PROTECTED_SURFACES:\s*"false"/);
    assert.match(workflow, /kill_switch:/);
    assert.doesNotMatch(workflow, /^\s+- execute$/m);
  });
});
