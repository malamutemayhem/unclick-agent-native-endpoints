import {
  CopyPassCheckDefinitionSchema,
  type CopyPassCheckDefinition,
  type CopyPassCheckId,
  type CopyPassCopyBlock,
  type CopyPassFinding,
} from "./schema.js";

export const DEFAULT_COPYPASS_CHECKS: CopyPassCheckDefinition[] = [
  {
    id: "value-prop-clarity",
    label: "Value prop clarity",
    goal: "Hero and headline copy should say who it helps and what changes for them.",
    severity: "medium",
    recommended_fix:
      "Rewrite the line with a concrete audience, action, and outcome instead of broad platform language.",
  },
  {
    id: "cta-presence",
    label: "CTA presence",
    goal: "Hero and CTA blocks should include a clear next action.",
    severity: "medium",
    recommended_fix:
      "Add one direct call to action, such as Start, Try, Connect, Run, Book, or Open.",
  },
  {
    id: "proof-trust-gap",
    label: "Proof or trust signal",
    goal: "Primary copy should include a proof, safety, privacy, receipt, or trust signal.",
    severity: "low",
    recommended_fix:
      "Add a concrete receipt, customer proof, safety note, privacy note, or public evidence signal.",
  },
  {
    id: "unsupported-superiority",
    label: "Unsupported superiority",
    goal: "Absolute or superiority claims should have public proof before they ship.",
    severity: "high",
    recommended_fix:
      "Replace the absolute claim with a qualified claim, or attach public proof in nearby copy.",
  },
  {
    id: "placeholder-copy",
    label: "Placeholder language",
    goal: "Shipped copy should not contain stale placeholders or drafting markers.",
    severity: "medium",
    recommended_fix:
      "Replace the placeholder with final copy or remove the block until the message is ready.",
  },
  {
    id: "risky-guarantee-language",
    label: "Risky guarantee language",
    goal: "Copy should avoid guarantees around revenue, rankings, compliance, access, or outcomes.",
    severity: "high",
    recommended_fix:
      "Use advisory, evidence-backed language and remove outcome guarantees.",
  },
].map((check) => CopyPassCheckDefinitionSchema.parse(check));

const VALUE_TERMS = [
  "helps",
  "ship",
  "review",
  "scan",
  "find",
  "reduce",
  "save",
  "protect",
  "connect",
  "context",
  "proof",
  "receipts",
  "checks",
  "workflow",
];

const VAGUE_TERMS = [
  "all-in-one",
  "game changing",
  "next generation",
  "next-gen",
  "powerful",
  "revolutionary",
  "simple",
  "smart",
  "solution",
  "transform",
  "world class",
];

const CTA_TERMS = [
  "book",
  "connect",
  "create",
  "get",
  "join",
  "open",
  "run",
  "scan",
  "start",
  "try",
];

const PROOF_TERMS = [
  "audit",
  "case study",
  "check",
  "customer",
  "evidence",
  "privacy",
  "proof",
  "receipt",
  "security",
  "trusted",
  "verified",
];

const SUPERIORITY_TERMS = [
  "#1",
  "best",
  "industry leading",
  "leading",
  "most advanced",
  "number one",
  "revolutionary",
  "ultimate",
];

const PLACEHOLDER_TERMS = [
  "coming soon",
  "copy goes here",
  "insert copy",
  "lorem ipsum",
  "placeholder",
  "tbd",
  "todo",
];

const GUARANTEE_TERMS = [
  "100%",
  "always",
  "compliance guaranteed",
  "guaranteed",
  "instant revenue",
  "never fail",
  "rank #1",
  "risk-free",
];

const SENSITIVE_COPY_PATTERN =
  /\b(api[_ -]?key|bearer|password|secret|sk-[a-z0-9_-]{8,}|token)\b/i;

export function getDefaultCopyPassChecks(): CopyPassCheckDefinition[] {
  return DEFAULT_COPYPASS_CHECKS.map((check) => ({ ...check }));
}

