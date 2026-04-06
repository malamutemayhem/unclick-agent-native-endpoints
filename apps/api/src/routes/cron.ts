import { Hono } from 'hono';
import { z } from 'zod';
import { ok, Errors } from '@unclick/core';
import { zv } from '../middleware/validate.js';
import { requireScope } from '../middleware/auth.js';
import type { AppVariables } from '../middleware/types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
// Non-leap year days in month (index 0 unused; 1-12)
const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedCron {
  minutes: number[];      // 0-59
  hours: number[];        // 0-23
  daysOfMonth: number[];  // 1-31
  months: number[];       // 1-12
  daysOfWeek: number[];   // 0-6 (0=Sunday, 7 normalized to 0)
  domRestricted: boolean; // original dom field was not '*'
  dowRestricted: boolean; // original dow field was not '*'
  raw: string;
}

// ─── Field Parsing ────────────────────────────────────────────────────────────

function intRange(from: number, to: number, step = 1): number[] {
  const result: number[] = [];
  for (let i = from; i <= to; i += step) result.push(i);
  return result;
}

/**
 * Parse a single cron field into a sorted array of valid values.
 * Returns null when the field is syntactically or semantically invalid.
 */
function parseField(field: string, min: number, max: number): number[] | null {
  if (field === '*') return intRange(min, max);

  const result = new Set<number>();

  for (const part of field.split(',')) {
    const trimmed = part.trim();

    if (trimmed.includes('/')) {
      // Step: */n  or  n-m/n  or  n/n
      const slashIdx = trimmed.lastIndexOf('/');
      const left = trimmed.slice(0, slashIdx);
      const step = parseInt(trimmed.slice(slashIdx + 1), 10);
      if (isNaN(step) || step < 1) return null;

      let from: number;
      let to: number;
      if (left === '*') {
        from = min; to = max;
      } else if (left.includes('-')) {
        const [a, b] = left.split('-');
        from = parseInt(a!, 10); to = parseInt(b!, 10);
        if (isNaN(from) || isNaN(to) || from < min || to > max || from > to) return null;
      } else {
        from = parseInt(left, 10); to = max;
        if (isNaN(from) || from < min || from > max) return null;
      }
      for (let i = from; i <= to; i += step) result.add(i);

    } else if (trimmed.includes('-')) {
      // Range: n-m
      const [a, b] = trimmed.split('-');
      const from = parseInt(a!, 10);
      const to = parseInt(b!, 10);
      if (isNaN(from) || isNaN(to) || from < min || to > max || from > to) return null;
      for (let i = from; i <= to; i++) result.add(i);

    } else {
      // Single value
      const n = parseInt(trimmed, 10);
      if (isNaN(n) || n < min || n > max) return null;
      result.add(n);
    }
  }

  return [...result].sort((a, b) => a - b);
}

function parseCron(expr: string): { parsed: ParsedCron } | { error: string } {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) {
    return { error: `Expected 5 fields (minute hour day month weekday), got ${fields.length}` };
  }

  const [minF, hrF, domF, monF, dowF] = fields as [string, string, string, string, string];

  const minutes = parseField(minF, 0, 59);
  if (!minutes) return { error: `Invalid minute field: "${minF}" (valid range 0-59)` };

  const hours = parseField(hrF, 0, 23);
  if (!hours) return { error: `Invalid hour field: "${hrF}" (valid range 0-23)` };

  const daysOfMonth = parseField(domF, 1, 31);
  if (!daysOfMonth) return { error: `Invalid day-of-month field: "${domF}" (valid range 1-31)` };

  const months = parseField(monF, 1, 12);
  if (!months) return { error: `Invalid month field: "${monF}" (valid range 1-12)` };

  // Day of week accepts 0-7 (both 0 and 7 = Sunday)
  const rawDow = parseField(dowF, 0, 7);
  if (!rawDow) return { error: `Invalid day-of-week field: "${dowF}" (valid range 0-7)` };

  // Normalize 7 → 0 for Sunday
  const dowSet = new Set(rawDow.map((d) => (d === 7 ? 0 : d)));
  const daysOfWeek = [...dowSet].sort((a, b) => a - b);

  return {
    parsed: {
      minutes,
      hours,
      daysOfMonth,
      months,
      daysOfWeek,
      domRestricted: domF !== '*',
      dowRestricted: dowF !== '*',
      raw: expr,
    },
  };
}

