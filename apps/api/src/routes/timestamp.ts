/**
 * UnClick Timestamp - stateless timestamp utility.
 *
 * All endpoints sit under /v1/* and inherit the global auth + rate-limit
 * middleware; no database access is needed.
 *
 * Scope: timestamp:use
 *
 *   POST /v1/timestamp/now     - current time in ISO, Unix seconds, Unix ms, UTC string
 *   POST /v1/timestamp/convert - accept ISO / Unix-s / Unix-ms, return all formats
 *   POST /v1/timestamp/diff    - difference between two timestamps
 *   POST /v1/timestamp/add     - add a duration to a timestamp
 *   POST /v1/timestamp/format  - format a timestamp with a pattern string
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { ok, Errors } from '@unclick/core';
import { zv } from '../middleware/validate.js';
import { requireScope } from '../middleware/auth.js';
import type { AppVariables } from '../middleware/types.js';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

// A timestamp can be an ISO 8601 string, Unix seconds, or Unix ms.
// We accept it as a union of string | number and resolve it to a Date below.
const TimestampField = z.union([z.string().max(100), z.number()]);

const ConvertSchema = z.object({
  timestamp: TimestampField,
});

const DiffSchema = z.object({
  from: TimestampField,
  to: TimestampField,
});

const DurationSchema = z.object({
  years: z.number().int().default(0),
  months: z.number().int().default(0),
  weeks: z.number().int().default(0),
  days: z.number().int().default(0),
  hours: z.number().int().default(0),
  minutes: z.number().int().default(0),
  seconds: z.number().int().default(0),
});

const AddSchema = z.object({
  timestamp: TimestampField,
  duration: DurationSchema,
});

const FormatSchema = z.object({
  timestamp: TimestampField,
  format: z.string().min(1).max(200),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a timestamp value to a Date.
 * Heuristic: numbers < 1e10 are treated as Unix seconds; >= 1e10 as Unix ms.
 * Strings are parsed as ISO 8601 or any format accepted by `new Date()`.
 */
function resolveDate(value: string | number): Date {
  if (typeof value === 'number') {
    const ms = value < 1e10 ? value * 1000 : value;
    return new Date(ms);
  }
  return new Date(value);
}

function assertValidDate(d: Date, label: string): void {
  if (isNaN(d.getTime())) {
    throw Errors.validation(`"${label}" is not a valid timestamp`);
  }
}

function allFormats(d: Date) {
  return {
    iso: d.toISOString(),
    unix_seconds: Math.floor(d.getTime() / 1000),
    unix_ms: d.getTime(),
    utc_string: d.toUTCString(),
  };
}

/**
 * Apply a simple pattern replacement.
 * Supported tokens: YYYY MM DD HH mm ss SSS
 */
function formatDate(d: Date, pattern: string): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return pattern
    .replace(/YYYY/g, String(d.getUTCFullYear()))
    .replace(/MM/g, pad(d.getUTCMonth() + 1))
    .replace(/DD/g, pad(d.getUTCDate()))
    .replace(/HH/g, pad(d.getUTCHours()))
    .replace(/mm/g, pad(d.getUTCMinutes()))
    .replace(/ss/g, pad(d.getUTCSeconds()))
    .replace(/SSS/g, pad(d.getUTCMilliseconds(), 3));
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createTimestampRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /timestamp/now
  router.post('/now', requireScope('timestamp:use'), (c) => {
    const now = new Date();
    return ok(c, allFormats(now));
  });

  // POST /timestamp/convert
  router.post('/convert', requireScope('timestamp:use'), zv('json', ConvertSchema), (c) => {
    const { timestamp } = c.req.valid('json');
    const d = resolveDate(timestamp);
    assertValidDate(d, 'timestamp');
    return ok(c, { input: timestamp, ...allFormats(d) });
  });

  // POST /timestamp/diff
  router.post('/diff', requireScope('timestamp:use'), zv('json', DiffSchema), (c) => {
    const { from, to } = c.req.valid('json');
    const dFrom = resolveDate(from);
    const dTo = resolveDate(to);
    assertValidDate(dFrom, 'from');
    assertValidDate(dTo, 'to');

    const diffMs = dTo.getTime() - dFrom.getTime();
    const absDiffMs = Math.abs(diffMs);

    return ok(c, {
      from: dFrom.toISOString(),
      to: dTo.toISOString(),
      diff_ms: diffMs,
      diff_seconds: diffMs / 1000,
      diff_minutes: diffMs / 60_000,
      diff_hours: diffMs / 3_600_000,
      diff_days: diffMs / 86_400_000,
      absolute: {
        ms: absDiffMs,
        seconds: absDiffMs / 1000,
        minutes: absDiffMs / 60_000,
        hours: absDiffMs / 3_600_000,
        days: absDiffMs / 86_400_000,
      },
    });
  });

  // POST /timestamp/add
  router.post('/add', requireScope('timestamp:use'), zv('json', AddSchema), (c) => {
    const { timestamp, duration } = c.req.valid('json');
    const d = resolveDate(timestamp);
    assertValidDate(d, 'timestamp');

    const ms =
      (duration.years * 365.25 * 86_400_000) +
      (duration.months * 30.4375 * 86_400_000) +
      (duration.weeks * 7 * 86_400_000) +
      (duration.days * 86_400_000) +
      (duration.hours * 3_600_000) +
      (duration.minutes * 60_000) +
      (duration.seconds * 1_000);

    const result = new Date(d.getTime() + ms);
    return ok(c, {
      input: d.toISOString(),
      duration,
      added_ms: ms,
      result: allFormats(result),
    });
  });

  // POST /timestamp/format
  router.post('/format', requireScope('timestamp:use'), zv('json', FormatSchema), (c) => {
    const { timestamp, format } = c.req.valid('json');
    const d = resolveDate(timestamp);
    assertValidDate(d, 'timestamp');
    return ok(c, {
      input: timestamp,
      format,
      result: formatDate(d, format),
    });
  });

  return router;
}
