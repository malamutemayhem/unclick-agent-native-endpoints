import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildReliabilityDispatchRequest,
  wakeDispatchId,
} from "./event-wake-router.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(scriptDir, "event-wake-router.mjs");
const repoRoot = dirname(scriptDir);

describe("event wake router reliability dispatch", () => {
  function runDryWake(eventName, event) {
    const tempDir = mkdtempSync(join(tmpdir(), "wake-router-"));
    const eventPath = join(tempDir, "event.json");
    const ledgerDir = join(tempDir, "ledger");
    writeFileSync(eventPath, JSON.stringify(event));

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        GITHUB_EVENT_NAME: eventName,
        GITHUB_EVENT_PATH: eventPath,
        WAKE_LEDGER_DIR: ledgerDir,
        WAKE_ROUTER_DRY_RUN: "true",
      },
      encoding: "utf8",
    });

    rmSync(tempDir, { recursive: true, force: true });
    return result;
  }

  it("creates stable dispatch IDs from wake event IDs", () => {
    const first = wakeDispatchId("wake-workflow_run-workflow-run-123-abc");
    const second = wakeDispatchId("wake-workflow_run-workflow-run-123-abc");

    assert.equal(first, second);
    assert.match(first, /^dispatch_[a-f0-9]{32}$/);
  });

  it("marks wake handoffs as ACK-required WakePass dispatches", () => {
    const request = buildReliabilityDispatchRequest({
      eventId: "wake-workflow_run-workflow-run-123-abc",
      decision: {
        owner: "🤖",
        reason: "PR checks completed green for TestPass PR Check on PR #310",
        urgency: "high",
      },
      triage: { used: false },
      result: { message_id: "msg-123" },
      event: {
        action: "completed",
        workflow_run: {
          id: 123,
          html_url: "https://github.com/acme/repo/actions/runs/123",
        },
      },
      ackSeconds: 600,
    });

    assert.equal(request.source, "wakepass");
    assert.equal(request.target_agent_id, "🤖");
    assert.equal(request.task_ref, "wake-workflow_run-workflow-run-123-abc");
    assert.equal(request.payload.ack_required, true);
    assert.equal(request.payload.handoff_message_id, "msg-123");
    assert.equal(request.payload.route_attempted, "fishbowl");
    assert.equal(request.payload.ack_fail_after_seconds, 600);
    assert.equal(request.payload.wake_owner, "🤖");
    assert.equal(request.payload.github_subject, "workflow-run-123");
  });

  it("defaults missed-ACK handoff leases to ten minutes", () => {
    const request = buildReliabilityDispatchRequest({
      eventId: "wake-workflow_run-workflow-run-456-def",
      decision: {
        owner: "🤖",
        reason: "PR checks completed green",
        urgency: "high",
      },
      triage: { used: false },
      result: { message_id: "msg-456" },
      event: { workflow_run: { id: 456 } },
    });

    assert.equal(request.time_bucket_seconds, 600);
    assert.equal(request.payload.ack_fail_after_seconds, 600);
  });

  it("can register PinballWake proof before the Fishbowl route returns", () => {
    const request = buildReliabilityDispatchRequest({
      eventId: "wake-workflow_run-workflow-run-789-ghi",
      decision: {
        owner: "🤖",
        reason: "PR checks completed green",
        urgency: "high",
      },
      triage: { used: false },
      result: null,
      event: { workflow_run: { id: 789 } },
    });

    assert.equal(request.source, "wakepass");
    assert.equal(request.payload.ack_required, true);
    assert.equal(request.payload.route_attempted, "fishbowl");
    assert.equal(request.payload.handoff_message_id, null);
  });

  it("keeps successful PR workflow green echoes silent", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "wake-router-"));
    const eventPath = join(tempDir, "event.json");
    const ledgerDir = join(tempDir, "ledger");
    writeFileSync(
      eventPath,
      JSON.stringify({
        action: "completed",
        workflow_run: {
          id: 123,
          name: "TestPass PR Check",
          status: "completed",
          conclusion: "success",
          html_url: "https://github.com/acme/repo/actions/runs/123",
          created_at: "2026-04-30T14:00:00Z",
          updated_at: "2026-04-30T14:05:00Z",
          pull_requests: [{ number: 316 }],
        },
      }),
    );

    try {
      const result = spawnSync(process.execPath, [scriptPath], {
        cwd: repoRoot,
        env: {
          ...process.env,
          GITHUB_EVENT_NAME: "workflow_run",
          GITHUB_EVENT_PATH: eventPath,
          WAKE_LEDGER_DIR: ledgerDir,
          WAKE_ROUTER_DRY_RUN: "true",
        },
        encoding: "utf8",
      });

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /PR checks completed green for TestPass PR Check on PR #316; no action needed/);
      assert.match(result.stdout, /No wake needed/);
      assert.doesNotMatch(result.stdout, /reliability_dispatch_dry_run/);
      assert.doesNotMatch(result.stdout, /"ack_required": true/);
      assert.doesNotMatch(result.stdout, /"wake_owner": "🍿"/);
      assert.doesNotMatch(result.stdout, /ACK requested: reply ACK/);
      assert.doesNotMatch(result.stderr, /ReferenceError/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("wakes urgently when scheduled TestPass smoke fails", () => {
    const result = runDryWake("workflow_run", {
      action: "completed",
      workflow_run: {
        id: 456,
        name: "TestPass Scheduled Smoke",
        status: "completed",
        conclusion: "failure",
        html_url: "https://github.com/acme/repo/actions/runs/456",
        created_at: "2026-04-30T15:00:00Z",
        updated_at: "2026-04-30T15:04:00Z",
        pull_requests: [],
      },
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Scheduled TestPass smoke failure/);
    assert.match(result.stdout, /"wake_urgency": "urgent"/);
    assert.match(result.stdout, /reliability_dispatch_dry_run/);
    assert.match(result.stdout, /"ack_required": true/);
  });

  it("keeps successful scheduled TestPass smoke runs silent", () => {
    const result = runDryWake("workflow_run", {
      action: "completed",
      workflow_run: {
        id: 457,
        name: "TestPass Scheduled Smoke",
        status: "completed",
        conclusion: "success",
        html_url: "https://github.com/acme/repo/actions/runs/457",
        created_at: "2026-04-30T15:00:00Z",
        updated_at: "2026-04-30T15:04:00Z",
        pull_requests: [],
      },
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /No wake needed/);
    assert.doesNotMatch(result.stdout, /reliability_dispatch_dry_run/);
  });

  it("wakes the builder when the Dogfood Report workflow fails", () => {
    const result = runDryWake("workflow_run", {
      action: "completed",
      workflow_run: {
        id: 458,
        name: "Dogfood Report",
        status: "completed",
        conclusion: "failure",
        html_url: "https://github.com/acme/repo/actions/runs/458",
        created_at: "2026-04-30T16:00:00Z",
        updated_at: "2026-04-30T16:05:00Z",
        pull_requests: [],
      },
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Dogfood Report workflow failure/);
    assert.match(result.stdout, /"wake_owner": "🦾"/);
    assert.match(result.stdout, /"wake_urgency": "urgent"/);
    assert.match(result.stdout, /reliability_dispatch_dry_run/);
    assert.match(result.stdout, /"ack_required": true/);
  });

  it("keeps successful Dogfood Report workflow runs silent", () => {
    const result = runDryWake("workflow_run", {
      action: "completed",
      workflow_run: {
        id: 459,
        name: "Dogfood Report",
        status: "completed",
        conclusion: "success",
        html_url: "https://github.com/acme/repo/actions/runs/459",
        created_at: "2026-04-30T16:00:00Z",
        updated_at: "2026-04-30T16:05:00Z",
        pull_requests: [],
      },
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /No wake needed/);
    assert.doesNotMatch(result.stdout, /reliability_dispatch_dry_run/);
  });

  it("dogfoods issue comments with /wake into ACK-required dispatches", () => {
    const result = runDryWake("issue_comment", {
      action: "created",
      issue: {
        number: 170,
        title: "Surface Drafts queue UI in Fishbowl admin",
        html_url: "https://github.com/acme/repo/issues/170",
      },
      comment: {
        id: 987,
        body: "/wake please check this blocker",
        created_at: "2026-04-30T15:00:00Z",
      },
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Manual wake command on issue\/PR #170/);
    assert.match(result.stdout, /reliability_dispatch_dry_run/);
    assert.match(result.stdout, /"ack_required": true/);
  });

  it("dogfoods assigned issues into normal-priority worker wakeups", () => {
    const result = runDryWake("issues", {
      action: "assigned",
      issue: {
        number: 132,
        title: "feat: TestPass MCP tools + Orchestrator Wizard Phase 2",
        html_url: "https://github.com/acme/repo/issues/132",
        updated_at: "2026-04-30T15:00:00Z",
      },
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Issue #132 was assigned/);
    assert.match(result.stdout, /"wake_urgency": "normal"/);
  });

  it("dogfoods labeled issues into normal-priority worker wakeups", () => {
    const result = runDryWake("issues", {
      action: "labeled",
      issue: {
        number: 143,
        title: "Dependabot triage",
        html_url: "https://github.com/acme/repo/issues/143",
        updated_at: "2026-04-30T15:00:00Z",
      },
      label: { name: "dependencies" },
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Issue #143 was labeled/);
    assert.match(result.stdout, /"wake_urgency": "normal"/);
  });

  it("dogfoods ready PRs into high-priority worker wakeups", () => {
    const result = runDryWake("pull_request", {
      action: "ready_for_review",
      number: 330,
      pull_request: {
        number: 330,
        title: "Harden reliability heartbeat list filter parsing",
        draft: false,
        state: "open",
        html_url: "https://github.com/acme/repo/pull/330",
        updated_at: "2026-04-30T15:00:00Z",
      },
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /PR #330 is ready for review/);
    assert.match(result.stdout, /"wake_owner": "🍿"/);
    assert.match(result.stdout, /"wake_urgency": "high"/);
    assert.match(result.stdout, /reliability_dispatch_dry_run/);
    assert.match(result.stdout, /"ack_required": true/);
    assert.match(result.stdout, /ACK requested: reply ACK/);
  });

  it("keeps ordinary PR updates silent", () => {
    const result = runDryWake("pull_request", {
      action: "synchronize",
      number: 331,
      pull_request: {
        number: 331,
        title: "Refresh implementation branch",
        draft: false,
        state: "open",
        html_url: "https://github.com/acme/repo/pull/331",
        updated_at: "2026-04-30T15:10:00Z",
      },
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /No wake needed/);
    assert.doesNotMatch(result.stdout, /reliability_dispatch_dry_run/);
  });

  it("keeps non-wake issue comments silent", () => {
    const result = runDryWake("issue_comment", {
      action: "created",
      issue: {
        number: 170,
        title: "Surface Drafts queue UI in Fishbowl admin",
        html_url: "https://github.com/acme/repo/issues/170",
      },
      comment: {
        id: 988,
        body: "Thanks, looks good.",
        created_at: "2026-04-30T15:00:00Z",
      },
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /No wake needed/);
    assert.doesNotMatch(result.stdout, /reliability_dispatch_dry_run/);
  });

  it("fails closed when wake is required but wake token is missing", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "wake-router-"));
    const eventPath = join(tempDir, "event.json");
    const ledgerDir = join(tempDir, "ledger");
    writeFileSync(
      eventPath,
      JSON.stringify({
        action: "completed",
        workflow_run: {
          id: 460,
          name: "TestPass Scheduled Smoke",
          status: "completed",
          conclusion: "failure",
          html_url: "https://github.com/acme/repo/actions/runs/460",
          created_at: "2026-04-30T17:00:00Z",
          updated_at: "2026-04-30T17:05:00Z",
          pull_requests: [],
        },
      }),
    );

    try {
      const env = { ...process.env };
      delete env.FISHBOWL_WAKE_TOKEN;
      delete env.FISHBOWL_AUTOCLOSE_TOKEN;

      const result = spawnSync(process.execPath, [scriptPath], {
        cwd: repoRoot,
        env: {
          ...env,
          GITHUB_EVENT_NAME: "workflow_run",
          GITHUB_EVENT_PATH: eventPath,
          WAKE_LEDGER_DIR: ledgerDir,
          WAKE_ROUTER_DRY_RUN: "false",
        },
        encoding: "utf8",
      });

      assert.equal(result.status, 1, result.stderr || result.stdout);
      assert.match(result.stderr, /required for reliability dispatch|required for wake posting/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("falls back to default ACK fail seconds when env value is malformed", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "wake-router-"));
    const eventPath = join(tempDir, "event.json");
    const ledgerDir = join(tempDir, "ledger");
    writeFileSync(
      eventPath,
      JSON.stringify({
        action: "completed",
        workflow_run: {
          id: 461,
          name: "TestPass Scheduled Smoke",
          status: "completed",
          conclusion: "failure",
          html_url: "https://github.com/acme/repo/actions/runs/461",
          created_at: "2026-04-30T17:10:00Z",
          updated_at: "2026-04-30T17:15:00Z",
          pull_requests: [],
        },
      }),
    );

    try {
      const result = spawnSync(process.execPath, [scriptPath], {
        cwd: repoRoot,
        env: {
          ...process.env,
          GITHUB_EVENT_NAME: "workflow_run",
          GITHUB_EVENT_PATH: eventPath,
          WAKE_LEDGER_DIR: ledgerDir,
          WAKE_ROUTER_DRY_RUN: "true",
          WAKE_ACK_FAIL_SECONDS: "600s",
        },
        encoding: "utf8",
      });

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /"ack_fail_after_seconds": 600/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("caps ACK fail seconds to the 10-minute WakePass contract", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "wake-router-"));
    const eventPath = join(tempDir, "event.json");
    const ledgerDir = join(tempDir, "ledger");
    writeFileSync(
      eventPath,
      JSON.stringify({
        action: "completed",
        workflow_run: {
          id: 462,
          name: "TestPass Scheduled Smoke",
          status: "completed",
          conclusion: "failure",
          html_url: "https://github.com/acme/repo/actions/runs/462",
          created_at: "2026-04-30T17:20:00Z",
          updated_at: "2026-04-30T17:25:00Z",
          pull_requests: [],
        },
      }),
    );

    try {
      const result = spawnSync(process.execPath, [scriptPath], {
        cwd: repoRoot,
        env: {
          ...process.env,
          GITHUB_EVENT_NAME: "workflow_run",
          GITHUB_EVENT_PATH: eventPath,
          WAKE_LEDGER_DIR: ledgerDir,
          WAKE_ROUTER_DRY_RUN: "true",
          WAKE_ACK_FAIL_SECONDS: "999999",
        },
        encoding: "utf8",
      });

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /"ack_fail_after_seconds": 600/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