// ─── Human-readable description ───────────────────────────────────────────────

function ordinal(n: number): string {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? 'th'
    : n % 10 === 1 ? 'st'
    : n % 10 === 2 ? 'nd'
    : n % 10 === 3 ? 'rd'
    : 'th';
  return `${n}${suffix}`;
}

function formatTime(hour: number, minute: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m} ${period}`;
}

function describeWeekdays(days: number[]): string {
  if (days.length === 7) return 'every day';

  const sorted = [...days].sort((a, b) => a - b);

  if (sorted.length === 1) return `on ${WEEKDAY_NAMES[sorted[0]!]}s`;

  // Monday–Friday
  if (sorted.join(',') === '1,2,3,4,5') return 'Monday through Friday';
  // Weekends
  if (sorted.join(',') === '0,6') return 'on weekends';

  // Consecutive range
  const isConsecutive = sorted.every((d, i) => i === 0 || d - sorted[i - 1]! === 1);
  if (isConsecutive) {
    return `${WEEKDAY_NAMES[sorted[0]!]} through ${WEEKDAY_NAMES[sorted[sorted.length - 1]!]}`;
  }

  const names = sorted.map((d) => WEEKDAY_NAMES[d]!);
  return `on ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function describeCron(p: ParsedCron): string {
  const fields = p.raw.trim().split(/\s+/) as [string, string, string, string, string];
  const [minF, hrF, , monF] = fields;

  const isSingleTime = p.minutes.length === 1 && p.hours.length === 1;
  const allMonths = p.months.length === 12;
  const allHours = p.hours.length === 24;

  // Every minute
  if (minF === '*' && hrF === '*' && !p.domRestricted && !p.dowRestricted && monF === '*') {
    return 'Every minute';
  }

  // Every N minutes:  */n * * * *
  const minStep = minF.match(/^\*\/(\d+)$/);
  if (minStep && hrF === '*' && !p.domRestricted && !p.dowRestricted && monF === '*') {
    const n = parseInt(minStep[1]!);
    return n === 1 ? 'Every minute' : `Every ${n} minutes`;
  }

  // At :MM of every hour:  M * * * *
  if (minF.match(/^\d+$/) && hrF === '*' && !p.domRestricted && !p.dowRestricted && monF === '*') {
    const min = p.minutes[0]!;
    return min === 0 ? 'Every hour' : `Every hour at :${minF.padStart(2, '0')}`;
  }

  // Every N hours:  0 */n * * *
  const hrStep = hrF.match(/^\*\/(\d+)$/);
  if (hrStep && minF === '0' && !p.domRestricted && !p.dowRestricted && monF === '*') {
    const n = parseInt(hrStep[1]!);
    return n === 1 ? 'Every hour' : `Every ${n} hours`;
  }

  // Every N hours at specific minute:  M */n * * *
  if (hrStep && !p.domRestricted && !p.dowRestricted && monF === '*' && p.minutes.length === 1) {
    const n = parseInt(hrStep[1]!);
    const min = p.minutes[0]!;
    return `Every ${n} hours at :${min.toString().padStart(2, '0')}`;
  }

  // Specific time, every day, every month, no weekday restriction
  if (isSingleTime && !p.domRestricted && !p.dowRestricted && allMonths) {
    const time = formatTime(p.hours[0]!, p.minutes[0]!);
    if (p.hours[0] === 0 && p.minutes[0] === 0) return 'At midnight every day';
    return `Every day at ${time}`;
  }

  // Specific time on specific weekday(s)
  if (isSingleTime && !p.domRestricted && p.dowRestricted && allMonths) {
    const time = formatTime(p.hours[0]!, p.minutes[0]!);
    return `At ${time}, ${describeWeekdays(p.daysOfWeek)}`;
  }

  // Specific time on specific day of month
  if (isSingleTime && p.domRestricted && !p.dowRestricted && allMonths) {
    const time = formatTime(p.hours[0]!, p.minutes[0]!);
    if (p.daysOfMonth.length === 1) {
      return `At ${time} on the ${ordinal(p.daysOfMonth[0]!)} of every month`;
    }
    return `At ${time} on day(s) ${p.daysOfMonth.join(', ')} of every month`;
  }

  // Specific time on specific month
  if (isSingleTime && !p.domRestricted && !p.dowRestricted && p.months.length === 1) {
    const time = formatTime(p.hours[0]!, p.minutes[0]!);
    return `At ${time} every day in ${MONTH_NAMES[p.months[0]! - 1]}`;
  }

  // Specific time on specific day of specific month
  if (isSingleTime && p.domRestricted && !p.dowRestricted && p.months.length === 1 && p.daysOfMonth.length === 1) {
    const time = formatTime(p.hours[0]!, p.minutes[0]!);
    return `At ${time} on ${MONTH_NAMES[p.months[0]! - 1]} ${ordinal(p.daysOfMonth[0]!)}`;
  }

  // Generic fallback: build description from parts
  const parts: string[] = [];

  if (allHours && p.minutes.length === 60) {
    parts.push('every minute');
  } else if (allHours && p.minutes.length === 1) {
    parts.push(`at minute :${p.minutes[0]!.toString().padStart(2, '0')} of every hour`);
  } else if (p.hours.length === 1 && p.minutes.length === 1) {
    parts.push(`at ${formatTime(p.hours[0]!, p.minutes[0]!)}`);
  } else if (p.hours.length > 1 && p.minutes.length === 1) {
    const timeList = p.hours.map((h) => formatTime(h, p.minutes[0]!)).join(', ');
    parts.push(`at ${timeList}`);
  } else {
    parts.push(`at minute(s) ${p.minutes.join(',')} of hour(s) ${p.hours.join(',')}`);
  }

  if (!allMonths) {
    const monthNames = p.months.map((m) => MONTH_NAMES[m - 1]!);
    parts.push(`in ${monthNames.join(', ')}`);
  }

  if (p.domRestricted && p.dowRestricted) {
    const domStr = p.daysOfMonth.join(', ');
    const dowStr = p.daysOfWeek.map((d) => WEEKDAY_NAMES[d]).join(', ');
    parts.push(`when day-of-month is ${domStr} or day-of-week is ${dowStr}`);
  } else if (p.domRestricted) {
    parts.push(`on day(s) ${p.daysOfMonth.join(', ')} of the month`);
  } else if (p.dowRestricted) {
    parts.push(describeWeekdays(p.daysOfWeek));
  }

  return parts.join(', ');
}

