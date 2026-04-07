/**
 * Tests for UnClick Random - /v1/random
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

describe('Random - auth', () => {
  it('rejects requests with no API key', async () => {
    const res = await app.request('/v1/random/number', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /v1/random/number
// ---------------------------------------------------------------------------

describe('Random - number', () => {
  it('returns a number in range with default settings', async () => {
    const res = await post('/v1/random/number', { min: 1, max: 10 });
    expect(res.status).toBe(200);
    const body = await json<{ data: { number: number; count: number } }>(res);
    expect(body.data.number).toBeGreaterThanOrEqual(1);
    expect(body.data.number).toBeLessThanOrEqual(10);
    expect(body.data.count).toBe(1);
  });

  it('returns multiple numbers', async () => {
    const res = await post('/v1/random/number', { min: 0, max: 100, count: 5 });
    expect(res.status).toBe(200);
    const body = await json<{ data: { numbers: number[]; count: number } }>(res);
    expect(body.data.numbers).toHaveLength(5);
    expect(body.data.count).toBe(5);
    for (const n of body.data.numbers) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(100);
    }
  });

  it('returns decimal numbers', async () => {
    const res = await post('/v1/random/number', { min: 0, max: 1, decimals: 2 });
    expect(res.status).toBe(200);
    const body = await json<{ data: { number: number } }>(res);
    // Check it has at most 2 decimal places
    expect(String(body.data.number).replace(/^\d+\.?/, '').length).toBeLessThanOrEqual(2);
  });

  it('rejects min >= max', async () => {
    const res = await post('/v1/random/number', { min: 5, max: 5 });
    expect(res.status).toBe(400);
  });

  it('rejects count > 1000', async () => {
    const res = await post('/v1/random/number', { min: 0, max: 10, count: 1001 });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /v1/random/string
// ---------------------------------------------------------------------------

describe('Random - string', () => {
  it('generates an alphanumeric string by default', async () => {
    const res = await post('/v1/random/string', { length: 16 });
    expect(res.status).toBe(200);
    const body = await json<{ data: { string: string; length: number } }>(res);
    expect(body.data.string).toHaveLength(16);
    expect(body.data.string).toMatch(/^[a-zA-Z0-9]+$/);
  });

  it('generates a hex string', async () => {
    const res = await post('/v1/random/string', { length: 32, charset: 'hex' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { string: string } }>(res);
    expect(body.data.string).toMatch(/^[0-9a-f]{32}$/);
  });

  it('generates an alpha-only string', async () => {
    const res = await post('/v1/random/string', { length: 20, charset: 'alpha' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { string: string } }>(res);
    expect(body.data.string).toMatch(/^[a-zA-Z]{20}$/);
  });

  it('generates a numeric string', async () => {
    const res = await post('/v1/random/string', { length: 10, charset: 'numeric' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { string: string } }>(res);
    expect(body.data.string).toMatch(/^\d{10}$/);
  });

  it('generates a custom charset string', async () => {
    const res = await post('/v1/random/string', {
      length: 12,
      charset: 'custom',
      custom_chars: 'abc',
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { string: string } }>(res);
    expect(body.data.string).toMatch(/^[abc]{12}$/);
  });

  it('generates multiple strings', async () => {
    const res = await post('/v1/random/string', { length: 8, count: 5 });
    expect(res.status).toBe(200);
    const body = await json<{ data: { strings: string[]; count: number } }>(res);
    expect(body.data.strings).toHaveLength(5);
  });

  it('rejects custom charset without custom_chars', async () => {
    const res = await post('/v1/random/string', { length: 10, charset: 'custom' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /v1/random/password
// ---------------------------------------------------------------------------

describe('Random - password', () => {
  it('generates a password with all options by default', async () => {
    const res = await post('/v1/random/password', { length: 20 });
    expect(res.status).toBe(200);
    const body = await json<{ data: { password: string; length: number } }>(res);
    expect(body.data.password).toHaveLength(20);
    // Should contain at least one of each type
    expect(body.data.password).toMatch(/[A-Z]/);
    expect(body.data.password).toMatch(/[a-z]/);
    expect(body.data.password).toMatch(/\d/);
  });

  it('generates only uppercase + numbers', async () => {
    const res = await post('/v1/random/password', {
      length: 16,
      uppercase: true,
      lowercase: false,
      numbers: true,
      symbols: false,
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { password: string } }>(res);
    expect(body.data.password).toMatch(/^[A-Z0-9]{16}$/);
  });

  it('generates multiple passwords', async () => {
    const res = await post('/v1/random/password', { length: 12, count: 3 });
    expect(res.status).toBe(200);
    const body = await json<{ data: { passwords: string[]; count: number } }>(res);
    expect(body.data.passwords).toHaveLength(3);
    expect(body.data.count).toBe(3);
  });

  it('rejects when all character sets are disabled', async () => {
    const res = await post('/v1/random/password', {
      length: 10,
      uppercase: false,
      lowercase: false,
      numbers: false,
      symbols: false,
    });
    expect(res.status).toBe(400);
  });

  it('rejects length < 4', async () => {
    const res = await post('/v1/random/password', { length: 3 });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /v1/random/pick
// ---------------------------------------------------------------------------

describe('Random - pick', () => {
  const items = ['apple', 'banana', 'cherry', 'date', 'elderberry'];

  it('picks one item by default', async () => {
    const res = await post('/v1/random/pick', { items });
    expect(res.status).toBe(200);
    const body = await json<{ data: { item: string; count: number } }>(res);
    expect(body.data.count).toBe(1);
    expect(items).toContain(body.data.item);
  });

  it('picks multiple items', async () => {
    const res = await post('/v1/random/pick', { items, count: 3 });
    expect(res.status).toBe(200);
    const body = await json<{ data: { picked: string[] } }>(res);
    expect(body.data.picked).toHaveLength(3);
    for (const item of body.data.picked) {
      expect(items).toContain(item);
    }
  });

  it('picks unique items without replacement', async () => {
    const res = await post('/v1/random/pick', { items, count: 5, unique: true });
    expect(res.status).toBe(200);
    const body = await json<{ data: { picked: string[] } }>(res);
    const set = new Set(body.data.picked);
    expect(set.size).toBe(5);
  });

  it('rejects picking more unique items than available', async () => {
    const res = await post('/v1/random/pick', { items, count: 10, unique: true });
    expect(res.status).toBe(400);
  });

  it('rejects empty items array', async () => {
    const res = await post('/v1/random/pick', { items: [] });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /v1/random/shuffle
// ---------------------------------------------------------------------------

describe('Random - shuffle', () => {
  it('returns a shuffled array of the same elements', async () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const res = await post('/v1/random/shuffle', { items });
    expect(res.status).toBe(200);
    const body = await json<{ data: { shuffled: number[]; count: number } }>(res);
    expect(body.data.shuffled).toHaveLength(10);
    expect(body.data.count).toBe(10);
    // Same elements, possibly different order
    expect([...body.data.shuffled].sort((a, b) => a - b)).toEqual(items);
  });

  it('handles a single-item array', async () => {
    const res = await post('/v1/random/shuffle', { items: ['only'] });
    expect(res.status).toBe(200);
    const body = await json<{ data: { shuffled: string[] } }>(res);
    expect(body.data.shuffled).toEqual(['only']);
  });
});

// ---------------------------------------------------------------------------
// POST /v1/random/color
// ---------------------------------------------------------------------------

describe('Random - color', () => {
  it('generates a hex color by default', async () => {
    const res = await post('/v1/random/color', {});
    expect(res.status).toBe(200);
    const body = await json<{ data: { color: string; format: string } }>(res);
    expect(body.data.format).toBe('hex');
    expect(body.data.color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('generates an RGB color', async () => {
    const res = await post('/v1/random/color', { format: 'rgb' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { color: { r: number; g: number; b: number; css: string } } }>(res);
    expect(body.data.color.r).toBeGreaterThanOrEqual(0);
    expect(body.data.color.r).toBeLessThanOrEqual(255);
    expect(body.data.color.css).toMatch(/^rgb\(/);
  });

  it('generates an HSL color', async () => {
    const res = await post('/v1/random/color', { format: 'hsl' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { color: { h: number; s: number; l: number; css: string } } }>(res);
    expect(body.data.color.h).toBeGreaterThanOrEqual(0);
    expect(body.data.color.h).toBeLessThanOrEqual(360);
    expect(body.data.color.css).toMatch(/^hsl\(/);
  });

  it('generates multiple hex colors', async () => {
    const res = await post('/v1/random/color', { format: 'hex', count: 5 });
    expect(res.status).toBe(200);
    const body = await json<{ data: { colors: string[]; count: number } }>(res);
    expect(body.data.colors).toHaveLength(5);
    for (const c of body.data.colors) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('rejects invalid format', async () => {
    const res = await post('/v1/random/color', { format: 'cmyk' });
    expect(res.status).toBe(400);
  });
});
