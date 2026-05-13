import { ClaimInput, CommonSensePassResult } from "./schema.js";
import { checkR1, checkR2, checkR3, checkR4, checkR5 } from "./rules.js";

type RuleFn = (input: ClaimInput) => CommonSensePassResult | null;

const RULES: RuleFn[] = [checkR1, checkR2, checkR3, checkR4, checkR5];

/**
 * commonsensepassCheck - verdict-only sanity gate.
 *
 * Dispatches the claim through R1-R5; returns the first non-null verdict.
 * If no rule fires, returns a default PASS so callers can plug new claim
 * kinds in safely. Does NOT mutate source state, build, merge, or close.
 *
 * Verdicts:
 *   PASS      - claim is consistent with evidence; safe to proceed.
 *   BLOCKER   - claim is contradicted by evidence; do not proceed.
 *   HOLD      - claim is missing required evidence; supply it and retry.
 *   SUPPRESS  - claim is a duplicate / no-op; drop it silently.
 *   ROUTE     - claim valid but should be handled elsewhere (reserved).
 */
export function commonsensepassCheck(
  input: ClaimInput,
): CommonSensePassResult {
  for (const rule of RULES) {
    const result = rule(input);
    if (result) return result;
  }
  return {
    verdict: "PASS",
    rule_id: null,
    reason: `Claim "${input.claim}" matched no rule; default PASS.`,
    evidence: input.evidence ?? [],
  };
}
