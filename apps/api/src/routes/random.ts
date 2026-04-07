/**
 * UnClick Random - stateless secure-random utility.
 *
 * All endpoints sit under /v1/* and inherit the global auth + rate-limit
 * middleware; no database access is needed.
 *
 * Uses Node crypto for CSPRNG-quality output on every endpoint.
 *
 * Scope: random:use
 *
 *   POST /v1/random/number    - random number in a range
 *   POST /v1/random/string    - random string with configurable charset
 *   POST /v1/random/password  - random password with complexity options
 *   POST /v1/random/pick      - pick random item(s) from an array
 *   POST /v1/random/shuffle   - shuffle an array
 *   POST /v1/random/color     - random color in hex, RGB, or HSL
 */
import { Hono } from 'hono';
import { randomBytes, randomInt } from 'node:crypto';
import { z } from 'zod';
import { ok, Errors } from '@unclick/core';
import { zv } from '../middleware/validate.js';
import { requireScope } from '../middleware/auth.js';
import type { AppVariables } from '../middleware/types.js';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const NumberSchema = z.object({
  min: z.number().default(0),
  max: z.number().default(100),
  count: z.number().int().min(1).max(1000).default(1),
  decimals: z.number().int().min(0).max(10).default(0),
});

const CHARSETS = ['alpha', 'numeric', 'alphanumeric', 'hex', 'custom'] as const;

const StringSchema = z.object({
  length: z.number().int().min(1).max(4096).default(16),
  charset: z.enum(CHARSETS).default('alphanumeric'),
  custom_chars: z.string().max(512).optional(),
  count: z.number().int().min(1).max(100).default(1),
});

const PasswordSchema = z.object({
  length: z.number().int().min(4).max(512).default(20),
  uppercase: z.boolean().default(true),
  lowercase: z.boolean().default(true),
  numbers: z.boolean().default(true),
  symbols: z.boolean().default(true),
  count: z.number().int().min(1).max(100).default(1),
});

const PickSchema = z.object({
  items: z.array(z.unknown()).min(1).max(10_000),
  count: z.number().int().min(1).max(1000).default(1),
  unique: z.boolean().default(false),
});

const ShuffleSchema = z.object({
  items: z.array(z.unknown()).min(1).max(10_000),
});

const COLOR_FORMATS = ['hex', 'rgb', 'hsl'] as const;

