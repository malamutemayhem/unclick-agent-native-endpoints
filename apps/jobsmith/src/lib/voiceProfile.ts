// apps/jobsmith/src/lib/voiceProfile.ts
//
// Statistical voice signal extracted from a Corpus.
// v0 is purely heuristic — no LLM. Used as templating input for renderDraft.

import type { Corpus, CoverLetter } from "./ingestCvCorpus";

export interface VoiceProfile {
  frequentPhrases: PhraseFreq[];
  openingFormulas: string[];
  closingFormulas: string[];
  signoffFormulas: string[];
  roleTypes: string[];
  pastBrands: string[];
  tonalAdjectives: string[];
  locationStatement: string | null;
  flexibilityStatement: string | null;
}

export interface PhraseFreq {
  phrase: string;
  count: number;
  sampleContext: string;
}

const SEED_BRANDS = [
  "Paslode",
  "Stockade",
  "Danley",
  "Reed",
  "Rinnai",
  "Brivis",
  "ITW",
  "Illinois Tool Works",
  "DMI",
  "Digital Motorworks",
  "VMS",
  "Mud Map",
  "Tag 'n' Trade",
  "Malamute Mayhem",
];

const TONAL_ADJECTIVES = [
  "innovative",
  "creative",
  "strategic",
  "compelling",
  "engaging",
  "versatile",
  "dynamic",
  "passionate",
  "meticulous",
  "collaborative",
];

const OPENING_RES: RegExp[] = [
  /^I am (pleased|excited|writing|thrilled|reaching out|applying|interested|drawn) /i,
  /^I would like to express /i,
];

const CLOSING_RES: RegExp[] = [
  /Thank you for considering/i,
  /I look forward to /i,
  /I am (excited|eager) about /i,
];

const SIGNOFF_RES: RegExp[] = [
  /(Sincerely|Best regards|Kind regards|Yours sincerely),?\s*$/i,
];

const STOPWORD_SET = new Set([
  "the", "and", "a", "an", "to", "of", "in", "for", "on", "with",
  "is", "are", "be", "been", "being", "this", "that", "it", "its",
  "as", "at", "by", "from", "or", "but", "if", "so", "we", "i",
  "you", "your", "my", "me", "have", "has", "had", "will", "would",
  "can", "could", "should", "do", "did", "does", "not",
]);

export function buildVoiceProfile(corpus: Corpus): VoiceProfile {
  const txtLetters = corpus.coverLetters.filter(
    (cl) => cl.format === "txt" && cl.textContent,
  ) as Array<CoverLetter & { textContent: string }>;

  const promptText = corpus.promptTemplate ?? "";
  const combinedTexts: string[] = [
    ...txtLetters.map((cl) => cl.textContent),
    promptText,
  ].filter((t) => t && t.length > 0);

  const frequentPhrases = extractFrequentPhrases(combinedTexts, 25);

  const openingFormulas = extractMatchingFirstLines(combinedTexts, OPENING_RES, 5);
  const closingFormulas = extractMatchingLastLines(combinedTexts, CLOSING_RES, 5);
  const signoffFormulas = extractMatchingLastLines(combinedTexts, SIGNOFF_RES, 3);

  const roleTypes = uniqueSorted(
    corpus.jobsApplied
      .map((j) => normaliseRole(j.role))
      .filter((r): r is string => Boolean(r)),
  );

  const pastBrands = uniqueSorted(
    findSeededOccurrences(combinedTexts, SEED_BRANDS),
  );

  const tonalAdjectives = uniqueSorted(
    findSeededOccurrences(combinedTexts, TONAL_ADJECTIVES),
  );

  const locationStatement = extractLocationStatement(combinedTexts);
  const flexibilityStatement = extractFlexibilityStatement(combinedTexts);

  return {
    frequentPhrases,
    openingFormulas,
    closingFormulas,
    signoffFormulas,
    roleTypes,
    pastBrands,
    tonalAdjectives,
    locationStatement,
    flexibilityStatement,
  };
}

function extractFrequentPhrases(texts: string[], topN: number): PhraseFreq[] {
  const counts = new Map<string, number>();
  const samples = new Map<string, string>();
  for (const t of texts) {
    const tokens = tokenize(t);
    for (const window of [5, 7]) {
      for (let i = 0; i + window <= tokens.length; i += 1) {
        const slice = tokens.slice(i, i + window);
        if (slice.every((w) => STOPWORD_SET.has(w.toLowerCase()))) continue;
        const phrase = slice.join(" ");
        counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
        if (!samples.has(phrase)) {
          samples.set(phrase, sliceContext(t, slice.join(" ")));
        }
      }
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([phrase, count]) => ({
      phrase,
      count,
      sampleContext: samples.get(phrase) ?? "",
    }));
}

function tokenize(text: string): string[] {
  return text
    .split(/[^A-Za-z0-9']+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function sliceContext(text: string, phrase: string): string {
  const idx = text.toLowerCase().indexOf(phrase.toLowerCase());
  if (idx < 0) return phrase;
  const start = Math.max(0, idx - 20);
  const end = Math.min(text.length, idx + phrase.length + 20);
  return text.slice(start, end).trim();
}

function extractMatchingFirstLines(
  texts: string[],
  patterns: RegExp[],
  max: number,
): string[] {
  const result = new Set<string>();
  for (const t of texts) {
    const lines = splitLetterLines(t);
    for (const line of lines.slice(0, 5)) {
      for (const re of patterns) {
        if (re.test(line)) {
          result.add(trimSentence(line));
          if (result.size >= max) return [...result];
        }
      }
    }
  }
  return [...result];
}

function extractMatchingLastLines(
  texts: string[],
  patterns: RegExp[],
  max: number,
): string[] {
  const result = new Set<string>();
  for (const t of texts) {
    const lines = splitLetterLines(t).slice(-8);
    for (const line of lines) {
      for (const re of patterns) {
        if (re.test(line)) {
          result.add(trimSentence(line));
          if (result.size >= max) return [...result];
        }
      }
    }
  }
  return [...result];
}

function splitLetterLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function trimSentence(line: string): string {
  const m = line.match(/^([^.!?]*[.!?])/);
  return (m ? m[1] : line).trim();
}

function findSeededOccurrences(texts: string[], seeds: string[]): string[] {
  const result = new Set<string>();
  for (const t of texts) {
    const lower = t.toLowerCase();
    for (const seed of seeds) {
      if (lower.includes(seed.toLowerCase())) {
        result.add(seed);
      }
    }
  }
  return [...result];
}

function normaliseRole(role: string | null): string | null {
  if (!role) return null;
  return role
    .trim()
    .replace(/\.txt$|\.md$/i, "")
    .replace(/\s+/g, " ");
}

function uniqueSorted<T>(arr: T[]): T[] {
  return [...new Set(arr)].sort();
}

function extractLocationStatement(texts: string[]): string | null {
  const re = /(based|located)\s+in\s+(victoria|sandhurst|melbourne|vic)[^.]*\./i;
  for (const t of texts) {
    const m = t.match(re);
    if (m) return m[0].trim();
  }
  return null;
}

function extractFlexibilityStatement(texts: string[]): string | null {
  const re = /(remote|hybrid|flexible|travel|contract)[^.]*\./i;
  const candidates: string[] = [];
  for (const t of texts) {
    const lines = splitLetterLines(t);
    for (const line of lines) {
      if (re.test(line) && /(work|arrangement|model|partnership)/i.test(line)) {
        candidates.push(line);
      }
    }
  }
  return candidates[0] ?? null;
}
