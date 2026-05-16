export type MemoryTypedLinkRelation =
  | "authored"
  | "decided"
  | "references"
  | "ships"
  | "blocks"
  | "owns"
  | "relates_to";

export type MemoryTypedLinkTargetKind =
  | "person"
  | "todo"
  | "pr"
  | "commit"
  | "file"
  | "receipt"
  | "url"
  | "job"
  | "tool"
  | "unknown";

export type MemoryTypedLinkSourceKind = "fact" | "conversation_turn";
export type MemoryTypedLinkRedactionState = "clean" | "blocked_secret_risk";

export interface MemoryTypedLinkEvidenceSpan {
  start: number;
  end: number;
  text: string;
}

export interface MemoryTypedLinkCandidate {
  source_kind: MemoryTypedLinkSourceKind;
  source_id: string;
  relation: MemoryTypedLinkRelation;
  target_kind: MemoryTypedLinkTargetKind;
  target_text: string;
  confidence: number;
  evidence_span: MemoryTypedLinkEvidenceSpan;
  redaction_state: MemoryTypedLinkRedactionState;
}

export interface MemoryTypedLinkStoredRow {
  id: string;
  source_kind: MemoryTypedLinkSourceKind;
  source_id: string;
  relation: MemoryTypedLinkRelation;
  target_kind: MemoryTypedLinkTargetKind;
  target_text: string;
  confidence: number;
  evidence_start: number;
  evidence_end: number;
  evidence_text: string;
  redaction_state: MemoryTypedLinkRedactionState;
  created_at: string;
}

export interface MemoryTypedLinkSearchResult extends MemoryTypedLinkCandidate {
  id: string;
  created_at: string;
  match_score: number;
}

export interface ExtractMemoryTypedLinkCandidatesInput {
  source_kind: MemoryTypedLinkSourceKind;
  source_id: string;
  text: string;
}

interface LinkMatch {
  index: number;
  length: number;
  relation: MemoryTypedLinkRelation;
  target_kind: MemoryTypedLinkTargetKind;
  target_text: string;
  confidence: number;
}

const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const SECRET_HINT_PATTERN =
  /\b(?:secret|token|password|credential|private\s+key|api[_\s-]?key|plaintext|service[_\s-]?role|bearer)\b/i;
const SECRET_ASSIGNMENT_PATTERN =
  /\b(secret|token|password|credential|private\s+key|api[_\s-]?key|service[_\s-]?role|bearer)\s*[:=]\s*[^\s,;]+/gi;
const SECRET_VALUE_PATTERN = /\b(?:sk-[A-Za-z0-9_-]{10,}|ghp_[A-Za-z0-9_]{16,}|xox[baprs]-[A-Za-z0-9-]{12,})\b/g;

const TOOL_NAMES = [
  "Boardroom",
  "CommonSensePass",
  "FidelityPass",
  "Memory",
  "Orchestrator",
  "Passport",
  "SEOPass",
  "SlopPass",
  "TestPass",
  "UXPass",
  "XPass",
];

const RELATION_VERBS: Array<{ relation: MemoryTypedLinkRelation; pattern: RegExp; confidence: number }> = [
  {
    relation: "ships",
    pattern: /\b(?:merged|shipped|landed|released|opened)\b/i,
    confidence: 0.93,
  },
  {
    relation: "blocks",
    pattern: /\b(?:blocked|blocker|blocks|blocking)\b/i,
    confidence: 0.9,
  },
];

export function extractMemoryTypedLinkCandidates(
  input: ExtractMemoryTypedLinkCandidatesInput
): MemoryTypedLinkCandidate[] {
  const sourceId = input.source_id.trim();
  const text = input.text;

  if (!sourceId || !text.trim()) {
    return [];
  }

  const matches = [
    ...extractReferenceMatches(text),
    ...extractPersonRelationMatches(text),
    ...extractOwnershipMatches(text),
    ...extractBlockerMatches(text),
    ...extractToolMatches(text),
  ].sort(compareMatches);

  const candidates = matches
    .filter((match) => !isUnsafeTarget(match.target_text))
    .map((match) => buildCandidate(input.source_kind, sourceId, text, match));

  return dedupeCandidates(candidates);
}