export function detectCopyPassFindings(
  blocks: CopyPassCopyBlock[],
  checks: CopyPassCheckDefinition[] = DEFAULT_COPYPASS_CHECKS,
): CopyPassFinding[] {
  const activeCheckIds = new Set(checks.map((check) => check.id));
  const checkById = new Map(checks.map((check) => [check.id, check]));

  return blocks.flatMap((block) => {
    const normalized = normalizeCopy(block.text);
    const findings: CopyPassFinding[] = [];

    if (
      isActive(activeCheckIds, "value-prop-clarity") &&
      isPrimaryBlock(block) &&
      containsAny(normalized, VAGUE_TERMS) &&
      !containsAny(normalized, VALUE_TERMS)
    ) {
      findings.push(
        createFinding(
          block,
          requireCheck(checkById, "value-prop-clarity"),
          "Primary copy lacks a concrete value prop",
          "The copy leans on broad language without clearly naming the user, action, and outcome.",
        ),
      );
    }

    if (
      isActive(activeCheckIds, "cta-presence") &&
      (block.kind === "hero" || block.kind === "cta") &&
      !containsAny(normalized, CTA_TERMS)
    ) {
      findings.push(
        createFinding(
          block,
          requireCheck(checkById, "cta-presence"),
          "Primary copy is missing a clear CTA",
          "The block does not include a direct next action.",
        ),
      );
    }

    if (
      isActive(activeCheckIds, "proof-trust-gap") &&
      (block.kind === "hero" || block.kind === "proof" || block.kind === "pricing") &&
      !containsAny(normalized, PROOF_TERMS)
    ) {
      findings.push(
        createFinding(
          block,
          requireCheck(checkById, "proof-trust-gap"),
          "Primary copy is missing a trust signal",
          "The block does not show proof, safety, privacy, receipt, or public evidence language.",
        ),
      );
    }

    if (
      isActive(activeCheckIds, "unsupported-superiority") &&
      containsAny(normalized, SUPERIORITY_TERMS) &&
      !containsAny(normalized, PROOF_TERMS)
    ) {
      findings.push(
        createFinding(
          block,
          requireCheck(checkById, "unsupported-superiority"),
          "Superiority claim needs proof",
          "The copy uses an absolute or superiority phrase without a nearby proof signal.",
        ),
      );
    }

    if (
      isActive(activeCheckIds, "placeholder-copy") &&
      containsAny(normalized, PLACEHOLDER_TERMS)
    ) {
      findings.push(
        createFinding(
          block,
          requireCheck(checkById, "placeholder-copy"),
          "Placeholder copy detected",
          "The block contains drafting language that should not ship.",
        ),
      );
    }

    if (
      isActive(activeCheckIds, "risky-guarantee-language") &&
      containsAny(normalized, GUARANTEE_TERMS)
    ) {
      findings.push(
        createFinding(
          block,
          requireCheck(checkById, "risky-guarantee-language"),
          "Outcome guarantee language detected",
          "The copy appears to promise a fixed result, access, compliance, revenue, or ranking outcome.",
        ),
      );
    }

    return findings;
  });
}

export function normalizeCopy(value: string): string {
  return value.toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim();
}

function isPrimaryBlock(block: CopyPassCopyBlock): boolean {
  return block.kind === "hero" || block.kind === "headline";
}

function isActive(activeCheckIds: Set<CopyPassCheckId>, checkId: CopyPassCheckId): boolean {
  return activeCheckIds.has(checkId);
}

function containsAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function requireCheck(
  checkById: Map<CopyPassCheckId, CopyPassCheckDefinition>,
  checkId: CopyPassCheckId,
): CopyPassCheckDefinition {
  const check = checkById.get(checkId);
  if (!check) {
    throw new Error(`CopyPass check ${checkId} is not configured.`);
  }
  return check;
}

function createFinding(
  block: CopyPassCopyBlock,
  check: CopyPassCheckDefinition,
  title: string,
  summary: string,
): CopyPassFinding {
  return {
    id: `${block.id}.${check.id}`,
    check_id: check.id,
    severity: check.severity,
    title,
    summary,
    evidence: redactEvidence(block.text),
    suggested_fix: check.recommended_fix,
    block_id: block.id,
    source_path: block.source_path,
    source_url: block.source_url,
  };
}

function redactEvidence(value: string): string {
  if (SENSITIVE_COPY_PATTERN.test(value)) {
    return "[redacted-sensitive-copy-fragment]";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, 220);
}
