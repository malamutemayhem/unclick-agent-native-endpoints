/**
 * Tests for UnClick Timestamp — /v1/timestamp
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app.js';
import { setupTestDb } from './setup.js';

let app: ReturnType<typeof createApp>;
let devKey: string;

function auth() {
  return { Authorization: `Bearer ${devKey}`, 'Content-Type': 'application/json' };
}

async function post(path: string, body: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: auth(),
    body: JSON.stringify(body),
  });
}

async function json<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

beforeAll(async () => {
  devKey = await setupTestDb();
  app = createApp();
});

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

describe('Timestamp — auth', () => {
  it('rejects requests with no API key', async () => {
    const res = await app.request('/v1/timestamp/now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /v1/timestamp/now
// ---------------------------------------------------------------------------

describe('Timestamp — now', () => {
  it('returns current time in all formats', async () => {
    const before = Date.now();
    const res = await post('/v1/timestamp/now', {});
    const after = Date.now();

    expect(res.status).toBe(200);
    const body = await json<{
      data: { iso: string; unix_seconds: number; unix_ms: number; utc_string: string };
    }>(res);

    expect(body.data.unix_ms).toBeGreaterThanOrEqual(before);
    expect(body.data.unix_ms).toBeLessThanOrEqual(after);
    expect(body.data.unix_seconds).toBe(Math.floor(body.data.unix_ms / 1000));
    expect(new Date(body.data.iso).getTime()).toBe(body.data.unix_ms);
    expect(body.data.utc_string).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// POST /v1/timestamp/convert
// ---------------------------------------------------------------------------

describe('Timestamp — convert', () => {
  const iso = '2024-01-15T12:00:00.000Z';
  const expectedMs = new Date(iso).getTime();
  const expectedSeconds = Math.floor(expectedMs / 1000);

  it('converts an ISO string', async () => {
    const res = await post('/v1/timestamp/convert', { timestamp: iso });
    expect(res.status).toBe(200);
    const body = await json<{ data: { iso: string; unix_seconds: number; unix_ms: number } }>(res);
    expect(body.data.unix_ms).toBe(expectedMs);
    expect(body.data.unix_seconds).toBe(expectedSeconds);
    expect(body.data.iso).toBe(iso);
  });

  it('converts Unix seconds', async () => {
    const res = await post('/v1/timestamp/convert', { timestamp: expectedSeconds });
    expect(res.status).toBe(200);
    const body = await json<{ data: { unix_ms: number; unix_seconds: number } }>(res);
    expect(body.data.unix_seconds).toBe(expectedSeconds);
    expect(body.data.unix_ms).toBe(expectedMs);
  });

  it('converts Unix milliseconds', async () => {
    const res = await post('/v1/timestamp/convert', { timestamp: expectedMs });
    expect(res.status).toBe(200);
    const body = await json<{ data: { unix_ms: number } }>(res);
    expect(body.data.unix_ms).toBe(expectedMs);
  });

  it('rejects an invalid timestamp string', async () => {
    const res = await post('/v1/timestamp/convert', { timestamp: 'not-a-date' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /v1/timestamp/diff
// ---------------------------------------------------------------------------

describe('Timestamp — diff', () => {
  it('computes the diff between two ISO strings', async () => {
    const from = '2024-01-01T00:00:00.000Z';
    const to = '2024-01-02T00:00:00.000Z';
    const res = await post('/v1/timestamp/diff', { from, to });
    expect(res.status).toBe(200);
    const body = await json<{ data: { diff_seconds: number; diff_days: number } }>(res);
    expect(body.data.diff_seconds).toBe(86_400);
    expect(body.data.diff_days).toBe(1);
  });

  it('returns a negative diff when from > to', async () => {
    const res = await post('/v1/timestamp/diff', {
      from: '2024-01-02T00:00:00.000Z',
      to: '2024-01-01T00:00:00.000Z',
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { diff_seconds: number; absolute: { seconds: number } } }>(res);
    expect(body.data.diff_seconds).toBe(-86_400);
    expect(body.data.absolute.seconds).toBe(86_400);
  });

  it('accepts Unix timestamps', async () => {
    const from = 0;     // 1970-01-01
    const to = 3600;    // 1 hour later
    const res = await post('/v1/timestamp/diff', { from, to });
    expect(res.status).toBe(200);
    const body = await json<{ data: { diff_seconds: number; diff_hours: number } }>(res);
    expect(body.data.diff_seconds).toBe(3600);
    expect(body.data.diff_hours).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// POST /v1/timestamp/add
// ---------------------------------------------------------------------------

describe('Timestamp — add', () => {
  it('adds days to a timestamp', async () => {
    const ts = '2024-01-01T00:00:00.000Z';
    const res = await post('/v1/timestamp/add', {
      timestamp: ts,
      duration: { days: 5 },
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { result: { iso: string; unix_seconds: number } } }>(res);
    const resultDate = new Date(body.data.result.iso);
    const expectedDate = new Date('2024-01-06T00:00:00.000Z');
    // Allow small floating-point rounding from month/year approximations.
    expect(Math.abs(resultDate.getTime() - expectedDate.getTime())).toBeLessThan(1000);
  });

  it('adds hours and minutes', async () => {
    const ts = '2024-01-01T00:00:00.000Z';
    const res = await post('/v1/timestamp/add', {
      timestamp: ts,
      duration: { hours: 2, minutes: 30 },
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { result: { unix_ms: number } } }>(res);
    const expected = new Date('2024-01-01T02:30:00.000Z').getTime();
    expect(body.data.result.unix_ms).toBe(expected);
  });

  it('accepts zero duration', async () => {
    const ts = '2024-06-15T10:00:00.000Z';
    const res = await post('/v1/timestamp/add', { timestamp: ts, duration: {} });
    expect(res.status).toBe(200);
    const body = await json<{ data: { result: { iso: string } } }>(res);
    expect(body.data.result.iso).toBe(ts);
  });
});

// ---------------------------------------------------------------------------
// POST /v1/timestamp/format
// ---------------------------------------------------------------------------

describe('Timestamp — format', () => {
  const ts = '2024-03-07T14:05:09.000Z';

  it('formats YYYY-MM-DD', async () => {
    const res = await post('/v1/timestamp/format', { timestamp: ts, format: 'YYYY-MM-DD' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { result: string } }>(res);
    expect(body.data.result).toBe('2024-03-07');
  });

  it('formats HH:mm:ss', async () => {
    const res = await post('/v1/timestamp/format', { timestamp: ts, format: 'HH:mm:ss' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { result: string } }>(res);
    expect(body.data.result).toBe('14:05:09');
  });

  it('formats a combined pattern', async () => {
    const res = await post('/v1/timestamp/format', {
      timestamp: ts,
      format: 'YYYY/MM/DD HH:mm',
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { result: string } }>(res);
    expect(body.data.result).toBe('2024/03/07 14:05');
  });

  it('rejects missing format', async () => {
    const res = await post('/v1/timestamp/format', { timestamp: ts });
    expect(res.status).toBe(400);
  });
});
