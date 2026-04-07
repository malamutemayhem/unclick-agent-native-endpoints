/**
 * Tests for UnClick Webhook Bin - /v1/webhook
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

// ─── POST /v1/webhook/create ──────────────────────────────────────────────────

describe('POST /v1/webhook/create', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('/v1/webhook/create', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('creates a bin and returns id, url, expires_at', async () => {
    const res = await app.request('/v1/webhook/create', {
      method: 'POST',
      headers: authHeaders(apiKey),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.data.id).toMatch(/^wbh_/);
    expect(body.data.url).toContain('/v1/webhook/');
    expect(body.data.url).toContain('/receive');
    expect(body.data.expires_at).toBeTruthy();
  });

  it('expiry is approximately 24 hours from now', async () => {
    const before = Date.now();
    const res = await app.request('/v1/webhook/create', {
      method: 'POST',
      headers: authHeaders(apiKey),
    });
    const body = await res.json() as any;
    const expiresAt = new Date(body.data.expires_at).getTime();
    const diff = expiresAt - before;
    // Should be within a few seconds of 24 hours
    expect(diff).toBeGreaterThan(24 * 60 * 60 * 1000 - 5000);
    expect(diff).toBeLessThan(24 * 60 * 60 * 1000 + 5000);
  });
});

// ─── ALL /v1/webhook/:id/receive ──────────────────────────────────────────────

describe('ALL /v1/webhook/:id/receive', () => {
  let binId: string;

  beforeAll(async () => {
    const res = await app.request('/v1/webhook/create', {
      method: 'POST',
      headers: authHeaders(apiKey),
    });
    const body = await res.json() as any;
    binId = body.data.id;
  });

  it('receives a POST request without auth', async () => {
    const res = await app.request(`/v1/webhook/${binId}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'payload' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
    expect(body.id).toMatch(/^wbr_/);
  });

  it('receives a GET request with query params', async () => {
    const res = await app.request(`/v1/webhook/${binId}/receive?foo=bar&x=1`);
    expect(res.status).toBe(200);
  });

  it('receives a PUT request', async () => {
    const res = await app.request(`/v1/webhook/${binId}/receive`, {
      method: 'PUT',
      body: 'raw text body',
    });
    expect(res.status).toBe(200);
  });

  it('returns 404 for an unknown bin id', async () => {
    const res = await app.request('/v1/webhook/wbh_unknown_000/receive', {
      method: 'POST',
    });
    expect(res.status).toBe(404);
  });
});

// ─── POST /v1/webhook/:id/requests ───────────────────────────────────────────

describe('POST /v1/webhook/:id/requests', () => {
  let binId: string;

  beforeAll(async () => {
    // Create a bin and send a few requests into it
    const create = await app.request('/v1/webhook/create', {
      method: 'POST',
      headers: authHeaders(apiKey),
    });
    const body = await create.json() as any;
    binId = body.data.id;

    await app.request(`/v1/webhook/${binId}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Custom': 'header-value' },
      body: JSON.stringify({ hello: 'world' }),
    });
    await app.request(`/v1/webhook/${binId}/receive?q=test`, {
      method: 'GET',
    });
  });

  it('returns 401 without auth', async () => {
    const res = await app.request(`/v1/webhook/${binId}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it('lists stored requests most-recent first', async () => {
    const res = await app.request(`/v1/webhook/${binId}/requests`, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('stored request includes method, headers, body, query_params', async () => {
    const res = await app.request(`/v1/webhook/${binId}/requests`, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({}),
    });
    const body = await res.json() as any;
    // Find the POST request we sent
    const postReq = body.data.find((r: any) => r.method === 'POST');
    expect(postReq).toBeTruthy();
    expect(postReq.body).toContain('hello');
    expect(postReq.headers).toBeTruthy();
    expect(postReq.received_at).toBeTruthy();
  });

  it('stores query params', async () => {
    const res = await app.request(`/v1/webhook/${binId}/requests`, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({}),
    });
    const body = await res.json() as any;
    const getReq = body.data.find((r: any) => r.method === 'GET');
    expect(getReq).toBeTruthy();
    expect(getReq.query_params.q).toBe('test');
  });

  it('returns 404 for an unknown bin', async () => {
    const res = await app.request('/v1/webhook/wbh_unknown_000/requests', {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(404);
  });

  it('supports pagination', async () => {
    const res = await app.request(`/v1/webhook/${binId}/requests`, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({ limit: 1, page: 1 }),
    });
    const body = await res.json() as any;
    expect(body.data).toHaveLength(1);
    expect(body.meta.pagination.per_page).toBe(1);
    expect(body.meta.pagination.total).toBeGreaterThanOrEqual(2);
  });
});

// ─── DELETE /v1/webhook/:id ───────────────────────────────────────────────────

describe('DELETE /v1/webhook/:id', () => {
  let binId: string;

  beforeAll(async () => {
    const res = await app.request('/v1/webhook/create', {
      method: 'POST',
      headers: authHeaders(apiKey),
    });
    const body = await res.json() as any;
    binId = body.data.id;

    // Send a request to the bin so there's something to cascade-delete
    await app.request(`/v1/webhook/${binId}/receive`, {
      method: 'POST',
      body: 'to be deleted',
    });
  });

  it('returns 401 without auth', async () => {
    const res = await app.request(`/v1/webhook/${binId}`, { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('deletes the bin and returns 204', async () => {
    const res = await app.request(`/v1/webhook/${binId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(res.status).toBe(204);
  });

  it('receive returns 404 after deletion', async () => {
    const res = await app.request(`/v1/webhook/${binId}/receive`, { method: 'POST' });
    expect(res.status).toBe(404);
  });

  it('returns 404 when deleting a non-existent bin', async () => {
    const res = await app.request('/v1/webhook/wbh_gone_000', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(res.status).toBe(404);
  });
});
