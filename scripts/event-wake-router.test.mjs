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

  it("runs the wake path in dry-run mode without crashing", () => {
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
      assert.match(result.stdout, /reliability_dispatch_dry_run/);
      assert.doesNotMatch(result.stderr, /ReferenceError/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
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
    assert.match(result.stdout, /"wake_urgency": "high"/);
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
});