const ColorSchema = z.object({
  format: z.enum(COLOR_FORMATS).default('hex'),
  count: z.number().int().min(1).max(100).default(1),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHARS = {
  alpha: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numeric: '0123456789',
  alphanumeric: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  hex: '0123456789abcdef',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

/** Pick one random character from a string using crypto. */
function pickChar(chars: string): string {
  // randomInt is inclusive on both ends; chars.length is exclusive upper bound.
  return chars[randomInt(chars.length)]!;
}

/** Generate a random string from a character pool. */
function randomString(length: number, pool: string): string {
  if (pool.length === 0) throw Errors.validation('Character pool is empty');
  return Array.from({ length }, () => pickChar(pool)).join('');
}

/** Unbiased Fisher-Yates shuffle using crypto.randomInt. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function randomColorHex(): string {
  const bytes = randomBytes(3);
  return '#' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomColorRgb(): { r: number; g: number; b: number; css: string } {
  const [r, g, b] = Array.from(randomBytes(3)) as [number, number, number];
  return { r, g, b, css: `rgb(${r}, ${g}, ${b})` };
}

function randomColorHsl(): { h: number; s: number; l: number; css: string } {
  const h = randomInt(361);       // 0–360
  const s = randomInt(101);       // 0–100
  const l = randomInt(101);       // 0–100
  return { h, s, l, css: `hsl(${h}, ${s}%, ${l}%)` };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createRandomRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /random/number
  router.post('/number', requireScope('random:use'), zv('json', NumberSchema), (c) => {
    const { min, max, count, decimals } = c.req.valid('json');
    if (min >= max) throw Errors.validation('"min" must be less than "max"');

    const factor = Math.pow(10, decimals);
    const scaledMin = Math.ceil(min * factor);
    const scaledMax = Math.floor(max * factor);

    if (scaledMin >= scaledMax) {
      throw Errors.validation('The range is too small for the requested number of decimal places');
    }

    const generate = () => {
      const raw = randomInt(scaledMin, scaledMax + 1);
      return decimals === 0 ? raw : parseFloat((raw / factor).toFixed(decimals));
    };

    const numbers = Array.from({ length: count }, generate);
    return ok(c, { min, max, decimals, count, numbers: count === 1 ? undefined : numbers, number: count === 1 ? numbers[0] : undefined });
  });

  // POST /random/string
  router.post('/string', requireScope('random:use'), zv('json', StringSchema), (c) => {
    const { length, charset, custom_chars, count } = c.req.valid('json');

    let pool: string;
    if (charset === 'custom') {
      if (!custom_chars || custom_chars.length === 0) {
        throw Errors.validation('"custom_chars" is required when charset is "custom"');
      }
      pool = custom_chars;
    } else {
      pool = CHARS[charset];
    }

    const strings = Array.from({ length: count }, () => randomString(length, pool));
    return ok(c, { length, charset, count, strings: count === 1 ? undefined : strings, string: count === 1 ? strings[0] : undefined });
  });

  // POST /random/password
  router.post('/password', requireScope('random:use'), zv('json', PasswordSchema), (c) => {
    const { length, uppercase, lowercase, numbers, symbols, count } = c.req.valid('json');

    if (!uppercase && !lowercase && !numbers && !symbols) {
      throw Errors.validation('At least one character set must be enabled');
    }

    const pool =
      (uppercase ? CHARS.uppercase : '') +
      (lowercase ? CHARS.lowercase : '') +
      (numbers ? CHARS.numeric : '') +
      (symbols ? CHARS.symbols : '');

    // Guarantee at least one char from each enabled group.
    const generate = (): string => {
      const required: string[] = [
        ...(uppercase ? [pickChar(CHARS.uppercase)] : []),
        ...(lowercase ? [pickChar(CHARS.lowercase)] : []),
        ...(numbers ? [pickChar(CHARS.numeric)] : []),
        ...(symbols ? [pickChar(CHARS.symbols)] : []),
      ];
      const remaining = Array.from(
        { length: length - required.length },
        () => pickChar(pool),
      );
      return shuffle([...required, ...remaining]).join('');
    };

    const passwords = Array.from({ length: count }, generate);
    return ok(c, {
      length,
      options: { uppercase, lowercase, numbers, symbols },
      count,
      passwords: count === 1 ? undefined : passwords,
      password: count === 1 ? passwords[0] : undefined,
    });
  });

  // POST /random/pick
  router.post('/pick', requireScope('random:use'), zv('json', PickSchema), (c) => {
    const { items, count, unique } = c.req.valid('json');

    if (unique && count > items.length) {
      throw Errors.validation(
        `Cannot pick ${count} unique items from a list of ${items.length}`,
      );
    }

    let picked: unknown[];
    if (unique) {
      picked = shuffle(items as unknown[]).slice(0, count);
    } else {
      picked = Array.from({ length: count }, () => items[randomInt(items.length)]);
    }

    return ok(c, {
      total_items: items.length,
      count,
      unique,
      picked: count === 1 ? undefined : picked,
      item: count === 1 ? picked[0] : undefined,
    });
  });

  // POST /random/shuffle
  router.post('/shuffle', requireScope('random:use'), zv('json', ShuffleSchema), (c) => {
    const { items } = c.req.valid('json');
    return ok(c, { count: items.length, shuffled: shuffle(items as unknown[]) });
  });

  // POST /random/color
  router.post('/color', requireScope('random:use'), zv('json', ColorSchema), (c) => {
    const { format, count } = c.req.valid('json');

    const generate = () => {
      if (format === 'hex') return randomColorHex();
      if (format === 'rgb') return randomColorRgb();
      return randomColorHsl();
    };

    const colors = Array.from({ length: count }, generate);
    return ok(c, {
      format,
      count,
      colors: count === 1 ? undefined : colors,
      color: count === 1 ? colors[0] : undefined,
    });
  });

  return router;
}
