import { Hono } from 'hono';
import { z } from 'zod';
import {
  createTwoFilesPatch,
  diffLines,
  diffWords,
  applyPatch,
} from 'diff';
import { ok, Errors } from '@unclick/core';
import { zv } from '../middleware/validate.js';
import { requireScope } from '../middleware/auth.js';
import type { AppVariables } from '../middleware/types.js';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const TwoTextSchema = z.object({
  a: z.string().max(1_000_000),
  b: z.string().max(1_000_000),
  // Optional filenames for unified diff header
  filename_a: z.string().max(255).default('a'),
  filename_b: z.string().max(255).default('b'),
});

const LinesSchema = z.object({
  a: z.string().max(1_000_000),
  b: z.string().max(1_000_000),
});

const WordsSchema = z.object({
  a: z.string().max(1_000_000),
  b: z.string().max(1_000_000),
});

const PatchSchema = z.object({
  original: z.string().max(1_000_000),
  patch: z.string().min(1).max(1_000_000),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export function createDiffRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /diff/text - unified diff between two strings
  router.post('/text', requireScope('diff:use'), zv('json', TwoTextSchema), (c) => {
    const { a, b, filename_a, filename_b } = c.req.valid('json');
    const patch = createTwoFilesPatch(filename_a, filename_b, a, b);
    const changed = a !== b;
    return ok(c, { patch, changed });
  });

  // POST /diff/lines - line-by-line diff with line numbers
  router.post('/lines', requireScope('diff:use'), zv('json', LinesSchema), (c) => {
    const { a, b } = c.req.valid('json');
    const changes = diffLines(a, b);

    let lineNumberA = 1;
    let lineNumberB = 1;

    const lines = changes.flatMap((change) => {
      const changeLines = change.value.replace(/\n$/, '').split('\n');
      return changeLines.map((text) => {
        const entry: {
          type: 'added' | 'removed' | 'unchanged';
          text: string;
          line_a: number | null;
          line_b: number | null;
        } = {
          type: change.added ? 'added' : change.removed ? 'removed' : 'unchanged',
          text,
          line_a: null,
          line_b: null,
        };
        if (!change.added) entry.line_a = lineNumberA++;
        if (!change.removed) entry.line_b = lineNumberB++;
        return entry;
      });
    });

    const added = lines.filter((l) => l.type === 'added').length;
    const removed = lines.filter((l) => l.type === 'removed').length;

    return ok(c, { lines, added, removed, changed: added + removed > 0 });
  });

  // POST /diff/words - word-level diff
  router.post('/words', requireScope('diff:use'), zv('json', WordsSchema), (c) => {
    const { a, b } = c.req.valid('json');
    const changes = diffWords(a, b);

    const tokens = changes.map((change) => ({
      type: change.added ? 'added' : change.removed ? 'removed' : ('unchanged' as const),
      value: change.value,
    }));

    const added = tokens.filter((t) => t.type === 'added').length;
    const removed = tokens.filter((t) => t.type === 'removed').length;

    return ok(c, { tokens, added, removed, changed: added + removed > 0 });
  });

  // POST /diff/patch - apply a unified diff patch to text
  router.post('/patch', requireScope('diff:use'), zv('json', PatchSchema), (c) => {
    const { original, patch } = c.req.valid('json');
    const result = applyPatch(original, patch);
    if (result === false) {
      throw Errors.validation('Patch could not be applied - the patch does not match the original text');
    }
    return ok(c, { result, changed: result !== original });
  });

  return router;
}
