import { Hono } from 'hono';
import { z } from 'zod';
import { ok, Errors } from '@unclick/core';
import { zv } from '../middleware/validate.js';
import { requireScope } from '../middleware/auth.js';
import type { AppVariables } from '../middleware/types.js';

const TextSchema = z.object({
  text: z.string().max(1_000_000),
});

// Minimal HTML entity map (encode direction)
const HTML_ENCODE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// Reverse map for decoding named entities, plus numeric entity handling
const HTML_DECODE_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': '\u00a0',
  '&copy;': '\u00a9',
  '&reg;': '\u00ae',
  '&trade;': '\u2122',
  '&euro;': '\u20ac',
  '&pound;': '\u00a3',
  '&yen;': '\u00a5',
  '&cent;': '\u00a2',
  '&mdash;': '\u2014',
  '&ndash;': '\u2013',
  '&lsquo;': '\u2018',
  '&rsquo;': '\u2019',
  '&ldquo;': '\u201c',
  '&rdquo;': '\u201d',
};

function htmlEncode(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ENCODE_MAP[ch] ?? ch);
}

function htmlDecode(text: string): string {
  return text
    // Named entities
    .replace(/&[a-zA-Z]+;/g, (entity) => HTML_DECODE_MAP[entity] ?? entity)
    // Decimal numeric entities &#123;
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
    // Hex numeric entities &#x1F600;
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

export function createEncodeRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /encode/base64
  router.post('/encode/base64', requireScope('encode:use'), zv('json', TextSchema), (c) => {
    const { text } = c.req.valid('json');
    const encoded = Buffer.from(text, 'utf8').toString('base64');
    return ok(c, { encoded });
  });

  // POST /decode/base64
  router.post('/decode/base64', requireScope('encode:use'), zv('json', TextSchema), (c) => {
    const { text } = c.req.valid('json');
    try {
      const decoded = Buffer.from(text, 'base64').toString('utf8');
      return ok(c, { decoded });
    } catch {
      throw Errors.validation('Invalid base64 input');
    }
  });

  // POST /encode/url
  router.post('/encode/url', requireScope('encode:use'), zv('json', TextSchema), (c) => {
    const { text } = c.req.valid('json');
    const encoded = encodeURIComponent(text);
    return ok(c, { encoded });
  });

  // POST /decode/url
  router.post('/decode/url', requireScope('encode:use'), zv('json', TextSchema), (c) => {
    const { text } = c.req.valid('json');
    try {
      const decoded = decodeURIComponent(text);
      return ok(c, { decoded });
    } catch {
      throw Errors.validation('Invalid URL-encoded input - malformed percent-encoding');
    }
  });

  // POST /encode/html
  router.post('/encode/html', requireScope('encode:use'), zv('json', TextSchema), (c) => {
    const { text } = c.req.valid('json');
    const encoded = htmlEncode(text);
    return ok(c, { encoded });
  });

  // POST /decode/html
  router.post('/decode/html', requireScope('encode:use'), zv('json', TextSchema), (c) => {
    const { text } = c.req.valid('json');
    const decoded = htmlDecode(text);
    return ok(c, { decoded });
  });

  // POST /encode/hex
  router.post('/encode/hex', requireScope('encode:use'), zv('json', TextSchema), (c) => {
    const { text } = c.req.valid('json');
    const encoded = Buffer.from(text, 'utf8').toString('hex');
    return ok(c, { encoded });
  });

  // POST /decode/hex
  router.post('/decode/hex', requireScope('encode:use'), zv('json', TextSchema), (c) => {
    const { text } = c.req.valid('json');
    if (!/^[0-9a-fA-F]*$/.test(text) || text.length % 2 !== 0) {
      throw Errors.validation('Invalid hex input - must be an even-length hex string');
    }
    try {
      const decoded = Buffer.from(text, 'hex').toString('utf8');
      return ok(c, { decoded });
    } catch {
      throw Errors.validation('Invalid hex input');
    }
  });

  return router;
}