// ─── Next occurrences ─────────────────────────────────────────────────────────

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(month: number, year: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return DAYS_IN_MONTH[month]!;
}

function nextOccurrence(p: ParsedCron, after: Date): Date | null {
  // Start at the next whole minute after `after`
  const start = new Date(after);
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1);

  // Bail out after 4 years to prevent infinite loops on pathological expressions
  const deadline = new Date(after);
  deadline.setFullYear(deadline.getFullYear() + 4);

  let year = start.getFullYear();
  let month = start.getMonth() + 1; // 1-12
  let day = start.getDate();
  let hour = start.getHours();
  let minute = start.getMinutes();

  const { minutes, hours, daysOfMonth, months, daysOfWeek, domRestricted, dowRestricted } = p;

  while (true) {
    if (year > deadline.getFullYear() + 1) return null;

    // ── month ──
    if (!months.includes(month)) {
      const next = months.find((m) => m > month);
      if (next === undefined) { year++; month = months[0]!; }
      else month = next;
      day = 1; hour = 0; minute = 0;
      continue;
    }

    // ── day overflow (e.g. Feb 30) ──
    if (day > daysInMonth(month, year)) {
      month++;
      if (month > 12) { year++; month = 1; }
      day = 1; hour = 0; minute = 0;
      continue;
    }

    // ── day match ──
    const dow = new Date(year, month - 1, day).getDay(); // 0=Sunday

    let dayMatch: boolean;
    if (domRestricted && dowRestricted) {
      // Vixie cron OR semantics when both fields are restricted
      dayMatch = daysOfMonth.includes(day) || daysOfWeek.includes(dow);
    } else if (domRestricted) {
      dayMatch = daysOfMonth.includes(day);
    } else if (dowRestricted) {
      dayMatch = daysOfWeek.includes(dow);
    } else {
      dayMatch = true;
    }

    if (!dayMatch) {
      day++; hour = 0; minute = 0;
      continue;
    }

    // ── hour ──
    if (!hours.includes(hour)) {
      const next = hours.find((h) => h > hour);
      if (next === undefined) { day++; hour = 0; minute = 0; }
      else { hour = next; minute = 0; }
      continue;
    }

    // ── minute ──
    if (!minutes.includes(minute)) {
      const next = minutes.find((m) => m > minute);
      if (next === undefined) {
        const nextHour = hours.find((h) => h > hour);
        if (nextHour === undefined) { day++; hour = 0; minute = 0; }
        else { hour = nextHour; minute = 0; }
      } else {
        minute = next;
      }
      continue;
    }

    // All fields match
    const result = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (result > deadline) return null;
    return result;
  }
}

