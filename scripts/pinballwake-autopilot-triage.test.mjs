import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  chooseAutopilotRoute,
  createAutopilotTriageResult,
  createInlineScopePack,
  scoreAutopilotJob,
  validateScopePack,
} from "./pinballwake-autopilot-triage.mjs";

function tinyJob(input = {}) {
  return {
    source: "user",
    title: "Tiny connector copy update",
    description: "Adjust one connector label.",
    files: ["connectors/lott/index.ts"],
    estimated_lines: 24,
    tests: ["node --test scripts/pinballwake-autopilot-triage.test.mjs"],
    ...input,
  };
}

describe("PinballWake Autopilot triage", () => {
  it("routes tiny low-risk work straight to Coding Room with InlineScope", () => {
    const result = createAutopilotTriageResult(tinyJob());

    assert.equal(result.ok, true);
    assert.equal(result.route.route, "direct-to-coding");
    assert.equal(result.route.tier, "inline");
    assert.equal(result.route.ack_required, false);
    assert.equal(result.inline_scopepack.chip_title, "Tiny connector copy update");
    assert.deepEqual(result.inline_scopepack.owned_files, ["connectors/lott/index.ts"]);
  });

  it("routes stuck PRs to Planning Room without Research Room", () => {
    const route = chooseAutopilotRoute(
      tinyJob({
        source: "stuck-pr",
        files: ["scripts/pinballwake-pipeline-executor.mjs", "scripts/pinballwake-pipeline-executor.test.mjs"],
        estimated_lines: 140,
        shared_surface: true,
      }),
    );

    assert.equal(route.route, "planning-only");
    assert.equal(route.reason, "stuck_pr_skip_research_plan_from_existing_diff");
  });

  it("forces DeepDive for protected Autopilot surfaces", () => {
    const route = chooseAutopilotRoute(
      tinyJob({
        title: "Proof allowlist change",
        proof_allowlist: true,
        estimated_lines: 30,
      }),
    );

    assert.equal(route.route, "deep-research-then-planning");
    assert.equal(route.tier, "deep");
    assert.equal(route.ack_required, true);
    assert.match(route.reason, /proof_allowlist/);
  });

  it("forces DeepDive for under-tagged auth and key paths", () => {
    const route = chooseAutopilotRoute(
      tinyJob({
        title: "Tiny login helper",
        files: ["api/auth/session-token.ts"],
        estimated_lines: 12,
      }),
    );

    assert.equal(route.route, "deep-research-then-planning");
    assert.equal(route.tier, "deep");
    assert.match(route.reason, /auth_or_keys/);
  });

  it("forces DeepDive for under-tagged schema and migration paths", () => {
    const route = chooseAutopilotRoute(
      tinyJob({
        title: "Small table wording fix",
        files: ["supabase/migrations/20260504_room_jobs.sql"],
        estimated_lines: 8,
      }),
    );

    assert.equal(route.route, "deep-research-then-planning");
    assert.match(route.reason, /schema_shared/);
  });

  it("forces DeepDive for under-tagged proof allowlist and XPass paths", () => {
    const proofRoute = chooseAutopilotRoute(
      tinyJob({
        title: "Small proof command tweak",
        files: ["scripts/pinballwake-proof-executor.mjs"],
        estimated_lines: 14,
      }),
    );
    const xpassRoute = chooseAutopilotRoute(
      tinyJob({
        title: "Small trust guard tweak",
        files: ["scripts/xpass-policy-guard.mjs"],
        estimated_lines: 14,
      }),
    );

    assert.equal(proofRoute.route, "deep-research-then-planning");
    assert.match(proofRoute.reason, /proof_allowlist/);
    assert.equal(xpassRoute.route, "deep-research-then-planning");
    assert.match(xpassRoute.reason, /xpass_safety/);
  });

  it("forces DeepDive from protected auth context even when owned files look generic", () => {
    const route = chooseAutopilotRoute(
      tinyJob({
        title: "Small copy update for API keys and tokens",
        context: "This mentions credentials, secrets, and raw keys but owns a generic file.",
        files: ["docs/help-copy.md"],
        estimated_lines: 9,
      }),
    );

    assert.equal(route.route, "deep-research-then-planning");
    assert.match(route.reason, /auth_or_keys/);
  });

  it("forces DeepDive from protected billing context even when owned files look generic", () => {
    const route = chooseAutopilotRoute(
      tinyJob({
        title: "Tiny payments wording fix",
        context: "Mentions Stripe invoices and subscriptions.",
        files: ["docs/help-copy.md"],
        estimated_lines: 9,
      }),
    );

    assert.equal(route.route, "deep-research-then-planning");
    assert.match(route.reason, /billing/);
  });

  it("forces DeepDive from security and redaction context even when owned files look generic", () => {
    const route = chooseAutopilotRoute(
      tinyJob({
        title: "Small security note",
        context: "Mentions redaction, sanitization, and secrets but owns a generic docs file.",
        files: ["docs/help-copy.md"],
        estimated_lines: 9,
      }),
    );

    assert.equal(route.route, "deep-research-then-planning");
    assert.match(route.reason, /security_sensitive/);
  });

  it("forces DeepDive from protected security filename stems even when metadata is missing", () => {
    for (const file of [
      "docs/redaction-policy.md",
      "docs/sanitization-copy.md",
      "docs/security-note.md",
      "src/lib/redaction.ts",
      "src/lib/sanitize.ts",
      "src/lib/sanitization.ts",
      "src/lib/security.ts",
      "src/lib/csrf.ts",
      "scripts/rotatepass-redaction-guard.test.mjs",
    ]) {
      const route = chooseAutopilotRoute(
        tinyJob({
          title: "Small docs update",
          context: "No explicit protected tags.",
          files: [file],
          estimated_lines: 9,
        }),
      );

      assert.equal(route.route, "deep-research-then-planning", file);
      assert.match(route.reason, /security_sensitive/, file);
    }
  });

  it("routes novel medium work through Research then Planning", () => {
    const route = chooseAutopilotRoute(
      tinyJob({
        title: "Add new third-party connector",
        third_party: true,
        shared_surface: true,
        estimated_lines: 180,
        files: ["connectors/new-service/index.ts", "connectors/new-service/index.test.ts"],
      }),
    );

    assert.equal(route.route, "research-then-planning");
    assert.equal(route.tier, "scout");
    assert.equal(route.ack_required, false);
  });

  it("honors urgent skip-research by sending medium work to Planning only", () => {
    const route = chooseAutopilotRoute(
      tinyJob({
        title: "Fix urgent shared runner bug #urgent",
        shared_surface: true,
        estimated_lines: 160,
      }),
    );

    assert.equal(route.route, "planning-only");
    assert.equal(route.reason, "user_skip_research_or_urgent");
  });

  it("keeps the five-axis score readable", () => {
    const score = scoreAutopilotJob({
      estimated_lines: 640,
      core_infra: true,
      data_loss: true,
      no_prior_art: true,
      user_facing: true,
    });

    assert.deepEqual(score.axes, {
      scope: 2,
      surface: 2,
      reversibility: 2,
      novelty: 2,
      stakes: 1,
    });
    assert.equal(score.total, 9);
  });

  it("rejects InlineScope when proof tests are missing", () => {
    const result = createInlineScopePack(
      tinyJob({
        tests: [],
      }),
    );

    assert.equal(result.ok, false);
    assert.equal(result.reason, "allowlist_tests_required");
  });

  it("rejects unsafe owned file paths in ScopePack validation", () => {
    const result = validateScopePack({
      scopepack_id: "sp-test",
      chip_title: "Bad path",
      problem_statement: "Should fail validation.",
      owned_files: ["../outside.ts"],
      non_overlap_statement: "No overlap.",
      architecture_notes: "No architecture change.",
      implementation_steps: ["Change file."],
      test_proof_plan: {
        allowlist_tests: ["node --test scripts/pinballwake-autopilot-triage.test.mjs"],
      },
      risk_controls: ["Small scoped change."],
      stop_conditions: ["Stop on blocker."],
      expected_proof: "Tests pass.",
      diff_size_bucket: "under-50",
      target_seat: "codex",
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "owned_file_parent_traversal");
  });

  it("rejects duplicate owned file entries after normalization", () => {
    const result = validateScopePack({
      scopepack_id: "sp-test",
      chip_title: "Duplicate path",
      problem_statement: "Should fail validation.",
      owned_files: ["scripts/example.mjs", "scripts\\example.mjs"],
      non_overlap_statement: "No overlap.",
      architecture_notes: "No architecture change.",
      implementation_steps: ["Change file."],
      test_proof_plan: {
        allowlist_tests: ["node --test scripts/pinballwake-autopilot-triage.test.mjs"],
      },
      risk_controls: ["Small scoped change."],
      stop_conditions: ["Stop on blocker."],
      expected_proof: "Tests pass.",
      diff_size_bucket: "under-50",
      target_seat: "codex",
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "duplicate_owned_files");
  });
});
