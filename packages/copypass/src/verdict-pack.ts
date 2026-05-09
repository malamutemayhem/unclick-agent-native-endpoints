import {
  CopyPassCopyBlockSchema,
  CopyPassReportSchema,
  type CopyPassCheckDefinition,
  type CopyPassCopyBlockInput,
  type CopyPassFinding,
  type CopyPassNotChecked,
  type CopyPassReport,
  type CopyPassTargetInput,
  type CopyPassVerdict,
} from "./schema.js";
import {
  DEFAULT_COPYPASS_CHECKS,
  detectCopyPassFindings,
} from "./copy-library.js";

const COPYPASS_ADVISORY_DISCLAIMER =
  "CopyPass is advisory. It flags deterministic copy signals for review and does not guarantee legal, ranking, conversion, revenue, accessibility, or compliance outcomes.";

const FIXTURE_NOT_CHECKED: CopyPassNotChecked[] = [
  {
    label: "Production crawl",
    reason: "This scaffold only evaluates provided fixture copy.",
  },
  {
    label: "Paid model review",
    reason: "This scaffold uses deterministic local checks and does not call paid LLMs.",
  },
  {
    label: "Private customer copy",
    reason: "Only caller-provided public fixtures should be passed to CopyPass.",
  },
];

export interface CreateCopyPassVerdictPackInput {
  target: CopyPassTargetInput;
  generated_at?: string;
  checks?: CopyPassCheckDefinition[];
}

export interface CreateFixtureCopyPassReportInput
  extends CreateCopyPassVerdictPackInput {
  blocks: CopyPassCopyBlockInput[];
}

export function createCopyPassVerdictPack(
  input: CreateCopyPassVerdictPackInput,
): CopyPassReport {
  const checks = input.checks ?? DEFAULT_COPYPASS_CHECKS;
  const report = {
    target: input.target,
    generated_at: input.generated_at ?? new Date().toISOString(),
    mode: "plan-only" as const,
    overall_score: 0,
    verdict: "unknown" as const,
    checks_attempted: checks.map((check) => check.id),
    blocks_reviewed: [],
    findings: [],
    not_checked: FIXTURE_NOT_CHECKED,
    scanner_source: {
      kind: "shared-scanner-plan" as const,
      mode: "plan-only" as const,
      target_url: input.target.url,
      shared_check_ids: checks.map((check) => check.id),
    },
    disclaimers: [COPYPASS_ADVISORY_DISCLAIMER],
    notes: [
      "Plan-only CopyPass pack. No production crawl, paid call, private copy, or live analytics write was used.",
    ],
  };

  return CopyPassReportSchema.parse(report);
}

export function createFixtureCopyPassReport(
  input: CreateFixtureCopyPassReportInput,
): CopyPassReport {
  const checks = input.checks ?? DEFAULT_COPYPASS_CHECKS;
  const blocks = input.blocks.map((block) => CopyPassCopyBlockSchema.parse(block));
  const findings = detectCopyPassFindings(blocks, checks);
  const overall_score = scoreCopyPassFindings(findings);
  const report = {
    target: input.target,
    generated_at: input.generated_at ?? new Date().toISOString(),
    mode: "fixture" as const,
    overall_score,
    verdict: toCopyPassVerdict(findings, overall_score),
    checks_attempted: checks.map((check) => check.id),
    blocks_reviewed: blocks.map((block) => block.id),
    findings,
    not_checked: FIXTURE_NOT_CHECKED,
    scanner_source: {
      kind: "fixture" as const,
      mode: "fixture" as const,
      target_url: input.target.url,
      shared_check_ids: checks.map((check) => check.id),
    },
    disclaimers: [COPYPASS_ADVISORY_DISCLAIMER],
    notes: [
      "Fixture-only CopyPass report. Findings are deterministic text signals for human copy review.",
    ],
  };

  return CopyPassReportSchema.parse(report);
}

export function scoreCopyPassFindings(findings: CopyPassFinding[]): number {
  const penalty = findings.reduce((total, finding) => {
    switch (finding.severity) {
      case "critical":
        return total + 30;
      case "high":
        return total + 20;
      case "medium":
        return total + 12;
      case "low":
        return total + 6;
      case "info":
        return total + 2;
    }
  }, 0);

  return Math.max(0, 100 - penalty);
}

export function toCopyPassVerdict(
  findings: CopyPassFinding[],
  overallScore: number,
): CopyPassVerdict {
  if (findings.length === 0) {
    return "pass";
  }

  if (
    findings.some(
      (finding) => finding.severity === "critical" || finding.severity === "high",
    )
  ) {
    return "fail";
  }

  if (overallScore < 100) {
    return "warn";
  }

  return "unknown";
}
