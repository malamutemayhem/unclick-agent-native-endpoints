import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app.js';
import { setupTestDb } from './setup.js';

let app: ReturnType<typeof createApp>;
let devKey: string;

beforeAll(async () => {
  devKey = await setupTestDb();
  app = createApp();
});

describe('UnClick Shorten', () => {
  let createdCode: string;

  describe('POST /v1/shorten', () => {
    it('requires auth', async () => {
      const res = await app.request('/v1/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com' }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects missing url', async () => {
      const res = await app.request('/v1/shorten', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${devKey}`,
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('validation_error');
    });

    it('rejects invalid url', async () => {
      const res = await app.request('/v1/shorten', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${devKey}`,
        },
        body: JSON.stringify({ url: 'not-a-url' }),
      });
      expect(res.status).toBe(400);
    });

    it('creates a short URL and returns code + short_url', async () => {
      const res = await app.request('/v1/shorten', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${devKey}`,
        },
        body: JSON.stringify({ url: 'https://example.com/some/long/path' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as { data: { code: string; short_url: string; original_url: string } };
      expect(body.data.code).toHaveLength(6);
      expect(body.data.short_url).toContain('/r/');
      expect(body.data.original_url).toBe('https://example.com/some/long/path');
      createdCode = body.data.code;
    });
  });

  describe('GET /r/:code (public redirect)', () => {
    it('redirects to the original URL', async () => {
      const res = await app.request(`/r/${createdCode}`);
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('https://example.com/some/long/path');
    });

    it('returns 404 for unknown code', async () => {
      const res = await app.request('/r/XXXXXX');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /v1/shorten/:code/stats', () => {
    it('requires auth', async () => {
      const res = await app.request(`/v1/shorten/${createdCode}/stats`);
      expect(res.status).toBe(401);
    });

    it('returns click count and metadata', async () => {
      const res = await app.request(`/v1/shorten/${createdCode}/stats`, {
        headers: { Authorization: `Bearer ${devKey}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { data: { code: string; click_count: number; original_url: string } };
      expect(body.data.code).toBe(createdCode);
      expect(typeof body.data.click_count).toBe('number');
      expect(body.data.original_url).toBe('https://example.com/some/long/path');
    });

    it('returns 404 for a code belonging to a different org', async () => {
      const res = await app.request('/v1/shorten/XXXXXX/stats', {
        headers: { Authorization: `Bearer ${devKey}` },
      });
      expect(res.status).toBe(404);
    });
  });
});
