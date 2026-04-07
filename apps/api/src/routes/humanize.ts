/**
 * UnClick Humanize - rule-based AI text humanizer.
 *
 * All endpoints sit under /v1/humanize and inherit the global auth + rate-limit
 * middleware; no external AI API calls are made.
 *
 * Scope: humanize:use
 *
 *   POST /v1/humanize/rewrite  - rewrite AI text to sound more natural
 *   POST /v1/humanize/detect   - score text for AI-writing patterns (0-100)
 *   POST /v1/humanize/suggest  - return specific improvement suggestions
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { ok } from '@unclick/core';
import { zv } from '../middleware/validate.js';
import type { AppVariables } from '../middleware/types.js';
import { requireScope } from '../middleware/auth.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const RewriteSchema = z.object({
  text: z.string().min(1).max(50_000),
  tone: z.enum(['casual', 'professional', 'conversational']).default('conversational'),
  strength: z.enum(['light', 'medium', 'heavy']).default('medium'),
});

const DetectSchema = z.object({
  text: z.string().min(1).max(50_000),
});

const SuggestSchema = z.object({
  text: z.string().min(1).max(50_000),
});

// ---------------------------------------------------------------------------
// Word replacement maps
// ---------------------------------------------------------------------------

// Each entry: [ai_word, replacements_by_tone]
// tone order: casual, professional, conversational
const WORD_MAP: [RegExp, Record<string, string>][] = [
  [/\bdelve\b/gi,         { casual: 'dig', professional: 'explore', conversational: 'look into' }],
  [/\btapestry\b/gi,      { casual: 'mix', professional: 'combination', conversational: 'mix' }],
  [/\blandscape\b/gi,     { casual: 'field', professional: 'field', conversational: 'area' }],
  [/\bleverage\b/gi,      { casual: 'use', professional: 'use', conversational: 'use' }],
  [/\brobust\b/gi,        { casual: 'solid', professional: 'strong', conversational: 'solid' }],
  [/\bseamless\b/gi,      { casual: 'smooth', professional: 'smooth', conversational: 'smooth' }],
  [/\bcutting-edge\b/gi,  { casual: 'new', professional: 'modern', conversational: 'new' }],
  [/\bparadigm\b/gi,      { casual: 'approach', professional: 'model', conversational: 'approach' }],
  [/\bsynergy\b/gi,       { casual: 'teamwork', professional: 'collaboration', conversational: 'working together' }],
  [/\bholistic\b/gi,      { casual: 'full', professional: 'comprehensive', conversational: 'overall' }],
  [/\bstreamline\b/gi,    { casual: 'simplify', professional: 'simplify', conversational: 'simplify' }],
  [/\binnovative\b/gi,    { casual: 'new', professional: 'novel', conversational: 'new' }],
  [/\butilize\b/gi,       { casual: 'use', professional: 'use', conversational: 'use' }],
  [/\bfurthermore\b/gi,   { casual: 'also', professional: 'additionally', conversational: 'also' }],
  [/\bmoreover\b/gi,      { casual: 'plus', professional: 'in addition', conversational: 'also' }],
  [/\bcomprehensive\b/gi, { casual: 'full', professional: 'thorough', conversational: 'thorough' }],
  [/\bmultifaceted\b/gi,  { casual: 'complex', professional: 'complex', conversational: 'varied' }],
  [/\bpivotal\b/gi,       { casual: 'key', professional: 'critical', conversational: 'key' }],
  [/\bcrucial\b/gi,       { casual: 'key', professional: 'critical', conversational: 'important' }],
  [/\bfoster\b/gi,        { casual: 'build', professional: 'cultivate', conversational: 'build' }],
  [/\bharness\b/gi,       { casual: 'use', professional: 'use', conversational: 'tap into' }],
  [/\bnavigate\b/gi,      { casual: 'handle', professional: 'manage', conversational: 'deal with' }],
  [/\bspearhead\b/gi,     { casual: 'lead', professional: 'lead', conversational: 'lead' }],
  [/\bunderscore\b/gi,    { casual: 'show', professional: 'highlight', conversational: 'highlight' }],
  [/\brealm\b/gi,         { casual: 'area', professional: 'domain', conversational: 'area' }],
  [/\bfacilitate\b/gi,    { casual: 'help', professional: 'enable', conversational: 'help' }],
  [/\boptimize\b/gi,      { casual: 'improve', professional: 'improve', conversational: 'improve' }],
  [/\benhancing\b/gi,     { casual: 'improving', professional: 'improving', conversational: 'improving' }],
  [/\baforementioned\b/gi,{ casual: 'this', professional: 'the above', conversational: 'this' }],
  [/\bnoteworthy\b/gi,    { casual: 'worth noting', professional: 'significant', conversational: 'worth noting' }],
];

// Excessive adverbs to strip
const ADVERB_PATTERNS: RegExp[] = [
  /\bsignificantly\b/gi,
  /\bfundamentally\b/gi,
  /\bessentially\b/gi,
  /\binherently\b/gi,
  /\bsubstantially\b/gi,
  /\bprofoundly\b/gi,
  /\bmarkedly\b/gi,
  /\bstrikingly\b/gi,
  /\bundeniably\b/gi,
  /\birrefutably\b/gi,
];

// Hedging phrases to remove
const HEDGING_PATTERNS: [RegExp, string][] = [
  [/It(?:'s| is) important to note that[,\s]*/gi, ''],
  [/It(?:'s| is) worth (noting|mentioning) that[,\s]*/gi, ''],
  [/It should be noted that[,\s]*/gi, ''],
  [/It(?:'s| is) (also )?worth (pointing out|emphasizing) that[,\s]*/gi, ''],
  [/One must (also )?consider that[,\s]*/gi, ''],
  [/Needless to say[,\s]*/gi, ''],
  [/It goes without saying that[,\s]*/gi, ''],
  [/As (previously|mentioned) (stated|noted|discussed)[,\s]*/gi, ''],
];

// Filler transitions to strip
const FILLER_PATTERNS: [RegExp, string][] = [
  [/In today's (rapidly evolving|fast-paced|ever-changing|modern|digital) (world|landscape|environment|era)[,\s]*/gi, ''],
  [/In the (rapidly evolving|fast-paced|ever-changing|modern|digital) (world|landscape|environment|era)[,\s]*/gi, ''],
  [/In an (increasingly|ever-changing) (complex|digital|connected) (world|landscape)[,\s]*/gi, ''],
  [/At the end of the day[,\s]*/gi, ''],
  [/When all is said and done[,\s]*/gi, ''],
  [/The fact of the matter is[,\s]*/gi, ''],
  [/In light of (this|these) (considerations?|factors?)?[,\s]*/gi, ''],
];

// Contraction pairs: [expanded, contraction]
const CONTRACTIONS: [RegExp, string][] = [
  [/\bdo not\b/g, "don't"],
  [/\bwill not\b/g, "won't"],
  [/\bcannot\b/g, "can't"],
  [/\bcan not\b/g, "can't"],
  [/\bit is\b/g, "it's"],
  [/\bthat is\b/g, "that's"],
  [/\bthere is\b/g, "there's"],
  [/\bthey are\b/g, "they're"],
  [/\bwe are\b/g, "we're"],
  [/\byou are\b/g, "you're"],
  [/\bI am\b/g, "I'm"],
  [/\bwould not\b/g, "wouldn't"],
  [/\bshould not\b/g, "shouldn't"],
  [/\bcould not\b/g, "couldn't"],
  [/\bis not\b/g, "isn't"],
  [/\bare not\b/g, "aren't"],
  [/\bwas not\b/g, "wasn't"],
  [/\bwere not\b/g, "weren't"],
  [/\bhave not\b/g, "haven't"],
  [/\bhas not\b/g, "hasn't"],
  [/\bhad not\b/g, "hadn't"],
  [/\bdoes not\b/g, "doesn't"],
  [/\bdid not\b/g, "didn't"],
];

// AI overused phrases
const AI_PHRASES: RegExp[] = [
  /\bdelve\b/gi,
  /\btapestry\b/gi,
  /\bleverage\b/gi,
  /\bseamless(ly)?\b/gi,
  /\bcutting-edge\b/gi,
  /\bparadigm\b/gi,
  /\bsynergy\b/gi,
  /\bholistic(ally)?\b/gi,
  /\bstreamline[sd]?\b/gi,
  /\binnovative\b/gi,
  /\butilize[sd]?\b/gi,
  /\bfurthermore\b/gi,
  /\bmoreover\b/gi,
  /\bcomprehensive(ly)?\b/gi,
  /\bmultifaceted\b/gi,
  /\bpivotal\b/gi,
  /\bcrucial(ly)?\b/gi,
  /\bfoster[sed]?\b/gi,
  /\bharness(ed|ing)?\b/gi,
  /\bspearhead(ing|ed)?\b/gi,
  /\bunderscore[sd]?\b/gi,
  /\brealm\b/gi,
  /\bfacilitate[sd]?\b/gi,
  /\boptimize[sd]?\b/gi,
  /\baforementioned\b/gi,
  /\bnoteworthy\b/gi,
  /\brobust\b/gi,
  /\binherent(ly)?\b/gi,
  /\blandscape\b/gi,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Change {
  type: string;
  description: string;
}

function getSentenceLengths(text: string): number[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [];
  return sentences.map((s) => s.trim().split(/\s+/).length);
}

function sentenceLengthVariance(lengths: number[]): number {
  if (lengths.length < 2) return 0;
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / lengths.length;
  return Math.sqrt(variance);
}

function countContractionsInText(text: string): number {
  const matches = text.match(/\b\w+n't\b|\bI'm\b|\bwe're\b|\bthey're\b|\byou're\b|\bhe's\b|\bshe's\b|\bit's\b|\bthat's\b|\bthere's\b/gi);
  return matches ? matches.length : 0;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function applyWordReplacements(text: string, tone: string, changes: Change[]): string {
  let result = text;
  for (const [pattern, replacements] of WORD_MAP) {
    const replacement = replacements[tone] ?? replacements['conversational'];
    const before = result;
    result = result.replace(pattern, (match) => {
      // Preserve original casing style
      if (match[0] === match[0].toUpperCase()) {
        return replacement.charAt(0).toUpperCase() + replacement.slice(1);
      }
      return replacement;
    });
    if (result !== before) {
      changes.push({ type: 'word_replacement', description: `Replaced AI vocabulary with simpler alternatives` });
    }
  }
  return result;
}

function applyHedgingRemoval(text: string, changes: Change[]): string {
  let result = text;
  for (const [pattern, replacement] of HEDGING_PATTERNS) {
    const before = result;
    result = result.replace(pattern, replacement);
    if (result !== before) {
      changes.push({ type: 'hedging_removal', description: 'Removed hedging phrase' });
    }
  }
  return result;
}

function applyFillerRemoval(text: string, changes: Change[]): string {
  let result = text;
  for (const [pattern, replacement] of FILLER_PATTERNS) {
    const before = result;
    result = result.replace(pattern, replacement);
    if (result !== before) {
      changes.push({ type: 'filler_removal', description: 'Removed filler transition phrase' });
    }
  }
  return result;
}

function applyAdverbRemoval(text: string, changes: Change[]): string {
  let result = text;
  for (const pattern of ADVERB_PATTERNS) {
    const before = result;
    result = result.replace(pattern, '');
    if (result !== before) {
      changes.push({ type: 'adverb_removal', description: 'Removed excessive adverb' });
    }
  }
  // Clean up double spaces left by removed adverbs
  result = result.replace(/  +/g, ' ');
  return result;
}

function applyEmDashReplacement(text: string, changes: Change[]): string {
  // Replace em dashes with comma+space or period depending on context
  const before = text;
  // Em dash between clauses -> comma
  let result = text.replace(/\s*\u2014\s*/g, ', ');
  // Also handle double hyphens used as em dashes
  result = result.replace(/\s*--\s*/g, ', ');
  if (result !== before) {
    changes.push({ type: 'em_dash_replacement', description: 'Replaced em dashes with commas' });
  }
  return result;
}

function applyContractions(text: string, strength: string, changes: Change[]): string {
  if (strength === 'light') return text;
  let result = text;
  // Apply a subset for medium, all for heavy
  const pairs = strength === 'heavy' ? CONTRACTIONS : CONTRACTIONS.slice(0, 8);
  const before = result;
  for (const [pattern, contraction] of pairs) {
    result = result.replace(pattern, contraction);
  }
  if (result !== before) {
    changes.push({ type: 'contractions_added', description: 'Added contractions for natural flow' });
  }
  return result;
}

function deduplicateChanges(changes: Change[]): Change[] {
  const seen = new Set<string>();
  const unique: Change[] = [];
  for (const c of changes) {
    if (!seen.has(c.type)) {
      seen.add(c.type);
      unique.push(c);
    }
  }
  return unique;
}

// ---------------------------------------------------------------------------
// Core rewrite engine
// ---------------------------------------------------------------------------

function rewriteText(text: string, tone: string, strength: string): { text: string; changes: Change[] } {
  const changes: Change[] = [];
  let result = text;

  // Always apply: word replacements, hedging, filler removal
  result = applyWordReplacements(result, tone, changes);
  result = applyHedgingRemoval(result, changes);
  result = applyFillerRemoval(result, changes);
  result = applyEmDashReplacement(result, changes);

  if (strength === 'medium' || strength === 'heavy') {
    result = applyAdverbRemoval(result, changes);
    result = applyContractions(result, strength, changes);
  }

  if (strength === 'heavy') {
    // Heavy: also trim leading/trailing whitespace per sentence and collapse runs
    result = result.replace(/\s{2,}/g, ' ').trim();
    changes.push({ type: 'cleanup', description: 'Cleaned up whitespace' });
  }

  // Final cleanup
  result = result.replace(/\s+([,.!?])/g, '$1').trim();

  return { text: result, changes: deduplicateChanges(changes) };
}

// ---------------------------------------------------------------------------
// AI detection scoring
// ---------------------------------------------------------------------------

interface DetectCategory {
  name: string;
  score: number;
  detail: string;
}

function detectAiText(text: string): { score: number; categories: DetectCategory[] } {
  const words = countWords(text);
  if (words < 5) {
    return { score: 0, categories: [] };
  }

  const categories: DetectCategory[] = [];

  // 1. AI vocabulary density
  let aiWordCount = 0;
  for (const pattern of AI_PHRASES) {
    const matches = text.match(pattern);
    if (matches) aiWordCount += matches.length;
  }
  const vocabDensity = Math.min(100, Math.round((aiWordCount / words) * 100 * 20));
  categories.push({
    name: 'ai_vocabulary',
    score: vocabDensity,
    detail: `Found ${aiWordCount} AI indicator word(s) in ${words} total words`,
  });

  // 2. Sentence length uniformity (low variance = more AI)
  const sentenceLengths = getSentenceLengths(text);
  let uniformityScore = 0;
  if (sentenceLengths.length >= 3) {
    const stdDev = sentenceLengthVariance(sentenceLengths);
    // Low std dev (< 5) suggests AI; high std dev (> 15) suggests human
    uniformityScore = Math.max(0, Math.min(100, Math.round(100 - (stdDev / 15) * 100)));
  }
  categories.push({
    name: 'sentence_uniformity',
    score: uniformityScore,
    detail: `Sentence length std dev: ${sentenceLengths.length >= 2 ? sentenceLengthVariance(sentenceLengths).toFixed(1) : 'n/a'} words`,
  });

  // 3. Hedging phrase density
  let hedgingCount = 0;
  for (const [pattern] of HEDGING_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) hedgingCount += matches.length;
  }
  const hedgingScore = Math.min(100, hedgingCount * 25);
  categories.push({
    name: 'hedging_phrases',
    score: hedgingScore,
    detail: `Found ${hedgingCount} hedging phrase(s)`,
  });

  // 4. Contraction usage (humans use them; AI avoids)
  const contractionCount = countContractionsInText(text);
  const contractionDensity = words > 0 ? contractionCount / words : 0;
  // < 1% contractions is suspicious; > 4% is clearly human
  const contractionScore = Math.max(0, Math.min(100, Math.round(100 - (contractionDensity / 0.04) * 100)));
  categories.push({
    name: 'contraction_avoidance',
    score: contractionScore,
    detail: `${contractionCount} contraction(s) found (${(contractionDensity * 100).toFixed(1)}% of words)`,
  });

  // 5. Paragraph length uniformity
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  let paragraphScore = 0;
  if (paragraphs.length >= 3) {
    const pLengths = paragraphs.map((p) => p.trim().split(/\s+/).length);
    const mean = pLengths.reduce((a, b) => a + b, 0) / pLengths.length;
    const pVariance = pLengths.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / pLengths.length;
    const pStdDev = Math.sqrt(pVariance);
    paragraphScore = Math.max(0, Math.min(100, Math.round(100 - (pStdDev / mean) * 100)));
  }
  categories.push({
    name: 'paragraph_uniformity',
    score: paragraphScore,
    detail: paragraphs.length >= 3 ? `${paragraphs.length} paragraphs analyzed` : 'Not enough paragraphs to analyze',
  });

  // 6. Filler phrase density
  let fillerCount = 0;
  for (const [pattern] of FILLER_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) fillerCount += matches.length;
  }
  const fillerScore = Math.min(100, fillerCount * 35);
  categories.push({
    name: 'filler_phrases',
    score: fillerScore,
    detail: `Found ${fillerCount} filler transition(s)`,
  });

  // Weighted overall score
  const weights = [0.25, 0.20, 0.15, 0.20, 0.10, 0.10];
  const overall = Math.round(
    categories.reduce((sum, cat, i) => sum + cat.score * weights[i], 0)
  );

  return { score: Math.min(100, overall), categories };
}

// ---------------------------------------------------------------------------
// Suggestion engine
// ---------------------------------------------------------------------------

interface Suggestion {
  line: number;
  type: string;
  original: string;
  suggestion: string;
}

function suggestImprovements(text: string): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const lines = text.split('\n');

  lines.forEach((line, lineIndex) => {
    const lineNum = lineIndex + 1;

    // Check for AI vocabulary
    for (const [pattern, replacements] of WORD_MAP) {
      const match = line.match(pattern);
      if (match) {
        suggestions.push({
          line: lineNum,
          type: 'ai_vocabulary',
          original: match[0],
          suggestion: `Replace "${match[0]}" with "${replacements['conversational']}"`,
        });
      }
    }

    // Check for hedging phrases
    for (const [pattern] of HEDGING_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        suggestions.push({
          line: lineNum,
          type: 'hedging',
          original: match[0].trim(),
          suggestion: `Remove hedging phrase: "${match[0].trim()}"`,
        });
      }
    }

    // Check for filler transitions
    for (const [pattern] of FILLER_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        suggestions.push({
          line: lineNum,
          type: 'filler_transition',
          original: match[0].trim(),
          suggestion: `Remove filler opening: "${match[0].trim()}"`,
        });
      }
    }

    // Check for em dashes
    if (/\u2014|--/.test(line)) {
      suggestions.push({
        line: lineNum,
        type: 'em_dash',
        original: line.includes('\u2014') ? '-' : '--',
        suggestion: 'Replace em dash with a comma or period',
      });
    }

    // Check for excessive adverbs
    for (const pattern of ADVERB_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        suggestions.push({
          line: lineNum,
          type: 'excessive_adverb',
          original: match[0],
          suggestion: `Remove or replace adverb "${match[0]}" - it weakens the sentence`,
        });
      }
    }

    // Check for missing contractions (only flag lines with expanded forms)
    const contractionTargets: [RegExp, string][] = [
      [/\bdo not\b/g, "don't"],
      [/\bwill not\b/g, "won't"],
      [/\bcannot\b/g, "can't"],
      [/\bit is\b/g, "it's"],
    ];
    for (const [pattern, contraction] of contractionTargets) {
      const match = line.match(pattern);
      if (match) {
        suggestions.push({
          line: lineNum,
          type: 'contraction',
          original: match[0],
          suggestion: `Use "${contraction}" instead of "${match[0]}" for a more natural tone`,
        });
      }
    }
  });

  // Deduplicate by line + type to avoid noise
  const seen = new Set<string>();
  return suggestions.filter((s) => {
    const key = `${s.line}:${s.type}:${s.original}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createHumanizeRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /humanize/rewrite
  router.post('/rewrite', requireScope('humanize:use'), zv('json', RewriteSchema), (c) => {
    const { text, tone, strength } = c.req.valid('json');
    const { text: rewritten, changes } = rewriteText(text, tone, strength);
    return ok(c, {
      text: rewritten,
      original_length: text.length,
      rewritten_length: rewritten.length,
      tone,
      strength,
      changes,
      changes_count: changes.length,
    });
  });

  // POST /humanize/detect
  router.post('/detect', requireScope('humanize:use'), zv('json', DetectSchema), (c) => {
    const { text } = c.req.valid('json');
    const { score, categories } = detectAiText(text);
    return ok(c, {
      score,
      verdict: score >= 70 ? 'likely_ai' : score >= 40 ? 'possibly_ai' : 'likely_human',
      categories,
      word_count: countWords(text),
    });
  });

  // POST /humanize/suggest
  router.post('/suggest', requireScope('humanize:use'), zv('json', SuggestSchema), (c) => {
    const { text } = c.req.valid('json');
    const suggestions = suggestImprovements(text);
    return ok(c, {
      suggestions,
      suggestions_count: suggestions.length,
      word_count: countWords(text),
    });
  });

  return router;
}