export function filterAndRankMemoryTypedLinks(
  rows: MemoryTypedLinkStoredRow[],
  query: string,
  maxResults: number
): MemoryTypedLinkSearchResult[] {
  const normalizedQuery = normalizeSearchText(query);
  const limit = Math.max(1, Math.min(Math.floor(maxResults) || 10, 50));
  if (!normalizedQuery) return [];

  return rows
    .map((row) => memoryTypedLinkStoredRowToSearchResult(row, normalizedQuery))
    .filter((row) => row.match_score > 0)
    .sort(compareSearchResults)
    .slice(0, limit);
}

export function memoryTypedLinkStoredRowToCandidate(row: MemoryTypedLinkStoredRow): MemoryTypedLinkCandidate {
  return {
    source_kind: row.source_kind,
    source_id: row.source_id,
    relation: row.relation,
    target_kind: row.target_kind,
    target_text: row.target_text,
    confidence: row.confidence,
    evidence_span: {
      start: row.evidence_start,
      end: row.evidence_end,
      text: row.evidence_text,
    },
    redaction_state: row.redaction_state,
  };
}

function extractReferenceMatches(text: string): LinkMatch[] {
  const matches: LinkMatch[] = [];

  collectMatches(matches, text, /\b(?:PR|pull request)\s*#?(\d{1,6})\b/gi, (match) =>
    referenceMatch(text, match, "pr", `PR #${match[1]}`)
  );

  collectMatches(matches, text, /\bhttps?:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/(\d{1,6})[^\s<>"')]*?/gi, (match) =>
    referenceMatch(text, match, "pr", `PR #${match[1]}`)
  );

  collectMatches(matches, text, new RegExp(`\\b(?:todo|job|card)\\s+(${UUID_PATTERN})\\b`, "gi"), (match) =>
    referenceMatch(text, match, "todo", match[1].toLowerCase())
  );

  collectMatches(matches, text, new RegExp(`\\breceipt\\s+(${UUID_PATTERN})\\b`, "gi"), (match) =>
    referenceMatch(text, match, "receipt", match[1].toLowerCase())
  );

  collectMatches(matches, text, /\b(?:commit|sha)\s+([a-f0-9]{7,40})\b/gi, (match) =>
    referenceMatch(text, match, "commit", match[1].toLowerCase())
  );

  collectMatches(matches, text, /\bhttps?:\/\/[^\s<>"')]+/gi, (match) =>
    referenceMatch(text, match, "url", stripTrailingPunctuation(match[0]))
  );

  collectMatches(matches, text, /\b(?:packages|apps|src|docs|supabase|scripts|\.github)\/[A-Za-z0-9._/\\-]+/g, (match) =>
    referenceMatch(text, match, "file", stripTrailingPunctuation(match[0]).replace(/\\/g, "/"))
  );

  return matches;
}

function extractPersonRelationMatches(text: string): LinkMatch[] {
  const matches: LinkMatch[] = [];
  const personName = "([A-Z][A-Za-z0-9_ ]{1,40})";

  collectMatches(matches, text, new RegExp(`\\b${personName}\\s+(?:authored|wrote|created)\\b`, "g"), (match) => ({
    index: match.index ?? 0,
    length: match[0].length,
    relation: "authored",
    target_kind: "person",
    target_text: normalizePerson(match[1]),
    confidence: 0.78,
  }));

  collectMatches(matches, text, new RegExp(`\\b${personName}\\s+decided\\b`, "g"), (match) => ({
    index: match.index ?? 0,
    length: match[0].length,
    relation: "decided",
    target_kind: "person",
    target_text: normalizePerson(match[1]),
    confidence: 0.78,
  }));

  return matches;
}

function extractOwnershipMatches(text: string): LinkMatch[] {
  const matches: LinkMatch[] = [];

  collectMatches(matches, text, /\b(?:owner|owned by|assigned to|assignee)\s*[:=]?\s*([A-Za-z0-9_.-]{2,80})\b/gi, (match) => ({
    index: match.index ?? 0,
    length: match[0].length,
    relation: "owns",
    target_kind: "person",
    target_text: match[1].trim(),
    confidence: 0.8,
  }));

  return matches;
}

function extractBlockerMatches(text: string): LinkMatch[] {
  const matches: LinkMatch[] = [];

  collectMatches(matches, text, /\b(?:blocked by|blocker)\s*[:=]?\s*([^.;\n]{2,120})/gi, (match) => ({
    index: match.index ?? 0,
    length: match[0].length,
    relation: "blocks",
    target_kind: "unknown",
    target_text: stripTrailingPunctuation(match[1].trim()),
    confidence: 0.68,
  }));

  return matches;
}

function extractToolMatches(text: string): LinkMatch[] {
  const matches: LinkMatch[] = [];
  const toolPattern = new RegExp(`\\b(${TOOL_NAMES.join("|")})\\b`, "g");

  collectMatches(matches, text, toolPattern, (match) => ({
    index: match.index ?? 0,
    length: match[0].length,
    relation: "relates_to",
    target_kind: "tool",
    target_text: match[1],
    confidence: 0.72,
  }));

  return matches;
}

function collectMatches(
  sink: LinkMatch[],
  text: string,
  pattern: RegExp,
  toMatch: (match: RegExpExecArray) => LinkMatch
): void {
  for (const match of text.matchAll(pattern)) {
    sink.push(toMatch(match));
  }
}

function referenceMatch(
  text: string,
  match: RegExpExecArray,
  targetKind: MemoryTypedLinkTargetKind,
  targetText: string
): LinkMatch {
  const index = match.index ?? 0;
  const relation = relationFromContext(text, index, match[0].length, targetKind);

  return {
    index,
    length: match[0].length,
    relation: relation.relation,
    target_kind: targetKind,
    target_text: targetText,
    confidence: relation.confidence,
  };
}

function relationFromContext(
  text: string,
  index: number,
  length: number,
  targetKind: MemoryTypedLinkTargetKind
): { relation: MemoryTypedLinkRelation; confidence: number } {
  const span = sentenceSpan(text, index, length);
  const canUseVerbRelation = targetKind === "pr" || targetKind === "commit" || targetKind === "todo" || targetKind === "job";

  if (canUseVerbRelation) {
    for (const { relation, pattern, confidence } of RELATION_VERBS) {
      if (pattern.test(span.text)) {
        return { relation, confidence };
      }
    }
  }

  return { relation: "references", confidence: 0.9 };
}

function buildCandidate(
  sourceKind: MemoryTypedLinkSourceKind,
  sourceId: string,
  fullText: string,
  match: LinkMatch
): MemoryTypedLinkCandidate {
  const span = sentenceSpan(fullText, match.index, match.length);
  const redactionState = hasSecretRisk(span.text) ? "blocked_secret_risk" : "clean";

  return {
    source_kind: sourceKind,
    source_id: sourceId,
    relation: match.relation,
    target_kind: match.target_kind,
    target_text: match.target_text,
    confidence: match.confidence,
    evidence_span: {
      start: span.start,
      end: span.end,
      text: redactionState === "clean" ? span.text : redactEvidence(span.text),
    },
    redaction_state: redactionState,
  };
}

function sentenceSpan(text: string, index: number, length: number): MemoryTypedLinkEvidenceSpan {
  const boundaryBefore = Math.max(
    text.lastIndexOf(".", index - 1),
    text.lastIndexOf("!", index - 1),
    text.lastIndexOf("?", index - 1),
    text.lastIndexOf("\n", index - 1)
  );
  const boundaryAfter = firstBoundaryAfter(text, index + length);
  let start = boundaryBefore + 1;
  let end = boundaryAfter === -1 ? text.length : boundaryAfter + 1;

  while (start < end && /\s/.test(text[start])) {
    start += 1;
  }

  while (end > start && /\s/.test(text[end - 1])) {
    end -= 1;
  }

  return {
    start,
    end,
    text: text.slice(start, end),
  };
}

function firstBoundaryAfter(text: string, fromIndex: number): number {
  const candidates = [".", "!", "?", "\n"]
    .map((boundary) => text.indexOf(boundary, fromIndex))
    .filter((index) => index >= 0);

  return candidates.length === 0 ? -1 : Math.min(...candidates);
}

function hasSecretRisk(text: string): boolean {
  SECRET_ASSIGNMENT_PATTERN.lastIndex = 0;
  SECRET_VALUE_PATTERN.lastIndex = 0;
  return SECRET_HINT_PATTERN.test(text) || SECRET_ASSIGNMENT_PATTERN.test(text) || SECRET_VALUE_PATTERN.test(text);
}

function redactEvidence(text: string): string {
  SECRET_ASSIGNMENT_PATTERN.lastIndex = 0;
  SECRET_VALUE_PATTERN.lastIndex = 0;
  return text
    .replace(SECRET_ASSIGNMENT_PATTERN, (_value, label: string) => `${label}=[redacted]`)
    .replace(SECRET_VALUE_PATTERN, "[redacted]");
}

function isUnsafeTarget(targetText: string): boolean {
  SECRET_ASSIGNMENT_PATTERN.lastIndex = 0;
  SECRET_VALUE_PATTERN.lastIndex = 0;
  return SECRET_ASSIGNMENT_PATTERN.test(targetText) || SECRET_VALUE_PATTERN.test(targetText);
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[),.;:]+$/g, "");
}

