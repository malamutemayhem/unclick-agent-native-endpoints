import { DEFAULT_CHECKS, SLOPPASS_CATEGORIES } from "./categories.js";
import { SLOPPASS_DISCLAIMER } from "./disclaimer.js";
import {
  SlopPassCategorySchema,
  SlopPassResultSchema,
  SlopPassSourceFileSchema,
  SlopPassTargetSchema,
} from "./schema.js";
import {
  DEFAULT_SLOPPASS_SMELL_CHECKS,
  detectSlopSmells,
} from "./smell-library.js";
import type {
  SlopPassCategory,
  SlopPassFinding,
  SlopPassResult,
  SlopPassSeverity,
  SlopPassSourceFile,
  SlopPassTarget,
  SlopPassVerdict,
} from "./types.js";

export type SlopPassVerdictPackMode = "plan-only" | "fixture";

export interface SlopPassScannerSource {
  kind: "manual" | "fixture" | "shared-scanner" | "geopass-plan";
  mode: SlopPassVerdictPackMode;
  label?: string;
  source_id?: string;
  shared_check_ids?: string[];
  files?: string[];
}

export interface CreateSlopPassVerdictPackInput {
  target: SlopPassTarget;
  generated_at?: string;
  checks?: SlopPassCategory[];
  scanner_source?: SlopPassScannerSource;
  notes?: string[];
}

export interface CreateFixtureSlopPassReportInput
  extends CreateSlopPassVerdictPackInput {
  files: SlopPassSourceFile[];
}

export interface SlopPassVerdictPack extends SlopPassResult {
  mode: SlopPassVerdictPackMode;
  generated_at: string;
  scanner_source: SlopPassScannerSource;
  smell_checks: Array<{
    id: string;
    category: SlopPassCategory;
    label: string;
  }>;
  notes: string[];
}

function emptyCounts(): Record<SlopPassSeverity, number> {
  return { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
}

export function toSlopPassVerdict(
  counts: Record<SlopPassSeverity, number>,
): SlopPassVerdict {
  if (counts.critical > 0 || counts.high > 0) return "fail";
  if (counts.medium > 0 || counts.low > 0 || counts.info > 0) return "warn";
  return "pass";
}

function countFindings(findings: SlopPassFinding[]): Record<SlopPassSeverity, number> {
  const counts = emptyCounts();
  for (const finding of findings) counts[finding.severity]++;
  return counts;
}

function parseChecks(checks?: SlopPassCategory[]): SlopPassCategory[] {
  return (checks ?? DEFAULT_CHECKS).map((check) => SlopPassCategorySchema.parse(check));
}

function createNotChecked(checks: SlopPassCategory[], reason: string) {
  const requested = new Set(checks);
  return DEFAULT_CHECKS.filter((category) => !requested.has(category)).map((category) => ({
    label: category,
    reason,
  }));
}

function smellCheckMetadata(checks: SlopPassCategory[]) {
  const requested = new Set(checks);
  return DEFAULT_SLOPPASS_SMELL_CHECKS.filter((check) =>
    requested.has(check.category),
  ).map((check) => ({
    id: check.id,
    category: check.category,
    label: SLOPPASS_CATEGORIES[check.category],
  }));
}

function generatedAt(input?: string): string {
  return input ?? new Date(0).toISOString();
}

function baseScannerSource(
  mode: SlopPassVerdictPackMode,
  files: string[],
  scanner_source?: SlopPassScannerSource,
): SlopPassScannerSource {
  return {
    kind: scanner_source?.kind ?? (mode === "fixture" ? "fixture" : "manual"),
    mode,
    label: scanner_source?.label,
    source_id: scanner_source?.source_id,
    shared_check_ids: scanner_source?.shared_check_ids ?? [],
    files: scanner_source?.files ?? files,
  };
}

function createPack(
  result: SlopPassResult,
  input: {
    mode: SlopPassVerdictPackMode;
    generated_at?: string;
    scanner_source?: SlopPassScannerSource;
    smell_checks: SlopPassVerdictPack["smell_checks"];
    notes?: string[];
  },
): SlopPassVerdictPack {
  return {
    ...result,
    mode: input.mode,
    generated_at: generatedAt(input.generated_at),
    scanner_source: baseScannerSource(
      input.mode,
      result.scope.files_reviewed,
      input.scanner_source,
    ),
    smell_checks: input.smell_checks,
    notes:
      input.notes ??
      [
        "SlopPass chunk-1 is deterministic and fixture-only. No untrusted code execution, production scans, paid calls, or credentials are used.",
      ],
  };
}

export function createSlopPassVerdictPack(
  input: CreateSlopPassVerdictPackInput,
): SlopPassVerdictPack {
  const checks = parseChecks(input.checks);
  const target = SlopPassTargetSchema.parse(input.target);
  const result = SlopPassResultSchema.parse({
    target,
    scope: {
      checks_attempted: [],
      files_reviewed: target.files ?? [],
      provider: "fixture-only",
    },
    verdict: "unknown",
    findings: [],
    not_checked: DEFAULT_CHECKS.map((category) => ({
      label: category,
      reason: "Plan-only pack. Run fixture evidence in a later chip.",
    })),
    summary: {
      posture: "SlopPass plan-only pack is configured for deterministic fixture review.",
      counts_by_severity: emptyCounts(),
      coverage_note:
        "No source content was inspected. This pack only declares the static review plan.",
    },
    disclaimer: SLOPPASS_DISCLAIMER,
  });

  return createPack(result, {
    mode: "plan-only",
    generated_at: input.generated_at,
    scanner_source: input.scanner_source,
    smell_checks: smellCheckMetadata(checks),
    notes: input.notes,
  });
}

export function createFixtureSlopPassReport(
  input: CreateFixtureSlopPassReportInput,
): SlopPassVerdictPack {
  const checks = parseChecks(input.checks);
  const files = input.files.map((file) => SlopPassSourceFileSchema.parse(file));
  const findings = detectSlopSmells(files).filter((finding) =>
    checks.includes(finding.category),
  );
  const counts = countFindings(findings);
  const result = SlopPassResultSchema.parse({
    target: SlopPassTargetSchema.parse(input.target),
    scope: {
      checks_attempted: checks,
      files_reviewed: files.map((file) => file.path),
      provider: "fixture-only",
    },
    verdict: toSlopPassVerdict(counts),
    findings,
    not_checked: createNotChecked(
      checks,
      "Check was not requested for this fixture-only run.",
    ),
    summary: {
      posture:
        findings.length > 0
          ? "SlopPass found deterministic slop signals in the inspected fixtures."
          : "SlopPass found no deterministic slop signals in the inspected fixtures.",
      counts_by_severity: counts,
      coverage_note:
        "This result only covers the provided fixture files and requested static checks.",
    },
    disclaimer: SLOPPASS_DISCLAIMER,
  });

  return createPack(result, {
    mode: "fixture",
    generated_at: input.generated_at,
    scanner_source: input.scanner_source,
    smell_checks: smellCheckMetadata(checks),
    notes: input.notes,
  });
}
