/**
 * Tests for UnClick Secret - /v1/secret
 *
 * Set PBKDF2_ITERATIONS=1 in the test environment for speed.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app.js';
import { setupTestDb } from './setup.js';

// Reduce PBKDF2 work factor so tests run fast.
process.env.PBKDF2_ITERATIONS = '1';

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
  return app.request(`/v1/secret${path}`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
  });
}

// ─── POST /v1/secret/create ───────────────────────────────────────────────────

describe('POST /v1/secret/create', () => {
  it('creates a secret and returns id', async () => {
    const res = await post('/create', { text: 'my secret value' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.id).toMatch(/^sec_/);
    expect(body.data.has_passphrase).toBe(false);
    expect(body.data.expires_at).toBeTruthy();
  });

  it('creates a secret with a passphrase', async () => {
    const res = await post('/create', { text: 'locked secret', passphrase: 'hunter2' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.has_passphrase).toBe(true);
  });

  it('respects custom expiry_hours', async () => {
    const res = await post('/create', { text: 'short lived', expiry_hours: 2 });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const expiresAt = new Date(body.data.expires_at);
    const expected = new Date(Date.now() + 2 * 60 * 60 * 1000);
    expect(Math.abs(expiresAt.getTime() - expected.getTime())).toBeLessThan(5000);
  });

  it('returns 400 when text is missing', async () => {
    const res = await post('/create', {});
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/v1/secret/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'test' }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── POST /v1/secret/view ────────────────────────────────────────────────────

describe('POST /v1/secret/view', () => {
  it('views a secret and returns the original text', async () => {
    const cr = await post('/create', { text: 'the real secret' });
    const { data: { id } } = await cr.json() as any;

    const res = await post('/view', { id });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.text).toBe('the real secret');
    expect(body.data.viewed_at).toBeTruthy();
  });

  it('destroys the secret after viewing (one-read only)', async () => {
    const cr = await post('/create', { text: 'one time only' });
    const { data: { id } } = await cr.json() as any;

    await post('/view', { id });
    const second = await post('/view', { id });
    expect(second.status).toBe(404);
  });

  it('views a passphrase-protected secret with correct passphrase', async () => {
    const cr = await post('/create', { text: 'locked text', passphrase: 'correct' });
    const { data: { id } } = await cr.json() as any;

    const res = await post('/view', { id, passphrase: 'correct' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.text).toBe('locked text');
  });

  it('returns 403 when passphrase is required but not provided', async () => {
    const cr = await post('/create', { text: 'needs pass', passphrase: 'secret123' });
    const { data: { id } } = await cr.json() as any;

    const res = await post('/view', { id });
    expect(res.status).toBe(403);
  });

  it('returns 403 with wrong passphrase', async () => {
    const cr = await post('/create', { text: 'needs pass', passphrase: 'rightpass' });
    const { data: { id } } = await cr.json() as any;

    const res = await post('/view', { id, passphrase: 'wrongpass' });
    expect(res.status).toBe(403);
  });

  it('returns 404 for unknown id', async () => {
    const res = await post('/view', { id: 'sec_does_not_exist' });
    expect(res.status).toBe(404);
  });
});

// ─── POST /v1/secret/exists ───────────────────────────────────────────────────

describe('POST /v1/secret/exists', () => {
  it('returns true for a secret that has not been viewed', async () => {
    const cr = await post('/create', { text: 'still here' });
    const { data: { id } } = await cr.json() as any;

    const res = await post('/exists', { id });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.exists).toBe(true);
    expect(body.data.has_passphrase).toBe(false);
  });

  it('indicates when a secret has a passphrase', async () => {
    const cr = await post('/create', { text: 'with pass', passphrase: 'abc' });
    const { data: { id } } = await cr.json() as any;

    const res = await post('/exists', { id });
    const body = await res.json() as any;
    expect(body.data.has_passphrase).toBe(true);
  });

  it('returns false after the secret is viewed', async () => {
    const cr = await post('/create', { text: 'view and check' });
    const { data: { id } } = await cr.json() as any;

    await post('/view', { id });

    const res = await post('/exists', { id });
    const body = await res.json() as any;
    expect(body.data.exists).toBe(false);
  });

  it('returns false for an unknown id', async () => {
    const res = await post('/exists', { id: 'sec_nonexistent' });
    const body = await res.json() as any;
    expect(body.data.exists).toBe(false);
  });
});
