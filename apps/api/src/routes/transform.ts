/**
 * UnClick Transform - stateless text transformation utility.
 *
 * All endpoints sit under /v1/* and inherit the global auth + rate-limit
 * middleware; no database access is needed.
 *
 * Scope: transform:use
 *
 *   POST /v1/transform/case      - convert text to a target case
 *   POST /v1/transform/slug      - convert text to a URL-friendly slug
 *   POST /v1/transform/truncate  - truncate text with optional ellipsis
 *   POST /v1/transform/count     - word / char / sentence / paragraph / reading-time counts
 *   POST /v1/transform/strip     - strip HTML tags, decode common entities
 *   POST /v1/transform/reverse   - reverse a string (Unicode-safe)
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

const CaseSchema = z.object({
  text: z.string().max(100_000),
  to: z.enum(['upper', 'lower', 'title', 'sentence', 'camel', 'snake', 'kebab', 'pascal']),
});

const SlugSchema = z.object({
  text: z.string().min(1).max(1_000),
});

const TruncateSchema = z.object({
  text: z.string().max(100_000),
  length: z.number().int().min(1).max(100_000),
  ellipsis: z.boolean().default(true),
});

const CountSchema = z.object({
  text: z.string().max(1_000_000),
  words_per_minute: z.number().int().min(1).max(2_000).default(200),
});

const StripSchema = z.object({
  text: z.string().max(1_000_000),
});

const ReverseSchema = z.object({
  text: z.string().max(100_000),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toTitleCase(text: string): string {
  return text.replace(/\w\S*/g, (word) =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  );
}

function toSentenceCase(text: string): string {
  if (!text) return text;
  const lower = text.toLowerCase();
  return lower.replace(/(^|\.\s+|!\s+|\?\s+)([a-z])/g, (_, sep, letter) =>
    sep + letter.toUpperCase(),
  );
}

function wordsFrom(text: string): string[] {
  return text
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function toCamelCase(text: string): string {
  return wordsFrom(text)
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join('');
}

function toSnakeCase(text: string): string {
  return wordsFrom(text).map((w) => w.toLowerCase()).join('_');
}

function toKebabCase(text: string): string {
  return wordsFrom(text).map((w) => w.toLowerCase()).join('-');
}

function toPascalCase(text: string): string {
  return wordsFrom(text)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&apos;': "'",
};

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (entity) => HTML_ENTITIES[entity] ?? entity);
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createTransformRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /transform/case
  router.post('/case', requireScope('transform:use'), zv('json', CaseSchema), (c) => {
    const { text, to } = c.req.valid('json');
    let result: string;
    switch (to) {
      case 'upper':    result = text.toUpperCase(); break;
      case 'lower':    result = text.toLowerCase(); break;
      case 'title':    result = toTitleCase(text); break;
      case 'sentence': result = toSentenceCase(text); break;
      case 'camel':    result = toCamelCase(text); break;
      case 'snake':    result = toSnakeCase(text); break;
      case 'kebab':    result = toKebabCase(text); break;
      case 'pascal':   result = toPascalCase(text); break;
    }
    return ok(c, { text: result, original: text, to });
  });

  // POST /transform/slug
  router.post('/slug', requireScope('transform:use'), zv('json', SlugSchema), (c) => {
    const { text } = c.req.valid('json');
    return ok(c, { slug: toSlug(text), original: text });
  });

  // POST /transform/truncate
  router.post('/truncate', requireScope('transform:use'), zv('json', TruncateSchema), (c) => {
    const { text, length, ellipsis } = c.req.valid('json');
    const truncated = text.length > length;
    let result: string;
    if (!truncated) {
      result = text;
    } else if (ellipsis) {
      result = text.slice(0, Math.max(0, length - 3)) + '...';
    } else {
      result = text.slice(0, length);
    }
    return ok(c, { text: result, original_length: text.length, truncated });
  });

  // POST /transform/count
  router.post('/count', requireScope('transform:use'), zv('json', CountSchema), (c) => {
    const { text, words_per_minute } = c.req.valid('json');
    const characters = text.length;
    const characters_no_spaces = text.replace(/\s/g, '').length;
    const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    const sentences = text.trim() === ''
      ? 0
      : (text.match(/[^.!?]*[.!?]+/g) ?? []).length;
    const paragraphs = text.trim() === ''
      ? 0
      : text.split(/\n\s*\n/).filter((p) => p.trim() !== '').length;
    const reading_time_seconds = Math.ceil((words / words_per_minute) * 60);
    return ok(c, {
      characters,
      characters_no_spaces,
      words,
      sentences,
      paragraphs,
      reading_time_seconds,
      reading_time_minutes: Math.ceil(reading_time_seconds / 60),
    });
  });

  // POST /transform/strip
  router.post('/strip', requireScope('transform:use'), zv('json', StripSchema), (c) => {
    const { text } = c.req.valid('json');
    const stripped = stripHtml(text);
    return ok(c, { text: stripped, original_length: text.length, stripped_length: stripped.length });
  });

  // POST /transform/reverse
  router.post('/reverse', requireScope('transform:use'), zv('json', ReverseSchema), (c) => {
    const { text } = c.req.valid('json');
    // Spread into codepoints to handle multi-byte Unicode characters correctly
    const reversed = [...text].reverse().join('');
    return ok(c, { text: reversed, original: text });
  });

  return router;
}
