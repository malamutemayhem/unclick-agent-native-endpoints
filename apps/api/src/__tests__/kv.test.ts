/**
 * Tests for UnClick KV — /v1/kv
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

async function kv(path: string, body: unknown) {
  return app.request(`/v1/kv${path}`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
  });
}

// ─── POST /v1/kv/set + /v1/kv/get ────────────────────────────────────────────

describe('POST /v1/kv/set and /v1/kv/get', () => {
  it('stores and retrieves a string value', async () => {
    await kv('/set', { key: 'greeting', value: 'hello world' });
    const res = await kv('/get', { key: 'greeting' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.value).toBe('hello world');
  });

  it('stores and retrieves a JSON object', async () => {
    await kv('/set', { key: 'user:1', value: { name: 'Alice', age: 30 } });
    const res = await kv('/get', { key: 'user:1' });
    const body = await res.json() as any;
    expect(body.data.value).toEqual({ name: 'Alice', age: 30 });
  });

  it('stores and retrieves a number', async () => {
    await kv('/set', { key: 'counter', value: 42 });
    const res = await kv('/get', { key: 'counter' });
    const body = await res.json() as any;
    expect(body.data.value).toBe(42);
  });

  it('stores and retrieves null', async () => {
    await kv('/set', { key: 'nullval', value: null });
    const res = await kv('/get', { key: 'nullval' });
    const body = await res.json() as any;
    expect(body.data.value).toBeNull();
  });

  it('overwrites an existing key', async () => {
    await kv('/set', { key: 'overwrite', value: 'first' });
    await kv('/set', { key: 'overwrite', value: 'second' });
    const res = await kv('/get', { key: 'overwrite' });
    const body = await res.json() as any;
    expect(body.data.value).toBe('second');
  });

  it('returns key, value, and timestamps', async () => {
    await kv('/set', { key: 'meta-test', value: 1 });
    const res = await kv('/get', { key: 'meta-test' });
    const body = await res.json() as any;
    expect(body.data.key).toBe('meta-test');
    expect(body.data.created_at).toBeTruthy();
    expect(body.data.updated_at).toBeTruthy();
  });

  it('get returns 404 for an unknown key', async () => {
    const res = await kv('/get', { key: 'does-not-exist' });
    expect(res.status).toBe(404);
  });

  it('set returns the value and optional expires_at', async () => {
    const res = await kv('/set', { key: 'ttl-test', value: 'bye', ttl: 3600 });
    const body = await res.json() as any;
    expect(body.data.expires_at).toBeTruthy();
    expect(new Date(body.data.expires_at) > new Date()).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/v1/kv/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'x', value: 1 }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when key is missing', async () => {
    const res = await kv('/set', { value: 'no key' });
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/kv/delete ───────────────────────────────────────────────────────

describe('POST /v1/kv/delete', () => {
  it('deletes an existing key', async () => {
    await kv('/set', { key: 'to-delete', value: 'gone' });
    const del = await kv('/delete', { key: 'to-delete' });
    expect(del.status).toBe(204);
    const get = await kv('/get', { key: 'to-delete' });
    expect(get.status).toBe(404);
  });

  it('is idempotent — deleting a non-existent key returns 204', async () => {
    const res = await kv('/delete', { key: 'never-existed' });
    expect(res.status).toBe(204);
  });
});

// ─── POST /v1/kv/exists ───────────────────────────────────────────────────────

describe('POST /v1/kv/exists', () => {
  it('returns true for a key that exists', async () => {
    await kv('/set', { key: 'exist-check', value: 'yes' });
    const res = await kv('/exists', { key: 'exist-check' });
    const body = await res.json() as any;
    expect(body.data.exists).toBe(true);
  });

  it('returns false for a key that does not exist', async () => {
    const res = await kv('/exists', { key: 'no-such-key-xyz' });
    const body = await res.json() as any;
    expect(body.data.exists).toBe(false);
  });

  it('returns false after a key is deleted', async () => {
    await kv('/set', { key: 'del-exist', value: 1 });
    await kv('/delete', { key: 'del-exist' });
    const res = await kv('/exists', { key: 'del-exist' });
    const body = await res.json() as any;
    expect(body.data.exists).toBe(false);
  });
});

// ─── POST /v1/kv/list ────────────────────────────────────────────────────────

describe('POST /v1/kv/list', () => {
  beforeAll(async () => {
    // Seed several keys under a common prefix
    await Promise.all([
      kv('/set', { key: 'list:a', value: 1 }),
      kv('/set', { key: 'list:b', value: 2 }),
      kv('/set', { key: 'list:c', value: 3 }),
    ]);
  });

  it('lists keys for this org', async () => {
    const res = await kv('/list', {});
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.pagination.total).toBeGreaterThanOrEqual(3);
  });

  it('filters by prefix', async () => {
    const res = await kv('/list', { prefix: 'list:' });
    const body = await res.json() as any;
    expect(body.data.length).toBeGreaterThanOrEqual(3);
    for (const item of body.data) {
      expect(item.key.startsWith('list:')).toBe(true);
    }
  });

  it('supports pagination', async () => {
    const res = await kv('/list', { prefix: 'list:', limit: 1, page: 1 });
    const body = await res.json() as any;
    expect(body.data).toHaveLength(1);
    expect(body.meta.pagination.per_page).toBe(1);
    expect(body.meta.pagination.total_pages).toBeGreaterThanOrEqual(3);
  });

  it('returns keys in alphabetical order', async () => {
    const res = await kv('/list', { prefix: 'list:' });
    const body = await res.json() as any;
    const keys = body.data.map((r: any) => r.key);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });
});

// ─── POST /v1/kv/increment ───────────────────────────────────────────────────

describe('POST /v1/kv/increment', () => {
  it('creates key at 1 if it does not exist', async () => {
    const key = `inc:new-${Date.now()}`;
    const res = await kv('/increment', { key });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.value).toBe(1);
  });

  it('increments an existing numeric value', async () => {
    const key = `inc:existing-${Date.now()}`;
    await kv('/set', { key, value: 10 });
    const res = await kv('/increment', { key });
    const body = await res.json() as any;
    expect(body.data.value).toBe(11);
  });

  it('increments by a custom amount', async () => {
    const key = `inc:by-${Date.now()}`;
    await kv('/set', { key, value: 5 });
    const res = await kv('/increment', { key, amount: 3 });
    const body = await res.json() as any;
    expect(body.data.value).toBe(8);
  });

  it('decrements with a negative amount', async () => {
    const key = `inc:neg-${Date.now()}`;
    await kv('/set', { key, value: 10 });
    const res = await kv('/increment', { key, amount: -2 });
    const body = await res.json() as any;
    expect(body.data.value).toBe(8);
  });

  it('returns 400 when value is not a number', async () => {
    const key = `inc:bad-${Date.now()}`;
    await kv('/set', { key, value: 'not-a-number' });
    const res = await kv('/increment', { key });
    expect(res.status).toBe(400);
  });

  it('sequential increments accumulate correctly', async () => {
    const key = `inc:seq-${Date.now()}`;
    await kv('/increment', { key });
    await kv('/increment', { key });
    await kv('/increment', { key });
    const res = await kv('/get', { key });
    const body = await res.json() as any;
    expect(body.data.value).toBe(3);
  });
});
