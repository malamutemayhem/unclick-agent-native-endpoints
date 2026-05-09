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
      assert.equal(result.todo_claim_sync.ok, true);
      assert.equal(result.todo_claim_sync.todo_id, "todo-claim-1");

      const persisted = JSON.parse(await readFile(ledgerPath, "utf8"));
      assert.equal(persisted.jobs[0].status, "claimed");
      assert.equal(persisted.jobs[0].claimed_by, "runner-plex-1");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("blocks stale assigned UnClick todo claims before syncing ownership", async () => {
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

      assert.equal(result.ok, false);
      assert.equal(result.action, "blocked");
      assert.equal(result.reason, "todo_claim_sync_failed");
      assert.equal(result.todo_claim_sync.reason, "claim_source_state_mismatch");
      assert.equal(result.todo_claim_sync.detail, "boardroom_todo_not_open");
      assert.equal(result.todo_claim_sync.source_status, "in_progress");
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
    assert.match(workflow, /node scripts\/pinballwake-autonomous-runner\.mjs/);
    assert.match(workflow, /AUTONOMOUS_RUNNER_QUEUE_SOURCE:.*'unclick'/);
    assert.match(workflow, /UNCLICK_API_KEY:.*secrets\.UNCLICK_API_KEY.*secrets\.FISHBOWL_AUTOCLOSE_TOKEN.*secrets\.FISHBOWL_WAKE_TOKEN/);
    assert.match(workflow, /AUTONOMOUS_RUNNER_MODE:.*'claim'/);
    assert.match(workflow, /AUTONOMOUS_RUNNER_ALLOW_EXECUTE:\s*"false"/);
    assert.match(workflow, /AUTONOMOUS_RUNNER_ALLOW_PROTECTED_SURFACES:\s*"false"/);
    assert.match(workflow, /kill_switch:/);
    assert.doesNotMatch(workflow, /^\s+- execute$/m);
  });
});
