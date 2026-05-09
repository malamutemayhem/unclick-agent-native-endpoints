import type { JurisdictionCode } from "./types.js";
import type {
  LegalPassHatDefinition,
  LegalPassPhaseOneHatId,
} from "./schema.js";

export const PHASE_ONE_JURISDICTIONS: JurisdictionCode[] = [
  "AU",
  "EU",
  "US-CA",
];

export const PHASE_ONE_LEGALPASS_HATS: LegalPassHatDefinition[] = [
  {
    id: "privacy-policy",
    label: "Privacy Policy",
    summary:
      "Issue-spots whether a public privacy policy exposes basic identity, data-use, retention, transfer, and contact signals.",
    target_documents: ["privacy-policy", "website"],
    jurisdictions: PHASE_ONE_JURISDICTIONS,
    checks: [
      {
        id: "privacy-controller-contact",
        label: "Controller or operator contact path",
        severity: "high",
        evidence_kinds: ["policy-text", "public-page", "fixture"],
        fixture_terms: ["contact", "privacy"],
        issue_spotting_note:
          "A privacy review often starts with whether a reader can identify a privacy contact path.",
      },
      {
        id: "privacy-data-use",
        label: "Data collection and use disclosure",
        severity: "high",
        evidence_kinds: ["policy-text", "fixture"],
        fixture_terms: ["collect", "use"],
        issue_spotting_note:
          "The policy text warrants review when collection and use signals are absent from the public copy.",
      },
      {
        id: "privacy-retention-transfer",
        label: "Retention or transfer disclosure",
        severity: "medium",
        evidence_kinds: ["policy-text", "fixture"],
        fixture_terms: ["retain", "third party"],
        issue_spotting_note:
          "Retention and third-party transfer language is a common issue-spotting input for privacy review.",
      },
    ],
  },
  {
    id: "tos-unfair-terms",
    label: "ToS and Unfair Terms",
    summary:
      "Issue-spots public terms for consumer-facing limitation, variation, termination, and dispute signals.",
    target_documents: ["terms-of-service", "website"],
    jurisdictions: PHASE_ONE_JURISDICTIONS,
    checks: [
      {
        id: "tos-liability-indemnity",
        label: "Liability and indemnity visibility",
        severity: "high",
        evidence_kinds: ["clause", "fixture"],
        fixture_terms: ["liability", "indemnity"],
        issue_spotting_note:
          "Liability and indemnity clauses are common review targets in consumer and platform terms.",
      },
      {
        id: "tos-variation-termination",
        label: "Variation or termination signal",
        severity: "medium",
        evidence_kinds: ["clause", "fixture"],
        fixture_terms: ["terminate", "change"],
        issue_spotting_note:
          "Variation and termination wording can affect unfair-terms review and warrants practitioner attention when unclear.",
      },
      {
        id: "tos-dispute-contact",
        label: "Dispute or support contact path",
        severity: "medium",
        evidence_kinds: ["clause", "fixture"],
        fixture_terms: ["dispute", "support"],
        issue_spotting_note:
          "A dispute or support path helps route a reader before any formal action is considered.",
      },
    ],
  },
  {
    id: "oss-licence",
    label: "OSS Licence",
    summary:
      "Issue-spots repository or manifest fixtures for licence, attribution, copyleft, and patent-notice signals.",
    target_documents: ["oss-manifest", "licence-file", "repository"],
    jurisdictions: PHASE_ONE_JURISDICTIONS,
    checks: [
      {
        id: "oss-manifest-licence",
        label: "Dependency licence manifest",
        severity: "high",
        evidence_kinds: ["package-manifest", "licence-file", "fixture"],
        fixture_terms: ["license", "dependency"],
        issue_spotting_note:
          "Licence and dependency manifests are baseline evidence for OSS review.",
      },
      {
        id: "oss-attribution-copyleft",
        label: "Attribution or copyleft marker",
        severity: "medium",
        evidence_kinds: ["licence-file", "fixture"],
        fixture_terms: ["attribution", "copyleft"],
        issue_spotting_note:
          "Attribution and copyleft markers can change downstream notice obligations.",
      },
      {
        id: "oss-patent-notice",
        label: "Patent or notice signal",
        severity: "low",
        evidence_kinds: ["licence-file", "fixture"],
        fixture_terms: ["patent", "notice"],
        issue_spotting_note:
          "Patent and notice language is a useful input for licence-compatibility review.",
      },
    ],
  },
];

export interface GetPhaseOneLegalPassHatsInput {
  hat_ids?: LegalPassPhaseOneHatId[];
  jurisdictions?: JurisdictionCode[];
}

export function getPhaseOneLegalPassHats(
  input: GetPhaseOneLegalPassHatsInput = {},
): LegalPassHatDefinition[] {
  const hatIdSet = input.hat_ids ? new Set(input.hat_ids) : null;
  const jurisdictionSet = input.jurisdictions ? new Set(input.jurisdictions) : null;

  return PHASE_ONE_LEGALPASS_HATS.filter((hat) => {
    if (hatIdSet && !hatIdSet.has(hat.id)) {
      return false;
    }

    if (!jurisdictionSet) {
      return true;
    }

    return hat.jurisdictions.some((jurisdiction) => jurisdictionSet.has(jurisdiction));
  });
}
