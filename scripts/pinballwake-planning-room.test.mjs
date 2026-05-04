import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { chooseAutopilotRoute, validateScopePack } from "./pinballwake-autopilot-triage.mjs";
import { createPlanningRoomScopePack } from "./pinballwake-planning-room.mjs";

function planningJob(input = {}) {
  return {
    id: "planning-room:test",
    source: "stuck-pr",
    title: "Fix stale ACK blocker",
    context: "Existing PR is stuck and needs a tiny implementation plan from current proof.",
    files: ["scripts/pinballwake-runner-loop.mjs", "scripts/pinballwake-runner-loop.test.mjs"],
    tests: ["node --test scripts/pinballwake-runner-loop.test.mjs"],
    estimated_lines: 140,
    shared_surface: true,
    ...input,
  };
}

describe("PinballWake Planning Room", () => {
  it("creates a validated ScopePack for planning-only stuck PR work", () => {
    const result = createPlanningRoomScopePack(planningJob(), { now: "20260505" });

    assert.equal(result.ok, true);
    assert.equal(result.action, "plan");
    assert.equal(result.route.route, "planning-only");
    assert.equal(result.scopepack.scopepack_id, "scopepack:planning-room:test:20260505");
    assert.deepEqual(result.scopepack.owned_files, [
      "scripts/pinballwake-runner-loop.mjs",
      "scripts/pinballwake-runner-loop.test.mjs",
    ]);
    assert.equal(validateScopePack(result.scopepack).ok, true);
  });

  it("skips direct-to-coding work because InlineScope already handles it", () => {
    const result = createPlanningRoomScopePack({
      id: "tiny",
      title: "Tiny copy update",
      files: ["docs/copy.md"],
      tests: ["node --test scripts/pinballwake-autopilot-triage.test.mjs"],
      estimated_lines: 8,
    });

    assert.equal(result.ok, false);
    assert.equal(result.action, "skip");
    assert.equal(result.reason, "direct_to_coding_uses_inline_scopepack");
  });

  it("refuses standard research routes until a research artifact exists", () => {
    const result = createPlanningRoomScopePack(
      planningJob({
        source: "new-connector",
        third_party: true,
        shared_surface: true,
        estimated_lines: 180,
      }),
    );

    assert.equal(result.ok, false);
    assert.equal(result.reason, "research_required_before_planning");
  });

  it("refuses DeepDive routes until a research artifact exists", () => {
    const result = createPlanningRoomScopePack(
      planningJob({
        title: "Credentials redaction fix",
        context: "Touches credentials, tokens, secrets, and redaction.",
        files: ["docs/copy.md"],
        estimated_lines: 20,
      }),
    );

    assert.equal(result.ok, false);
    assert.equal(result.reason, "deep_research_required_before_planning");
  });

  it("creates a ScopePack after DeepDive evidence is present", () => {
    const result = createPlanningRoomScopePack(
      planningJob({
        title: "Credentials redaction docs guard",
        context: "Touches credentials and redaction.",
        files: ["docs/redaction-guidance.md"],
        tests: ["node --test scripts/pinballwake-autopilot-triage.test.mjs"],
        research_report: {
          summary: "Keep docs-only scope and avoid raw key examples.",
          recommendation: "Use existing redaction wording pattern.",
          ack_complete: true,
        },
      }),
      { now: "20260505" },
    );

    assert.equal(result.ok, true);
    assert.equal(result.route.route, "deep-research-then-planning");
    assert.equal(result.route.ack_required, true);
    assert.match(result.scopepack.research_summary, /docs-only scope/);
    assert.ok(result.scopepack.risk_controls.some((control) => control.includes("ACK")));
  });

  it("requires ACK-complete evidence before DeepDive can become a ScopePack", () => {
    const result = createPlanningRoomScopePack(
      planningJob({
        title: "Credentials redaction docs guard",
        context: "Touches credentials and redaction.",
        files: ["docs/redaction-guidance.md"],
        tests: ["node --test scripts/pinballwake-autopilot-triage.test.mjs"],
        research_report: {
          summary: "Keep docs-only scope and avoid raw key examples.",
          recommendation: "Use existing redaction wording pattern.",
          ack_required: true,
        },
      }),
      { now: "20260505" },
    );

    assert.equal(result.ok, false);
    assert.equal(result.reason, "deep_research_ack_required_before_planning");
  });

  it("blocks unsafe owned paths before Coding Room can receive the plan", () => {
    const result = createPlanningRoomScopePack(
      planningJob({
        files: ["../outside.mjs"],
      }),
    );

    assert.equal(result.ok, false);
    assert.equal(result.reason, "owned_file_parent_traversal");
    assert.equal(result.field, "owned_files");
  });

  it("blocks missing proof tests", () => {
    const result = createPlanningRoomScopePack(
      planningJob({
        tests: [],
      }),
    );

    assert.equal(result.ok, false);
    assert.equal(result.reason, "allowlist_tests_required");
  });

  it("can consume an explicit route decision without recalculating the caller job", () => {
    const route = chooseAutopilotRoute(
      planningJob({
        source: "queuepush-stuck-pr",
      }),
    );
    const result = createPlanningRoomScopePack(
      {
        id: "explicit-route",
        title: "Explicit route chip",
        files: ["scripts/example.mjs"],
        tests: ["node --test scripts/pinballwake-planning-room.test.mjs"],
        estimated_lines: 60,
      },
      { route, now: "20260505" },
    );

    assert.equal(result.ok, true);
    assert.equal(result.route.reason, "stuck_pr_skip_research_plan_from_existing_diff");
    assert.equal(result.scopepack.scopepack_id, "scopepack:explicit-route:20260505");
  });

  it("blocks caller-supplied routes that try to bypass protected job scoring", () => {
    const result = createPlanningRoomScopePack(
      {
        id: "protected-bypass",
        title: "Credentials redaction fix",
        context: "Touches credentials, tokens, secrets, and redaction.",
        files: ["docs/copy.md"],
        tests: ["node --test scripts/pinballwake-planning-room.test.mjs"],
        estimated_lines: 10,
      },
      {
        route: {
          ok: true,
          route: "planning-only",
          tier: "standard",
          ack_required: false,
          suggested_action: "build",
          reason: "caller_supplied",
          score: { axes: {}, total: 0, forced_deep_reasons: [] },
        },
      },
    );

    assert.equal(result.ok, false);
    assert.equal(result.reason, "supplied_route_conflicts_with_job_risk");
    assert.equal(result.computed_route.route, "deep-research-then-planning");
  });

  it("blocks caller-supplied routes that downgrade DeepDive to standard research", () => {
    const result = createPlanningRoomScopePack(
      {
        id: "protected-research-downgrade",
        title: "Credentials redaction fix",
        context: "Touches credentials, tokens, secrets, and redaction.",
        files: ["docs/copy.md"],
        tests: ["node --test scripts/pinballwake-planning-room.test.mjs"],
        estimated_lines: 10,
        research_report: {
          summary: "Generic research exists, but it is not an ACKed DeepDive result.",
          recommendation: "Use docs-only wording.",
          ack_complete: true,
        },
      },
      {
        route: {
          ok: true,
          route: "research-then-planning",
          tier: "scout",
          ack_required: false,
          suggested_action: "plan",
          reason: "caller_supplied",
          score: { axes: {}, total: 0, forced_deep_reasons: [] },
        },
      },
    );

    assert.equal(result.ok, false);
    assert.equal(result.reason, "supplied_route_conflicts_with_job_risk");
    assert.equal(result.computed_route.route, "deep-research-then-planning");
    assert.equal(result.computed_route.ack_required, true);
  });

  it("blocks deep-tier supplied research routes without an explicit ACK", () => {
    const result = createPlanningRoomScopePack(
      {
        id: "protected-deep-tier-no-ack",
        title: "Credentials redaction fix",
        context: "Touches credentials, tokens, secrets, and redaction.",
        files: ["docs/copy.md"],
        tests: ["node --test scripts/pinballwake-planning-room.test.mjs"],
        estimated_lines: 10,
        research_report: {
          summary: "Generic research exists, but it is not an ACKed DeepDive result.",
          recommendation: "Use docs-only wording.",
        },
      },
      {
        route: {
          ok: true,
          route: "research-then-planning",
          tier: "deep",
          ack_required: true,
          suggested_action: "plan",
          reason: "caller_supplied_deep_tier",
          score: { axes: {}, total: 7, forced_deep_reasons: ["security_sensitive"] },
        },
      },
    );

    assert.equal(result.ok, false);
    assert.equal(result.reason, "deep_research_ack_required_before_planning");
    assert.equal(result.computed_route.route, "deep-research-then-planning");
  });
});
