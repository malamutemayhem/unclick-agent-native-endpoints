import { createHash } from "node:crypto";

export type CommonSensePassProtocol = {
  version: string;
  purpose: string;
  when_to_run: string[];
  tool_contract: {
    package_name: string;
    function_name: string;
    input_fields: string[];
    output_fields: string[];
  };
  verdicts: Record<
    "PASS" | "BLOCKER" | "HOLD" | "SUPPRESS" | "ROUTE",
    string
  >;
  procedure: string[];
  receipt_template: {
    line_template: string;
    required_fields: string[];
  };
  guardrails: string[];
  watch_state_key: string;
};

export const COMMONSENSEPASS_PROTOCOL_DATE = "2026-05-17";
export const COMMONSENSEPASS_PROTOCOL_REVISION = 1;

export function formatCommonSensePassProtocolVersion(revision: number): string {
  return `${COMMONSENSEPASS_PROTOCOL_DATE}.v${revision}`;
}

const COMMONSENSEPASS_PROTOCOL: CommonSensePassProtocol = {
  version: formatCommonSensePassProtocolVersion(COMMONSENSEPASS_PROTOCOL_REVISION),
  purpose:
    "CommonSensePass is the read-only sanity gate workers run before claiming healthy, quiet, no_work, pass, done, merge_ready, or duplicate_wake.",
  when_to_run: [
    "Before saying there is no work.",
    "Before saying UnClick is healthy or quiet.",
    "Before marking a job done.",
    "Before treating a PR as merge-ready.",
    "Before suppressing a wake as a duplicate.",
    "Before emitting a PASS when live queue, PR, or wake evidence may be stale.",
  ],
  tool_contract: {
    package_name: "@unclick/commonsensepass",
    function_name: "commonsensepassCheck",
    input_fields: ["claim", "context", "evidence"],
    output_fields: ["verdict", "rule_id", "reason", "evidence", "next_action", "route_to"],
  },
  verdicts: {
    PASS: "The claim matches the evidence. Continue with the next safe action.",
    BLOCKER: "The evidence contradicts the claim. Stop and report the smallest missing fix.",
    HOLD: "The evidence is incomplete. Fetch the missing proof and run the check again.",
    SUPPRESS: "The claim is a duplicate or no-op. Stay quiet unless another signal matters.",
    ROUTE: "The claim is valid but belongs to another worker, lane, or deterministic tool.",
  },
  procedure: [
    "Build a compact evidence packet from live state: queue count, active_jobs count, target todo id, PR head/checks/review state, wake id, wake fingerprint, and fetched_at where available.",
    "Call commonsensepassCheck with the claim kind and evidence packet before emitting a PASS, BLOCKER, HOLD, SUPPRESS, or ROUTE receipt.",
    "Use deterministic evidence for counts, PR checks, duplicate wake fingerprints, and stale-owner windows. Use model judgment only to choose the claim kind and explain the next safe step.",
    "Treat HOLD as a prompt to fetch missing proof, not as permission to guess.",
    "Treat BLOCKER as a stop sign for the claimed action. Do one safe unblock only if it does not cross protected surfaces.",
    "Treat SUPPRESS as quiet unless another fresh signal is user-visible.",
    "For merge_ready, require current PR head, green or neutral checks, mergeable state, and fresh review/safety proof on the same head.",
    "For done, require a target todo and proof that the completing PR, commit, or receipt matches that todo.",
    "For no_work or quiet, require both active_jobs and actionable backlog evidence. If queue hydration failed, return BLOCKER rather than PASS.",
    "Save or post the receipt line with verdict, rule_id, evidence refs, and next_action so other seats can continue without re-checking the whole world.",
  ],
  receipt_template: {
    line_template:
      "CommonSensePass {verdict} {rule_id}: {reason}; evidence={refs}; next={next_action}",
    required_fields: ["verdict", "rule_id", "reason", "evidence", "next_action"],
  },
  guardrails: [
    "Verdict-only. Do not mutate source state, close jobs, merge PRs, change data, deploy, or wake workers from this protocol.",
    "Never include keys, tokens, private credentials, or plaintext values in evidence or receipts.",
    "Use source pointers, counts, timestamps, public PR links, and safe hashes instead of raw sensitive data.",
    "Keep the evidence compact so strict clients can read the result.",
    "If the check cannot run, return HOLD or BLOCKER with the missing capability named plainly.",
  ],
  watch_state_key: "commonsensepass_last_state",
};

export function commonSensePassProtocolContentFingerprint(
  protocol = COMMONSENSEPASS_PROTOCOL,
): string {
  const { version: _version, ...content } = protocol;
  return createHash("sha256").update(JSON.stringify(content)).digest("hex").slice(0, 16);
}

export function getCommonSensePassProtocol(): CommonSensePassProtocol {
  return JSON.parse(JSON.stringify(COMMONSENSEPASS_PROTOCOL)) as CommonSensePassProtocol;
}
