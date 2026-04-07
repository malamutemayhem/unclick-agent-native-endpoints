/**
 * Tests for UnClick Paste — /v1/paste
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
  return app.request(`/v1/paste${path}`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
  });
}

async function get(path: string) {
  return app.request(`/v1/paste${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

async function del(path: string) {
  return app.request(`/v1/paste${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

// ─── POST /v1/paste/create ────────────────────────────────────────────────────

describe('POST /v1/paste/create', () => {
  it('creates a paste and returns id and url', async () => {
    const res = await post('/create', { content: 'hello world' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.id).toMatch(/^paste_/);
    expect(body.data.url).toBeTruthy();
    expect(body.data.size).toBe(11);
  });

  it('creates a paste with title and language', async () => {
    const res = await post('/create', {
      content: 'const x = 1;',
      title: 'My snippet',
      language: 'typescript',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.title).toBe('My snippet');
    expect(body.data.language).toBe('typescript');
  });

  it('respects custom expiry_hours', async () => {
    const res = await post('/create', { content: 'expires soon', expiry_hours: 1 });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const expiresAt = new Date(body.data.expires_at);
    const expected = new Date(Date.now() + 60 * 60 * 1000);
    expect(Math.abs(expiresAt.getTime() - expected.getTime())).toBeLessThan(5000);
  });

  it('returns 400 when content is missing', async () => {
    const res = await post('/create', { title: 'no content' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/v1/paste/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'test' }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── GET /v1/paste/:id ────────────────────────────────────────────────────────

describe('GET /v1/paste/:id', () => {
  let pasteId: string;

  beforeAll(async () => {
    const res = await post('/create', { content: 'retrieve me', language: 'text' });
    const body = await res.json() as any;
    pasteId = body.data.id;
  });

  it('retrieves a paste by id', async () => {
    const res = await get(`/${pasteId}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.content).toBe('retrieve me');
    expect(body.data.id).toBe(pasteId);
  });

  it('returns 404 for unknown id', async () => {
    const res = await get('/paste_does_not_exist_xyz');
    expect(res.status).toBe(404);
  });
});

// ─── POST /v1/paste/list ──────────────────────────────────────────────────────

describe('POST /v1/paste/list', () => {
  beforeAll(async () => {
    await Promise.all([
      post('/create', { content: 'list item 1' }),
      post('/create', { content: 'list item 2' }),
      post('/create', { content: 'list item 3' }),
    ]);
  });

  it('lists pastes for this org', async () => {
    const res = await post('/list', {});
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(3);
  });

  it('supports pagination', async () => {
    const res = await post('/list', { page: 1, limit: 2 });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toHaveLength(2);
    expect(body.meta.pagination.per_page).toBe(2);
  });

  it('returns most recent first', async () => {
    const res = await post('/list', {});
    const body = await res.json() as any;
    const dates = body.data.map((p: any) => new Date(p.created_at).getTime());
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
    }
  });
});

// ─── DELETE /v1/paste/:id ─────────────────────────────────────────────────────

describe('DELETE /v1/paste/:id', () => {
  it('deletes a paste and makes it unretrievable', async () => {
    const cr = await post('/create', { content: 'delete me' });
    const { data } = await cr.json() as any;
    const id = data.id;

    const del_ = await del(`/${id}`);
    expect(del_.status).toBe(204);

    const getRes = await get(`/${id}`);
    expect(getRes.status).toBe(404);
  });

  it('returns 404 when deleting a non-existent paste', async () => {
    const res = await del('/paste_nonexistent_xyz');
    expect(res.status).toBe(404);
  });
});

// ─── POST /v1/paste/:id/raw ───────────────────────────────────────────────────

describe('POST /v1/paste/:id/raw', () => {
  let pasteId: string;

  beforeAll(async () => {
    const res = await post('/create', { content: 'raw text content here' });
    const body = await res.json() as any;
    pasteId = body.data.id;
  });

  it('returns raw text only', async () => {
    const res = await post(`/${pasteId}/raw`, {});
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('raw text content here');
  });

  it('returns 404 for unknown id', async () => {
    const res = await post('/paste_unknown_xyz/raw', {});
    expect(res.status).toBe(404);
  });
});
