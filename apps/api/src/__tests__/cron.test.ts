/**
 * Tests for UnClick Cron - /v1/cron
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app.js';
import { setupTestDb } from './setup.js';

let app: ReturnType<typeof createApp>;
let apiKey: string;

function auth(key: string) {
  return { Authorization: `Bearer ${key}` };
}

beforeAll(async () => {
  apiKey = await setupTestDb();
  app = createApp();
});

async function post(path: string, body: unknown) {
  return app.request(`/v1/cron${path}`, {
    method: 'POST',
    headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── POST /v1/cron/validate ───────────────────────────────────────────────────

describe('POST /v1/cron/validate', () => {
  it('marks a valid expression as valid', async () => {
    const res = await post('/validate', { expression: '*/5 * * * *' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.valid).toBe(true);
    expect(body.data.fields.minute).toBe('*/5');
  });

  it('marks an invalid expression as invalid', async () => {
    const res = await post('/validate', { expression: '99 * * * *' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.valid).toBe(false);
    expect(body.data.error).toBeTruthy();
  });

  it('rejects wrong field count', async () => {
    const res = await post('/validate', { expression: '* * *' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.valid).toBe(false);
  });

  it('returns five field values on success', async () => {
    const res = await post('/validate', { expression: '0 9 * * 1-5' });
    const body = await res.json() as any;
    expect(body.data.valid).toBe(true);
    expect(body.data.fields.hour).toBe('9');
    expect(body.data.fields.day_of_week).toBe('1-5');
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/v1/cron/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expression: '* * * * *' }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── POST /v1/cron/parse ─────────────────────────────────────────────────────

describe('POST /v1/cron/parse', () => {
  it('describes every minute', async () => {
    const res = await post('/parse', { expression: '* * * * *' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.description).toBe('Every minute');
  });

  it('describes every 5 minutes', async () => {
    const res = await post('/parse', { expression: '*/5 * * * *' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.description).toBe('Every 5 minutes');
  });

  it('describes every hour', async () => {
    const res = await post('/parse', { expression: '0 * * * *' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.description).toBe('Every hour');
  });

  it('describes every day at 9:00 AM', async () => {
    const res = await post('/parse', { expression: '0 9 * * *' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.description).toContain('9:00 AM');
  });

  it('describes midnight every day', async () => {
    const res = await post('/parse', { expression: '0 0 * * *' });
    const body = await res.json() as any;
    expect(body.data.description.toLowerCase()).toContain('midnight');
  });

  it('describes weekday schedule', async () => {
    const res = await post('/parse', { expression: '0 9 * * 1-5' });
    const body = await res.json() as any;
    expect(body.data.description).toContain('Monday');
    expect(body.data.description).toContain('Friday');
  });

  it('describes a specific day of month', async () => {
    const res = await post('/parse', { expression: '0 9 1 * *' });
    const body = await res.json() as any;
    expect(body.data.description).toContain('1st');
  });

  it('returns 400 for an invalid expression', async () => {
    const res = await post('/parse', { expression: 'not valid' });
    expect(res.status).toBe(400);
  });

  it('reflects the expression in the response', async () => {
    const expression = '30 14 * * 3';
    const res = await post('/parse', { expression });
    const body = await res.json() as any;
    expect(body.data.expression).toBe(expression);
  });
});

// ─── POST /v1/cron/next ──────────────────────────────────────────────────────

describe('POST /v1/cron/next', () => {
  it('returns 5 occurrences by default', async () => {
    const res = await post('/next', {
      expression: '*/15 * * * *',
      after: '2026-01-01T00:00:00.000Z',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.count).toBe(5);
    expect(body.data.occurrences).toHaveLength(5);
  });

  it('returns the requested number of occurrences', async () => {
    const res = await post('/next', {
      expression: '0 * * * *',
      count: 3,
      after: '2026-01-01T00:00:00.000Z',
    });
    const body = await res.json() as any;
    expect(body.data.count).toBe(3);
    expect(body.data.occurrences).toHaveLength(3);
  });

  it('occurrences are valid ISO datetime strings', async () => {
    const res = await post('/next', {
      expression: '0 9 * * *',
      count: 2,
      after: '2026-01-01T00:00:00.000Z',
    });
    const body = await res.json() as any;
    for (const ts of body.data.occurrences) {
      expect(() => new Date(ts)).not.toThrow();
      expect(new Date(ts).getHours()).toBe(9);
    }
  });

  it('respects the after parameter', async () => {
    const after = '2026-06-15T12:00:00.000Z';
    const res = await post('/next', {
      expression: '0 0 * * *',
      count: 1,
      after,
    });
    const body = await res.json() as any;
    const occ = new Date(body.data.occurrences[0]);
    expect(occ > new Date(after)).toBe(true);
  });

  it('defaults `after` to now when not provided', async () => {
    const before = new Date();
    const res = await post('/next', { expression: '* * * * *', count: 1 });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(new Date(body.data.occurrences[0]) >= before).toBe(true);
  });

  it('rejects count > 50', async () => {
    const res = await post('/next', { expression: '* * * * *', count: 51 });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid expression', async () => {
    const res = await post('/next', { expression: '60 * * * *' });
    expect(res.status).toBe(400);
  });

  it('evenly spaces occurrences for */15 expression', async () => {
    const res = await post('/next', {
      expression: '*/15 * * * *',
      count: 4,
      after: '2026-01-01T00:00:00.000Z',
    });
    const body = await res.json() as any;
    const minutes = body.data.occurrences.map((s: string) => new Date(s).getMinutes());
    expect(minutes).toEqual([15, 30, 45, 0]);
  });
});

// ─── POST /v1/cron/build ─────────────────────────────────────────────────────

describe('POST /v1/cron/build', () => {
  it('builds every 5 minutes', async () => {
    const res = await post('/build', { every: '5 minutes' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.expression).toBe('*/5 * * * *');
  });

  it('builds every day at 09:00', async () => {
    const res = await post('/build', { every: 'day', at: '09:00' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.expression).toBe('0 9 * * *');
  });

  it('builds a weekday schedule', async () => {
    const res = await post('/build', { every: 'monday', at: '14:30' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.expression).toBe('30 14 * * 1');
  });

  it('builds every minute', async () => {
    const res = await post('/build', { every: 'minute' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.expression).toBe('* * * * *');
  });

  it('builds every hour', async () => {
    const res = await post('/build', { every: 'hour' });
    const body = await res.json() as any;
    expect(body.data.expression).toBe('0 * * * *');
  });

  it('builds every hour at :30', async () => {
    const res = await post('/build', { every: 'hour', at: ':30' });
    const body = await res.json() as any;
    expect(body.data.expression).toBe('30 * * * *');
  });

  it('builds weekdays at a time', async () => {
    const res = await post('/build', { every: 'weekdays', at: '09:00' });
    const body = await res.json() as any;
    expect(body.data.expression).toBe('0 9 * * 1-5');
  });

  it('builds monthly with a day', async () => {
    const res = await post('/build', { every: 'month', on: '1', at: '00:00' });
    const body = await res.json() as any;
    expect(body.data.expression).toBe('0 0 1 * *');
  });

  it('includes a description in the response', async () => {
    const res = await post('/build', { every: 'day', at: '09:00' });
    const body = await res.json() as any;
    expect(body.data.description).toBeTruthy();
    expect(typeof body.data.description).toBe('string');
  });

  it('returns 400 for unrecognised every value', async () => {
    const res = await post('/build', { every: 'whenever' });
    expect(res.status).toBe(400);
  });
});
