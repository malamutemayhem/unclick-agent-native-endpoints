import { describe, expect, it } from "vitest";

import {
  igniteonlyApi,
  igniteonlyPolicy,
  igniteonlyReceiptConsumer,
  IGNITEONLY_POLICY,
} from "./igniteonly-tool.js";

describe("IgniteOnlyAPI policy", () => {
  it("keeps IgniteOnly under the PinballWake green ignite lane", async () => {
    await expect(igniteonlyPolicy({})).resolves.toMatchObject({
      official_name: "IgniteOnlyAPI",
      worker_name: "IgniteOnly💥",
      code_name: "IgniteOnly",
      ecosystem: "PinballWake",
      lane: "green_ignite",
      authority: "ignite_only_wake_request_no_build_no_merge",
      rollout_status: "official",
    });
  });

  it("locks the hard safety boundary", () => {
    expect(IGNITEONLY_POLICY.prohibited_actions).toEqual(
      expect.arrayContaining([
        "merge PRs",
        "close blockers",
        "mark work complete",
        "edit code",
        "approve changes",
        "override safety gates",
        "decide subjective ownership",
      ]),
    );
    expect(IGNITEONLY_POLICY.quality_gates).toEqual(
      expect.arrayContaining([
        "Require source evidence before creating a wake packet.",
        "Prefer no wake over waking the wrong worker.",
        "Emit public compact fields only. Never include secrets, private credentials, or raw hidden context.",
      ]),
    );
  });

  it("turns a trusted NudgeOnly missing-proof bridge into a Builder wake packet", async () => {
    await expect(igniteonlyReceiptConsumer({
      nudge_bridge_result: {
        bridge_id: "nudgebridge_1234567890abcdef",
        bridge_status: "receipt_request",
        painpoint_detected: true,
        painpoint_type: "missing_proof",
        request: {
          worker: "Builder",
          target: "PR #706",
          expected_receipt: "Commit, PR, run ID, receipt ID, or blocker receipt.",
          verifier: "Check linked commit, PR, run ID, receipt ID, or source pointer.",
          receipt_line: "Builder -> PR #706 -> missing_proof -> commit or PR -> proof pointer check",
        },
        evidence: {
          source_id: "wake-issues-issue-706",
          source_url: "https://github.com/malamutemayhem/unclick-agent-native-endpoints/issues/706",
          nudge_trace_id: "nudgeonly_abc123",
          verifier_required: true,
        },
      },
    })).resolves.toMatchObject({
      ignite_status: "wake_request",
      official_name: "IgniteOnlyAPI",
      worker: "IgniteOnly💥",
      code_name: "IgniteOnly",
      ecosystem: "PinballWake",
      lane: "green_ignite",
      authority: "ignite_only_wake_request_no_build_no_merge",
      painpoint_type: "missing_proof",
      wake_packet: {
        action: "wake_worker",
        worker: "Builder",
        target: "PR #706",
        painpoint_type: "missing_proof",
        bridge_id: "nudgebridge_1234567890abcdef",
        source_id: "wake-issues-issue-706",
        source_url: "https://github.com/malamutemayhem/unclick-agent-native-endpoints/issues/706",
        public_fields_only: true,
      },
      proof: {
        receipt_line: "Builder -> PR #706 -> missing_proof -> commit or PR -> proof pointer check",
      },
    });
  });

  it("routes unclear ownership to Job Manager only", async () => {
    await expect(igniteonlyReceiptConsumer({
      bridge_id: "nudgebridge_owner",
      bridge_status: "receipt_request",
      painpoint_detected: true,
      painpoint_type: "unclear_owner",
      source_id: "dispatch_blocker_706",
      target: "Issue #706",
      verified: true,
      request: {
        worker: "Job Manager",
        expected_receipt: "Owning job, next safe action, and expected proof receipt.",
        verifier: "Run the owner resolver.",
      },
    })).resolves.toMatchObject({
      ignite_status: "wake_request",
      wake_packet: {
        worker: "Job Manager",
        target: "Issue #706",
        painpoint_type: "unclear_owner",
      },
    });
  });

  it("escalates when the bridge is an escalation request", async () => {
    await expect(igniteonlyReceiptConsumer({
      bridge_id: "nudgebridge_stale",
      bridge_status: "escalation_request",
      painpoint_detected: true,
      painpoint_type: "stale_ack",
      source_url: "https://github.com/malamutemayhem/unclick-agent-native-endpoints/pull/705",
      target: "PR #705",
      verifier_status: "wakepass_pass",
      request: {
        worker: "Reviewer",
        expected_receipt: "ACK received, review started, or blocker receipt with reason.",
        verifier: "Run the WakePass ACK verifier against the source dispatch or PR.",
      },
    })).resolves.toMatchObject({
      ignite_status: "escalation_wake_request",
      wake_packet: {
        action: "wake_worker_and_escalate",
        worker: "Reviewer",
        painpoint_type: "stale_ack",
      },
    });
  });

  it("blocks weak or unverified evidence instead of waking a worker", async () => {
    await expect(igniteonlyReceiptConsumer({
      bridge_status: "advisory_only",
      painpoint_detected: true,
      painpoint_type: "missing_proof",
      target: "PR #706",
      request: { worker: "Builder" },
    })).resolves.toMatchObject({
      ignite_status: "blocked_verification_required",
      reason: "IgniteOnly only wakes workers from receipt_request or escalation_request bridge results.",
    });

    await expect(igniteonlyReceiptConsumer({
      bridge_status: "receipt_request",
      painpoint_detected: true,
      painpoint_type: "missing_proof",
      target: "PR #706",
      request: { worker: "Builder" },
    })).resolves.toMatchObject({
      ignite_status: "blocked_verification_required",
      reason: "Source evidence is missing, so no worker wake packet was created.",
    });
  });

  it("blocks mismatched worker overrides instead of routing to the wrong lane", async () => {
    await expect(igniteonlyReceiptConsumer({
      bridge_id: "nudgebridge_wrong_worker",
      bridge_status: "receipt_request",
      painpoint_detected: true,
      painpoint_type: "missing_proof",
      source_id: "wake-issues-issue-706",
      target: "PR #706",
      verified: true,
      request: {
        worker: "Safety Checker",
        expected_receipt: "Commit or blocker receipt.",
        verifier: "Check linked proof pointer.",
      },
    })).resolves.toMatchObject({
      ignite_status: "blocked_verification_required",
      reason: "Target, known worker lane, or painpoint route is missing.",
    });
  });

  it("redacts secret-shaped fields from public wake packets", async () => {
    const result = await igniteonlyApi({
      bridge_id: "nudgebridge_secret",
      bridge_status: "receipt_request",
      painpoint_detected: true,
      painpoint_type: "missing_proof",
      source_id: "api_key=super-secret",
      source_url: "https://unclick.world/api/mcp?key=url-secret&access_token=token-secret",
      target: "Authorization: Bearer abc123.secret",
      verified: true,
      request: {
        worker: "Builder",
        verifier: "Check proof pointer.",
      },
    });

    expect(JSON.stringify(result)).not.toContain("super-secret");
    expect(JSON.stringify(result)).not.toContain("url-secret");
    expect(JSON.stringify(result)).not.toContain("token-secret");
    expect(JSON.stringify(result)).not.toContain("abc123.secret");
    expect(result).toMatchObject({
      ignite_status: "wake_request",
      wake_packet: {
        source_id: "api_key=<redacted>",
        source_url: "https://unclick.world/api/mcp?key=<redacted>&access_token=<redacted>",
        target: "Authorization: Bearer <redacted>",
      },
    });
  });
});