function normalizePerson(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function memoryTypedLinkStoredRowToSearchResult(
  row: MemoryTypedLinkStoredRow,
  normalizedQuery: string
): MemoryTypedLinkSearchResult {
  return {
    ...memoryTypedLinkStoredRowToCandidate(row),
    id: row.id,
    created_at: row.created_at,
    match_score: scoreStoredTypedLink(row, normalizedQuery),
  };
}

function scoreStoredTypedLink(row: MemoryTypedLinkStoredRow, normalizedQuery: string): number {
  const target = normalizeSearchText(row.target_text);
  const evidence = normalizeSearchText(row.evidence_text);
  const relation = normalizeSearchText(row.relation);
  const targetKind = normalizeSearchText(row.target_kind);
  const sourceKind = normalizeSearchText(row.source_kind);
  const terms = normalizedQuery.split(" ").filter(Boolean);
  let score = 0;

  if (target === normalizedQuery) score += 100;
  if (target.includes(normalizedQuery)) score += 80;
  if (evidence.includes(normalizedQuery)) score += 45;
  if (relation === normalizedQuery || targetKind === normalizedQuery || sourceKind === normalizedQuery) score += 30;

  for (const term of terms) {
    if (target.includes(term)) score += 12;
    if (evidence.includes(term)) score += 5;
    if (relation === term || targetKind === term || sourceKind === term) score += 4;
  }

  if (score > 0) score += Math.max(0, Math.min(row.confidence, 1)) * 10;
  return Number(score.toFixed(3));
}

function compareSearchResults(left: MemoryTypedLinkSearchResult, right: MemoryTypedLinkSearchResult): number {
  const scoreDelta = right.match_score - left.match_score;
  if (scoreDelta !== 0) return scoreDelta;
  const dateDelta = new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  if (dateDelta !== 0) return dateDelta;
  return left.id.localeCompare(right.id);
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function compareMatches(left: LinkMatch, right: LinkMatch): number {
  return (
    left.index - right.index ||
    left.relation.localeCompare(right.relation) ||
    left.target_kind.localeCompare(right.target_kind) ||
    left.target_text.localeCompare(right.target_text)
  );
}

function dedupeCandidates(candidates: MemoryTypedLinkCandidate[]): MemoryTypedLinkCandidate[] {
  const seen = new Set<string>();
  const deduped: MemoryTypedLinkCandidate[] = [];

  for (const candidate of candidates) {
    const key = [
      candidate.source_kind,
      candidate.source_id,
      candidate.relation,
      candidate.target_kind,
      candidate.target_text.toLowerCase(),
    ].join(":");

    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(candidate);
    }
  }

  return deduped;
}
