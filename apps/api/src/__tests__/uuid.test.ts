/**
 * Tests for UnClick UUID — /v1/uuid
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

describe('UUID — auth', () => {
  it('rejects requests with no API key', async () => {
    const res = await app.request('/v1/uuid/v4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /v1/uuid/v4
// ---------------------------------------------------------------------------

describe('UUID — v4 generation', () => {
  it('generates a single UUID by default', async () => {
    const res = await post('/v1/uuid/v4', {});
    expect(res.status).toBe(200);
    const body = await json<{ data: { uuid: string; count: number } }>(res);
    expect(body.data.count).toBe(1);
    expect(body.data.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('generates multiple UUIDs', async () => {
    const res = await post('/v1/uuid/v4', { count: 5 });
    expect(res.status).toBe(200);
    const body = await json<{ data: { uuids: string[]; count: number } }>(res);
    expect(body.data.count).toBe(5);
    expect(body.data.uuids).toHaveLength(5);
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (const u of body.data.uuids) {
      expect(u).toMatch(uuidRe);
    }
  });

  it('generates 100 UUIDs (max)', async () => {
    const res = await post('/v1/uuid/v4', { count: 100 });
    expect(res.status).toBe(200);
    const body = await json<{ data: { uuids: string[] } }>(res);
    expect(body.data.uuids).toHaveLength(100);
  });

  it('rejects count > 100', async () => {
    const res = await post('/v1/uuid/v4', { count: 101 });
    expect(res.status).toBe(400);
  });

  it('rejects count < 1', async () => {
    const res = await post('/v1/uuid/v4', { count: 0 });
    expect(res.status).toBe(400);
  });

  it('generates unique UUIDs', async () => {
    const res = await post('/v1/uuid/v4', { count: 10 });
    const body = await json<{ data: { uuids: string[] } }>(res);
    const set = new Set(body.data.uuids);
    expect(set.size).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// POST /v1/uuid/validate
// ---------------------------------------------------------------------------

describe('UUID — validate', () => {
  it('validates a UUIDv4', async () => {
    const res = await post('/v1/uuid/validate', {
      uuid: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean; version: number } }>(res);
    // Version comes from the 13th hex digit: 4
    expect(body.data.valid).toBe(true);
    expect(body.data.version).toBe(4);
  });

  it('validates a UUIDv1', async () => {
    const res = await post('/v1/uuid/validate', {
      uuid: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean; version: number } }>(res);
    expect(body.data.valid).toBe(true);
    expect(body.data.version).toBe(1);
  });

  it('rejects a plain string', async () => {
    const res = await post('/v1/uuid/validate', { uuid: 'not-a-uuid' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean; version: null } }>(res);
    expect(body.data.valid).toBe(false);
    expect(body.data.version).toBeNull();
  });

  it('rejects an empty string', async () => {
    const res = await post('/v1/uuid/validate', { uuid: '' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { valid: boolean } }>(res);
    expect(body.data.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /v1/uuid/parse
// ---------------------------------------------------------------------------

describe('UUID — parse', () => {
  it('parses a well-known UUID', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const res = await post('/v1/uuid/parse', { uuid });
    expect(res.status).toBe(200);
    const body = await json<{
      data: {
        time_low: string;
        time_mid: string;
        time_hi: string;
        clock_seq_hi: string;
        clock_seq_low: string;
        node: string;
        version: number;
        variant: string;
      };
    }>(res);
    expect(body.data.time_low).toBe('550e8400');
    expect(body.data.time_mid).toBe('e29b');
    expect(body.data.time_hi).toBe('41d4');
    expect(body.data.version).toBe(4);
    expect(body.data.node).toBe('446655440000');
  });

  it('parses a freshly generated UUIDv4', async () => {
    // First generate one, then parse it.
    const genRes = await post('/v1/uuid/v4', {});
    const genBody = await json<{ data: { uuid: string } }>(genRes);
    const uuid = genBody.data.uuid;

    const parseRes = await post('/v1/uuid/parse', { uuid });
    expect(parseRes.status).toBe(200);
    const parseBody = await json<{ data: { version: number; input: string } }>(parseRes);
    expect(parseBody.data.version).toBe(4);
    expect(parseBody.data.input).toBe(uuid);
  });

  it('returns 400 for a non-UUID string', async () => {
    const res = await post('/v1/uuid/parse', { uuid: 'hello-world' });
    expect(res.status).toBe(400);
  });
});
