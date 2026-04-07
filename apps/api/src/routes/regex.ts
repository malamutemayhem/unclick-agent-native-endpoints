/**
 * UnClick Regex - stateless regex utility.
 *
 * All endpoints sit under /v1/* and inherit the global auth + rate-limit
 * middleware; no database access is needed.
 *
 * Scope: regex:use
 *
 *   POST /v1/regex/test     - test a pattern against a string, return all matches with groups/indices
 *   POST /v1/regex/replace  - apply regex replace, support backreferences ($1, $2)
 *   POST /v1/regex/extract  - extract all matches from text as an array of strings
 *   POST /v1/regex/split    - split a string by regex pattern
 *   POST /v1/regex/validate - check if a pattern is valid, return error message if not
 *
 * ReDoS protection: input capped at 100 KB; iteration capped at 1 000 matches.
 * All regex execution is wrapped in try/catch to catch engines that throw on
 * catastrophic backtracking.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { ok, Errors } from '@unclick/core';
import { zv } from '../middleware/validate.js';
import { requireScope } from '../middleware/auth.js';
import type { AppVariables } from '../middleware/types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_INPUT = 100_000; // 100 KB - hard cap to mitigate ReDoS
const MAX_MATCHES = 1_000;
const VALID_FLAGS_RE = /^[gimsuy]*$/; // 'd' excluded - not universally available

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const PatternSchema = z.object({
  pattern: z.string().min(1).max(2_000),
  flags: z.string().max(10).default('').refine(
    (f) => VALID_FLAGS_RE.test(f),
    { message: 'flags must only contain: g i m s u y' },
  ),
});

const TestSchema = PatternSchema.extend({
  input: z.string().max(MAX_INPUT),
});

const ReplaceSchema = PatternSchema.extend({
  input: z.string().max(MAX_INPUT),
  replacement: z.string().max(10_000),
  /** When true (default), replaces all occurrences (adds 'g' flag). */
  global: z.boolean().default(true),
});

const ExtractSchema = PatternSchema.extend({
  input: z.string().max(MAX_INPUT),
});

const SplitSchema = PatternSchema.extend({
  input: z.string().max(MAX_INPUT),
  limit: z.number().int().min(1).max(10_000).optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRegex(pattern: string, flags: string): RegExp {
  try {
    return new RegExp(pattern, flags);
  } catch (e) {
    throw Errors.validation(`Invalid regex pattern: ${(e as Error).message}`);
  }
}

/** Ensure the 'g' flag is present (for exec loops). */
function withGlobal(flags: string): string {
  return flags.includes('g') ? flags : `${flags}g`;
}

/** Remove the 'g' flag (e.g. for split). */
function withoutGlobal(flags: string): string {
  return flags.replace(/g/g, '');
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createRegexRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /regex/test - find all matches, return groups and positions
  router.post('/test', requireScope('regex:use'), zv('json', TestSchema), (c) => {
    const { pattern, flags, input } = c.req.valid('json');
    const effectiveFlags = withGlobal(flags);
    const re = buildRegex(pattern, effectiveFlags);

    const matches: Array<{
      match: string;
      start: number;
      end: number;
      groups: Record<string, string | undefined> | null;
      named_groups: Record<string, string> | null;
    }> = [];

    let m: RegExpExecArray | null;
    let count = 0;
    let truncated = false;

    try {
      while ((m = re.exec(input)) !== null) {
        if (count >= MAX_MATCHES) {
          truncated = true;
          break;
        }
        count++;

        matches.push({
          match: m[0],
          start: m.index,
          end: m.index + m[0].length,
          groups: m.length > 1
            ? Object.fromEntries(m.slice(1).map((g, i) => [`$${i + 1}`, g]))
            : null,
          named_groups: m.groups ? { ...m.groups } as Record<string, string> : null,
        });

        // Guard against zero-length match infinite loop
        if (m[0].length === 0) re.lastIndex++;
      }
    } catch (e) {
      throw Errors.validation(`Regex execution error: ${(e as Error).message}`);
    }

    return ok(c, {
      pattern,
      flags: effectiveFlags,
      input_length: input.length,
      match_count: matches.length,
      matches,
      truncated,
    });
  });

  // POST /regex/replace - replace matches, supports $1 $2 backreferences
  router.post('/replace', requireScope('regex:use'), zv('json', ReplaceSchema), (c) => {
    const { pattern, flags, input, replacement, global: isGlobal } = c.req.valid('json');

    let effectiveFlags = withoutGlobal(flags);
    if (isGlobal) effectiveFlags = withGlobal(effectiveFlags);
    const re = buildRegex(pattern, effectiveFlags);

    let result: string;
    try {
      result = input.replace(re, replacement);
    } catch (e) {
      throw Errors.validation(`Regex replace error: ${(e as Error).message}`);
    }

    return ok(c, {
      pattern,
      flags: effectiveFlags,
      replacement,
      result,
      changed: result !== input,
    });
  });

  // POST /regex/extract - return flat array of all matched strings
  router.post('/extract', requireScope('regex:use'), zv('json', ExtractSchema), (c) => {
    const { pattern, flags, input } = c.req.valid('json');
    const effectiveFlags = withGlobal(flags);
    const re = buildRegex(pattern, effectiveFlags);

    const matches: string[] = [];
    let m: RegExpExecArray | null;
    let truncated = false;

    try {
      while ((m = re.exec(input)) !== null) {
        if (matches.length >= MAX_MATCHES) {
          truncated = true;
          break;
        }
        matches.push(m[0]);
        if (m[0].length === 0) re.lastIndex++;
      }
    } catch (e) {
      throw Errors.validation(`Regex execution error: ${(e as Error).message}`);
    }

    return ok(c, {
      pattern,
      flags: effectiveFlags,
      input_length: input.length,
      count: matches.length,
      matches,
      truncated,
    });
  });

  // POST /regex/split - split input by pattern
  router.post('/split', requireScope('regex:use'), zv('json', SplitSchema), (c) => {
    const { pattern, flags, input, limit } = c.req.valid('json');
    // 'g' flag has no effect on split; strip it to avoid surprises
    const effectiveFlags = withoutGlobal(flags);
    const re = buildRegex(pattern, effectiveFlags);

    let parts: string[];
    try {
      parts = input.split(re, limit);
    } catch (e) {
      throw Errors.validation(`Regex split error: ${(e as Error).message}`);
    }

    return ok(c, {
      pattern,
      flags: effectiveFlags,
      input_length: input.length,
      count: parts.length,
      parts,
    });
  });

  // POST /regex/validate - check if the pattern compiles without throwing
  router.post('/validate', requireScope('regex:use'), zv('json', PatternSchema), (c) => {
    const { pattern, flags } = c.req.valid('json');
    try {
      new RegExp(pattern, flags);
      return ok(c, { pattern, flags, valid: true, error: null });
    } catch (e) {
      return ok(c, { pattern, flags, valid: false, error: (e as Error).message });
    }
  });

  return router;
}
