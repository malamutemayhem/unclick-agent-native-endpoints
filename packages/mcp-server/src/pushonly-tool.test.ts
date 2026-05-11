import { describe, expect, it } from "vitest";

import { igniteonlyReceiptConsumer } from "./igniteonly-tool.js";
import {
  pushonlyApi,
  pushonlyPolicy,
  pushonlyWakePusher,
  PUSHONLY_POLICY,
} from "./pushonly-tool.js";
import { ADDITIONAL_HANDLERS, ADDITIONAL_TOOLS } from "./tool-wiring.js";

describe("PushOnlyAPI policy", () => {
  it("keeps PushOnly under the packet-only PinballWake push lane", async () => {
    await expect(pushonlyPolicy({})).resolves.toMatchObject({
      official_name: "PushOnlyAPI",
      worker_name: "PushOnly📬",
      code_name: "PushOnly",
      ecosystem: "PinballWake",
      lane: "blue_push",
      authority: "push_only_worker_envelope_no_execution",
      rollout_status: "scaffolded",
    });
  });

  it("locks the hard no-execution boundary", () => {
    expect(PUSHONLY_POLICY.prohibited_actions).toEqual(
      expect.arrayContaining([
        "build code",
        "merge PRs",
        "approve changes",
        "close issues",
        "mark work complete",
        "assign ownership",
        "edit source-of-truth state",
      ]),
    );
    expect(PUSHONLY_POLICY.quality_gates).toEqual(
      expect.arrayContaining([
        "Require a verified IgniteOnly wake packet before pushing.",
        "PushOnly may emit a push envelope only; it must not write source-of-truth state.",
        "Prefer no push over pushing to the wrong worker.",
      ]),
    );
  });

  it("turns an IgniteOnly queue hydration wake into a Jobs Worker push envelope", async () => {
    const ignite = await igniteonlyReceiptConsumer({
      bridge_id: "nudgebridge_queue",
      bridge_status: "receipt_request",
      painpoint_detected: true,
      painpoint_type: "queue_hydration_failure",
      source_id: "orchestrator-current-state",
      target: "Boardroom backlog",
      verified: true,
      request: {
        worker: "pinballwake-jobs-worker",
        expected_receipt: "Backlog counted, scoped, mirrored, or routed.",
        verifier: "Compare active jobs against actionable todos.",
      },
    });

    await expect(pushonlyWakePusher({ ignite_result: ignite })).resolves.toMatchObject({
      push_status: "push_request",
      official_name: "PushOnlyAPI",
      worker: "PushOnly📬",
      code_name: "PushOnly",
      ecosystem: "PinballWake",
      lane: "blue_push",
      authority: "push_only_worker_envelope_no_execution",
      target_worker: "pinballwake-jobs-worker",
      push_packet: {
        action: "push_worker_packet",
        worker: "pinballwake-jobs-worker",
        worker_route: "pinballwake_jobs_room",
        target: "Boardroom backlog",
        painpoint_type: "queue_hydration_failure",
        source_id: "orchestrator-current-state",
        public_fields_only: true,
        execute: false,
        mutation_authority: false,
      },
    });
  });

  it("blocks quiet or unverified IgniteOnly results instead of pushing", async () => {
    await expect(pushonlyApi({
      ignite_result: {
        ignite_status: "blocked_verification_required",
        wake_packet: {
          worker: "pinballwake-jobs-worker",
          target: "Boardroom backlog",
          public_fields_only: true,
        },
      },
    })).resolves.toMatchObject({
      push_status: "blocked_verification_required",
      reason: "PushOnly only pushes verified IgniteOnly wake_request or escalation_wake_request packets.",
    });

    await expect(pushonlyApi({
      ignite_result: {
        ignite_status: "wake_request",
        wake_packet: {
          worker: "pinballwake-jobs-worker",
          target: "Boardroom backlog",
          source_id: "orchestrator-current-state",
          public_fields_only: false,
        },
      },
    })).resolves.toMatchObject({
      push_status: "blocked_verification_required",
      reason: "PushOnly requires IgniteOnly wake_packet.public_fields_only=true before pushing.",
    });
  });

  it("blocks unknown workers rather than inventing routes", async () => {
    await expect(pushonlyApi({
      ignite_status: "wake_request",
      wake_packet: {
        worker: "Imaginary Worker",
        target: "Boardroom backlog",
        source_id: "orchestrator-current-state",
        public_fields_only: true,
      },
    })).resolves.toMatchObject({
      push_status: "blocked_verification_required",
      reason: "Target, known worker route, or worker is missing.",
      missing: {
        known_route: true,
      },
    });
  });

  it("redacts secret-shaped fields from public push packets", async () => {
    const result = await pushonlyApi({
      ignite_status: "wake_request",
      wake_packet: {
        ignite_id: "igniteonly_secret",
        worker: "pinballwake-jobs-worker",
        target: "Authorization: Bearer abc123.secret",
        source_id: "api_key=super-secret",
        source_url: "https://unclick.world/api/mcp?key=url-secret&access_token=token-secret",
        receipt_line: "token=receipt-secret",
        public_fields_only: true,
      },
    });

    expect(JSON.stringify(result)).not.toContain("super-secret");
    expect(JSON.stringify(result)).not.toContain("url-secret");
    expect(JSON.stringify(result)).not.toContain("token-secret");
    expect(JSON.stringify(result)).not.toContain("abc123.secret");
    expect(JSON.stringify(result)).not.toContain("receipt-secret");
    expect(result).toMatchObject({
      push_status: "push_request",
      push_packet: {
        target: "Authorization: Bearer <redacted>",
        source_id: "api_key=<redacted>",
        source_url: "https://unclick.world/api/mcp?key=<redacted>&access_token=<redacted>",
        receipt_line: "token=<redacted>",
      },
    });
  });

  it("is exposed through MCP tool wiring", async () => {
    const names = ADDITIONAL_TOOLS.map((tool) => tool.name);

    expect(names).toEqual(expect.arrayContaining([
      "pushonly_policy",
      "pushonly_api",
      "pushonly_wake_pusher",
    ]));

    await expect(ADDITIONAL_HANDLERS.pushonly_policy({})).resolves.toMatchObject({
      official_name: "PushOnlyAPI",
    });
  });
});