function getNextOccurrences(p: ParsedCron, after: Date, count: number): Date[] {
  const results: Date[] = [];
  let cursor = after;
  for (let i = 0; i < count; i++) {
    const next = nextOccurrence(p, cursor);
    if (!next) break;
    results.push(next);
    cursor = next;
  }
  return results;
}

// ─── Cron builder ─────────────────────────────────────────────────────────────

interface BuildParams {
  every: string;
  at?: string;
  on?: string;
}

function parseAtTime(at: string): { hour: number; minute: number } | null {
  // ":MM" means "at minute MM of every hour"
  const colonOnly = at.match(/^:(\d{1,2})$/);
  if (colonOnly) {
    const minute = parseInt(colonOnly[1]!, 10);
    if (minute < 0 || minute > 59) return null;
    return { hour: -1, minute };
  }
  // "HH:MM" or "H:MM"
  const full = at.match(/^(\d{1,2}):(\d{2})$/);
  if (!full) return null;
  const hour = parseInt(full[1]!, 10);
  const minute = parseInt(full[2]!, 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function buildCron(params: BuildParams): string | null {
  const { every, at, on } = params;
  const ev = every.toLowerCase().trim();

  // "every minute" / "minute"
  if (ev === 'minute' || ev === 'every minute') return '* * * * *';

  // "every N minutes"
  const minuteMatch = ev.match(/^(\d+)\s+minutes?$/);
  if (minuteMatch) {
    const n = parseInt(minuteMatch[1]!, 10);
    if (n < 1 || n > 59) return null;
    return n === 1 ? '* * * * *' : `*/${n} * * * *`;
  }

  // "every hour" / "hour"
  if (ev === 'hour' || ev === 'every hour') {
    const t = at ? parseAtTime(at) : null;
    const minute = t ? (t.hour === -1 ? t.minute : t.minute) : 0;
    return `${minute} * * * *`;
  }

  // "every N hours"
  const hourMatch = ev.match(/^(\d+)\s+hours?$/);
  if (hourMatch) {
    const n = parseInt(hourMatch[1]!, 10);
    if (n < 1 || n > 23) return null;
    const t = at ? parseAtTime(at) : null;
    const minute = t ? t.minute : 0;
    return n === 1 ? `${minute} * * * *` : `${minute} */${n} * * *`;
  }

  // "day"
  if (ev === 'day') {
    const t = at ? parseAtTime(at) : null;
    const hour = (t && t.hour !== -1) ? t.hour : 0;
    const minute = t ? t.minute : 0;
    return `${minute} ${hour} * * *`;
  }

  // "week" — optional `on` for weekday, `at` for time
  if (ev === 'week') {
    const t = at ? parseAtTime(at) : null;
    const hour = (t && t.hour !== -1) ? t.hour : 0;
    const minute = t ? t.minute : 0;
    let dow = 0;
    if (on) {
      const idx = WEEKDAY_NAMES.findIndex((d) => d.toLowerCase() === on.toLowerCase().trim());
      if (idx !== -1) dow = idx;
    }
    return `${minute} ${hour} * * ${dow}`;
  }

  // "month" — optional `on` for day-of-month, `at` for time
  if (ev === 'month') {
    const t = at ? parseAtTime(at) : null;
    const hour = (t && t.hour !== -1) ? t.hour : 0;
    const minute = t ? t.minute : 0;
    const dom = on ? parseInt(on.trim(), 10) : 1;
    if (isNaN(dom) || dom < 1 || dom > 31) return null;
    return `${minute} ${hour} ${dom} * *`;
  }

  // Weekday name: "monday", "tuesday", …
  const dayIdx = WEEKDAY_NAMES.findIndex((d) => d.toLowerCase() === ev);
  if (dayIdx !== -1) {
    const t = at ? parseAtTime(at) : null;
    const hour = (t && t.hour !== -1) ? t.hour : 0;
    const minute = t ? t.minute : 0;
    return `${minute} ${hour} * * ${dayIdx}`;
  }

  // "weekday" / "weekdays"
  if (ev === 'weekday' || ev === 'weekdays') {
    const t = at ? parseAtTime(at) : null;
    const hour = (t && t.hour !== -1) ? t.hour : 0;
    const minute = t ? t.minute : 0;
    return `${minute} ${hour} * * 1-5`;
  }

  // "weekend" / "weekends"
  if (ev === 'weekend' || ev === 'weekends') {
    const t = at ? parseAtTime(at) : null;
    const hour = (t && t.hour !== -1) ? t.hour : 0;
    const minute = t ? t.minute : 0;
    return `${minute} ${hour} * * 0,6`;
  }

  return null;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ExprSchema = z.object({
  expression: z.string().min(1).max(200),
});

const NextSchema = z.object({
  expression: z.string().min(1).max(200),
  count: z.number().int().min(1).max(50).default(5),
  after: z.string().datetime().optional(),
});

const BuildSchema = z.object({
  every: z.string().min(1).max(100),
  at: z.string().max(10).optional(),
  on: z.string().max(50).optional(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export function createCronRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /cron/parse — human-readable description of a cron expression
  router.post('/parse', requireScope('cron:use'), zv('json', ExprSchema), (c) => {
    const { expression } = c.req.valid('json');
    const result = parseCron(expression);
    if ('error' in result) throw Errors.validation(result.error);
    return ok(c, { expression, description: describeCron(result.parsed) });
  });

  // POST /cron/next — next N occurrences after an optional start time
  router.post('/next', requireScope('cron:use'), zv('json', NextSchema), (c) => {
    const { expression, count, after } = c.req.valid('json');
    const result = parseCron(expression);
    if ('error' in result) throw Errors.validation(result.error);
    const afterDate = after ? new Date(after) : new Date();
    const occurrences = getNextOccurrences(result.parsed, afterDate, count);
    return ok(c, {
      expression,
      count: occurrences.length,
      occurrences: occurrences.map((d) => d.toISOString()),
    });
  });

  // POST /cron/validate — check expression validity with field-level feedback
  router.post('/validate', requireScope('cron:use'), zv('json', ExprSchema), (c) => {
    const { expression } = c.req.valid('json');
    const fields = expression.trim().split(/\s+/);
    const result = parseCron(expression);

    if ('error' in result) {
      return ok(c, { expression, valid: false, error: result.error });
    }

    return ok(c, {
      expression,
      valid: true,
      fields: {
        minute: fields[0]!,
        hour: fields[1]!,
        day_of_month: fields[2]!,
        month: fields[3]!,
        day_of_week: fields[4]!,
      },
    });
  });

  // POST /cron/build — build a cron expression from human-readable parameters
  router.post('/build', requireScope('cron:use'), zv('json', BuildSchema), (c) => {
    const params = c.req.valid('json');
    const expression = buildCron(params);
    if (!expression) {
      throw Errors.validation(
        'Could not build a cron expression from the provided parameters. ' +
        'Try values like: every="day" at="09:00", every="5 minutes", ' +
        'every="monday" at="14:30", every="week" on="friday" at="09:00"',
      );
    }
    const parseResult = parseCron(expression);
    const description = 'parsed' in parseResult ? describeCron(parseResult.parsed) : '';
    return ok(c, { expression, description });
  });

  return router;
}
