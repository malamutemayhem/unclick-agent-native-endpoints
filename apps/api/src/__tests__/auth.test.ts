import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app.js';
import { setupTestDb } from './setup.js';

let app: ReturnType<typeof createApp>;
let devKey: string;

beforeAll(async () => {
  devKey = await setupTestDb();
  app = createApp();
});

describe('Auth middleware', () => {
  it('returns 401 with no Authorization header', async () => {
    const res = await app.request('/v1/links/pages');
    expect(res.status).toBe(401);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('authentication_error');
  });

  it('returns 401 with malformed Authorization header', async () => {
    const res = await app.request('/v1/links/pages', {
      headers: { Authorization: 'Basic abc123' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid API key', async () => {
    const res = await app.request('/v1/links/pages', {
      headers: { Authorization: 'Bearer agt_test_invalidkeyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
    });
    expect(res.status).toBe(401);
  });

  it('passes auth with valid dev key', async () => {
    const res = await app.request('/v1/links/pages', {
      headers: { Authorization: `Bearer ${devKey}` },
    });
    expect(res.status).toBe(200);
  });

  it('health endpoint requires no auth', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('ok');
  });
});

describe('Response envelope', () => {
  it('includes request_id in every response', async () => {
    const res = await app.request('/v1/links/pages', {
      headers: { Authorization: `Bearer ${devKey}` },
    });
    const body = await res.json() as { meta: { request_id: string } };
    expect(body.meta.request_id).toMatch(/^req_/);
    expect(res.headers.get('X-Request-ID')).toBe(body.meta.request_id);
  });

  it('list response includes pagination meta', async () => {
    const res = await app.request('/v1/links/pages', {
      headers: { Authorization: `Bearer ${devKey}` },
    });
    const body = await res.json() as { meta: { pagination: object } };
    expect(body.meta.pagination).toBeDefined();
    expect(body.meta.pagination).toHaveProperty('total');
    expect(body.meta.pagination).toHaveProperty('page');
    expect(body.meta.pagination).toHaveProperty('per_page');
    expect(body.meta.pagination).toHaveProperty('has_more');
  });
});
