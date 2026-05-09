import type { JurisdictionCode } from "./types.js";
import { getPhaseOneLegalPassHats } from "./hat-library.js";
import {
  LegalPassFixtureDocumentSchema,
  LegalPassReportSchema,
  type LegalPassFixtureDocument,
  type LegalPassFixtureDocumentInput,
  type LegalPassGeoPassAdapter,
  type LegalPassHatDefinition,
  type LegalPassHatResult,
  type LegalPassReport,
  type LegalPassReportVerdict,
  type LegalPassTarget,
} from "./schema.js";

const ISSUE_SPOTTER_DISCLAIMER =
  "LegalPass is an issue-spotter only. It surfaces public signals for review and is not a lawyer, legal opinion, or substitute for a qualified practitioner.";

export interface CreateLegalPassVerdictPackInput {
  target: LegalPassTarget;
  jurisdictions?: JurisdictionCode[];
  generated_at?: string;
  geo_pass?: LegalPassGeoPassAdapter;
}

export interface CreateFixtureLegalPassReportInput extends CreateLegalPassVerdictPackInput {
  documents: LegalPassFixtureDocumentInput[];
}

export function createLegalPassVerdictPack(
  input: CreateLegalPassVerdictPackInput,
): LegalPassReport {
  const jurisdictions = input.jurisdictions ?? ["AU", "EU", "US-CA"];
  const hats = getPhaseOneLegalPassHats({ jurisdictions });
  const report = {
    target: input.target,
    generated_at: input.generated_at ?? new Date().toISOString(),
    mode: "plan-only" as const,
    jurisdictions,
    overall_score: 0,
    verdict: "unknown" as const,
    hats: hats.map(createPlanOnlyHatResult),
    scanner_source: {
      kind: input.geo_pass ? "geopass-plan" as const : "manual" as const,
      mode: input.geo_pass?.mode ?? "plan-only" as const,
      target_url: input.geo_pass?.target_url ?? input.target.url,
      shared_check_ids: input.geo_pass?.shared_check_ids ?? [],
    },
    disclaimers: [ISSUE_SPOTTER_DISCLAIMER],
    notes: [
      "Plan-only LegalPass pack. No private contracts, production rows, paid calls, or live legal review were used.",
    ],
  };

  return LegalPassReportSchema.parse(report);
}

export function createFixtureLegalPassReport(
  input: CreateFixtureLegalPassReportInput,
): LegalPassReport {
  const jurisdictions = input.jurisdictions ?? ["AU", "EU", "US-CA"];
  const documents = input.documents.map((document) =>
    LegalPassFixtureDocumentSchema.parse(document),
  );
  const hats = getPhaseOneLegalPassHats({ jurisdictions });
  const hatResults = hats.map((hat) => evaluateHatAgainstFixtures(hat, documents));
  const overall_score = Math.round(
    hatResults.reduce((total, result) => total + result.score, 0) / hatResults.length,
  );
  const report = {
    target: input.target,
    generated_at: input.generated_at ?? new Date().toISOString(),
    mode: "fixture" as const,
    jurisdictions,
    overall_score,
    verdict: toReportVerdict(hatResults),
    hats: hatResults,
    scanner_source: {
      kind: "fixture" as const,
      mode: "fixture" as const,
      target_url: input.geo_pass?.target_url ?? input.target.url,
      shared_check_ids: input.geo_pass?.shared_check_ids ?? [],
    },
    disclaimers: [ISSUE_SPOTTER_DISCLAIMER],
    notes: [
      "Fixture-only LegalPass report. Findings are deterministic text signals and require human practitioner review before action.",
    ],
  };

  return LegalPassReportSchema.parse(report);
}

function createPlanOnlyHatResult(hat: LegalPassHatDefinition): LegalPassHatResult {
  return {
    hat_id: hat.id,
    label: hat.label,
    score: 0,
    verdict: "unknown",
    findings: [],
    comments: [
      `${hat.label} is configured for fixture and read-only evidence collection.`,
    ],
  };
}

function evaluateHatAgainstFixtures(
  hat: LegalPassHatDefinition,
  documents: LegalPassFixtureDocument[],
): LegalPassHatResult {
  const relevantDocuments = documents.filter((document) =>
    (document.public_only ?? true) && hat.target_documents.includes(document.kind),
  );
  const searchableText = normalizeText(
    relevantDocuments.map((document) => document.text).join(" "),
  );
  const findings = hat.checks.flatMap((check) => {
    const matchedTerms = check.fixture_terms.filter((term) =>
      searchableText.includes(normalizeText(term)),
    );

    if (matchedTerms.length > 0) {
      return [];
    }

    return [
      {
        id: `${hat.id}.${check.id}.missing-fixture-signal`,
        hat_id: hat.id,
        severity: check.severity,
        title: `${check.label} fixture signal missing`,
        summary:
          "The provided public fixture text did not include the configured issue-spotting signal.",
        evidence: relevantDocuments.map((document) => ({
          kind: "fixture" as const,
          label: document.title,
          source_url: document.source_url,
          summary: `Checked public fixture document ${document.id}.`,
        })),
        issue_spotting_note: check.issue_spotting_note,
        practitioner_review_flag: check.severity === "critical" || check.severity === "high",
      },
    ];
  });

  const passingChecks = hat.checks.length - findings.length;
  const score = Math.round((passingChecks / hat.checks.length) * 100);

  return {
    hat_id: hat.id,
    label: hat.label,
    score,
    verdict: toHatVerdict(score, findings.length),
    findings,
    comments: [
      `Evaluated ${relevantDocuments.length} public fixture document(s) for ${hat.label}.`,
    ],
  };
}

function toHatVerdict(score: number, findingCount: number): LegalPassHatResult["verdict"] {
  if (findingCount === 0) {
    return "pass";
  }

  if (score >= 50) {
    return "warn";
  }

  return "fail";
}

function toReportVerdict(hats: LegalPassHatResult[]): LegalPassReportVerdict {
  if (hats.every((hat) => hat.verdict === "pass")) {
    return "ready";
  }

  if (hats.some((hat) => hat.verdict === "fail")) {
    return "blocked";
  }

  if (hats.some((hat) => hat.verdict === "warn")) {
    return "needs-review";
  }

  return "unknown";
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim();
}
