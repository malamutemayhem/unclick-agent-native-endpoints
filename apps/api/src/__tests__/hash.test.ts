/**
 * Tests for UnClick Hash - /v1/hash
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
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

// ─── POST /v1/hash ────────────────────────────────────────────────────────────

describe('POST /v1/hash', () => {
  it('hashes text with sha256 by default', async () => {
    const res = await app.request('/v1/hash', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello world' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const expected = createHash('sha256').update('hello world', 'utf8').digest('hex');
    expect(body.data.hash).toBe(expected);
    expect(body.data.algorithm).toBe('sha256');
    expect(body.data.length).toBe(64);
  });

  it('hashes with md5', async () => {
    const res = await app.request('/v1/hash', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'test', algorithm: 'md5' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const expected = createHash('md5').update('test', 'utf8').digest('hex');
    expect(body.data.hash).toBe(expected);
    expect(body.data.algorithm).toBe('md5');
  });

  it('hashes with sha1', async () => {
    const res = await app.request('/v1/hash', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'test', algorithm: 'sha1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const expected = createHash('sha1').update('test', 'utf8').digest('hex');
    expect(body.data.hash).toBe(expected);
  });

  it('hashes with sha512', async () => {
    const res = await app.request('/v1/hash', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'test', algorithm: 'sha512' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.algorithm).toBe('sha512');
    expect(body.data.length).toBe(128);
  });

  it('rejects unsupported algorithm', async () => {
    const res = await app.request('/v1/hash', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'test', algorithm: 'sha3' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects empty text', async () => {
    const res = await app.request('/v1/hash', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects unauthenticated request', async () => {
    const res = await app.request('/v1/hash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello' }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── POST /v1/hash/verify ─────────────────────────────────────────────────────

describe('POST /v1/hash/verify', () => {
  it('returns true when hash matches', async () => {
    const text = 'verify me';
    const hash = createHash('sha256').update(text, 'utf8').digest('hex');
    const res = await app.request('/v1/hash/verify', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, hash, algorithm: 'sha256' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.match).toBe(true);
  });

  it('returns false when hash does not match', async () => {
    const res = await app.request('/v1/hash/verify', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello', hash: 'deadbeef', algorithm: 'sha256' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.match).toBe(false);
  });

  it('is case-insensitive for the supplied hash', async () => {
    const text = 'case test';
    const hash = createHash('sha256').update(text, 'utf8').digest('hex').toUpperCase();
    const res = await app.request('/v1/hash/verify', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, hash, algorithm: 'sha256' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.match).toBe(true);
  });
});

// ─── POST /v1/hash/hmac ───────────────────────────────────────────────────────

describe('POST /v1/hash/hmac', () => {
  it('computes HMAC-SHA256', async () => {
    const text = 'message';
    const key = 'secret';
    const res = await app.request('/v1/hash/hmac', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, key, algorithm: 'sha256' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const expected = createHmac('sha256', key).update(text, 'utf8').digest('hex');
    expect(body.data.hmac).toBe(expected);
    expect(body.data.algorithm).toBe('sha256');
  });

  it('computes HMAC-SHA512', async () => {
    const res = await app.request('/v1/hash/hmac', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'msg', key: 'k', algorithm: 'sha512' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBe(128);
  });

  it('rejects missing key', async () => {
    const res = await app.request('/v1/hash/hmac', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'msg' }),
    });
    expect(res.status).toBe(400);
  });
});
