/**
 * Tests for UnClick Lorem - /v1/lorem
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app.js';
import { setupTestDb } from './setup.js';

let app: ReturnType<typeof createApp>;
let apiKey: string;

function authHeaders(key: string) {
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

beforeAll(async () => {
  apiKey = await setupTestDb();
  app = createApp();
});

async function post(path: string, body: unknown) {
  return app.request(`/v1/lorem${path}`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
  });
}

// ─── POST /v1/lorem/paragraphs ────────────────────────────────────────────────

describe('POST /v1/lorem/paragraphs', () => {
  it('generates default 3 paragraphs', async () => {
    const res = await post('/paragraphs', {});
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.count).toBe(3);
    expect(body.data.paragraphs).toHaveLength(3);
    expect(typeof body.data.text).toBe('string');
    expect(body.data.text.length).toBeGreaterThan(0);
  });

  it('generates N paragraphs', async () => {
    const res = await post('/paragraphs', { count: 7 });
    const body = await res.json() as any;
    expect(body.data.paragraphs).toHaveLength(7);
  });

  it('returns 400 when count exceeds max (50)', async () => {
    const res = await post('/paragraphs', { count: 51 });
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/v1/lorem/paragraphs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });
});

// ─── POST /v1/lorem/sentences ────────────────────────────────────────────────

describe('POST /v1/lorem/sentences', () => {
  it('generates default 5 sentences', async () => {
    const res = await post('/sentences', {});
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.count).toBe(5);
    expect(body.data.sentences).toHaveLength(5);
    for (const s of body.data.sentences) {
      expect(s.endsWith('.')).toBe(true);
    }
  });

  it('generates N sentences', async () => {
    const res = await post('/sentences', { count: 20 });
    const body = await res.json() as any;
    expect(body.data.sentences).toHaveLength(20);
  });

  it('returns 400 when count exceeds max (200)', async () => {
    const res = await post('/sentences', { count: 201 });
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/lorem/words ────────────────────────────────────────────────────

describe('POST /v1/lorem/words', () => {
  it('generates default 50 words', async () => {
    const res = await post('/words', {});
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.count).toBe(50);
    expect(body.data.words).toHaveLength(50);
  });

  it('generates N words', async () => {
    const res = await post('/words', { count: 100 });
    const body = await res.json() as any;
    expect(body.data.words).toHaveLength(100);
    expect(body.data.text.split(' ')).toHaveLength(100);
  });

  it('returns 400 when count exceeds max (1000)', async () => {
    const res = await post('/words', { count: 1001 });
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/lorem/text ─────────────────────────────────────────────────────

describe('POST /v1/lorem/text', () => {
  it('generates text of approximately the given length', async () => {
    const res = await post('/text', { length: 500 });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.text).toHaveLength(500);
    expect(body.data.length).toBe(500);
  });

  it('generates text with default length 500', async () => {
    const res = await post('/text', {});
    const body = await res.json() as any;
    expect(body.data.text).toHaveLength(500);
  });

  it('returns 400 when length exceeds max (100000)', async () => {
    const res = await post('/text', { length: 100001 });
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/lorem/list ─────────────────────────────────────────────────────

describe('POST /v1/lorem/list', () => {
  it('generates a list of items', async () => {
    const res = await post('/list', { count: 5 });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.items).toHaveLength(5);
    for (const item of body.data.items) {
      expect(typeof item).toBe('string');
      expect(item.length).toBeGreaterThan(0);
    }
  });

  it('generates default 10 items', async () => {
    const res = await post('/list', {});
    const body = await res.json() as any;
    expect(body.data.items).toHaveLength(10);
  });
});

// ─── POST /v1/lorem/name ─────────────────────────────────────────────────────

describe('POST /v1/lorem/name', () => {
  it('generates a single name by default', async () => {
    const res = await post('/name', {});
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(typeof body.data.first).toBe('string');
    expect(typeof body.data.last).toBe('string');
    expect(body.data.full).toBe(`${body.data.first} ${body.data.last}`);
  });

  it('generates multiple names', async () => {
    const res = await post('/name', { count: 5 });
    const body = await res.json() as any;
    expect(body.data.names).toHaveLength(5);
    for (const n of body.data.names) {
      expect(n.full).toBeTruthy();
    }
  });
});

// ─── POST /v1/lorem/email ────────────────────────────────────────────────────

describe('POST /v1/lorem/email', () => {
  it('generates a single email by default', async () => {
    const res = await post('/email', {});
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.email).toContain('@');
  });

  it('generates multiple emails', async () => {
    const res = await post('/email', { count: 5 });
    const body = await res.json() as any;
    expect(body.data.emails).toHaveLength(5);
    for (const e of body.data.emails) {
      expect(e).toContain('@');
    }
  });
});

// ─── POST /v1/lorem/address ──────────────────────────────────────────────────

describe('POST /v1/lorem/address', () => {
  it('generates a single address by default', async () => {
    const res = await post('/address', {});
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(typeof body.data.street_number).toBe('number');
    expect(typeof body.data.street).toBe('string');
    expect(typeof body.data.city).toBe('string');
    expect(typeof body.data.state).toBe('string');
    expect(typeof body.data.zip).toBe('string');
    expect(body.data.full).toContain(String(body.data.street_number));
  });

  it('generates multiple addresses', async () => {
    const res = await post('/address', { count: 3 });
    const body = await res.json() as any;
    expect(body.data.addresses).toHaveLength(3);
    for (const a of body.data.addresses) {
      expect(a.full).toBeTruthy();
    }
  });
});
