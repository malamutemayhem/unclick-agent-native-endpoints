import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app.js';
import { setupTestDb } from './setup.js';

let app: ReturnType<typeof createApp>;
let devKey: string;

beforeAll(async () => {
  devKey = await setupTestDb();
  app = createApp();
});

describe('UnClick QR', () => {
  describe('POST /v1/qr', () => {
    it('requires auth', async () => {
      const res = await app.request('/v1/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'https://example.com' }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects missing text', async () => {
      const res = await app.request('/v1/qr', {
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

    it('rejects empty text', async () => {
      const res = await app.request('/v1/qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${devKey}`,
        },
        body: JSON.stringify({ text: '' }),
      });
      expect(res.status).toBe(400);
    });

    it('generates a PNG QR code by default', async () => {
      const res = await app.request('/v1/qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${devKey}`,
        },
        body: JSON.stringify({ text: 'https://example.com' }),
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('image/png');
      const buf = await res.arrayBuffer();
      // PNG magic bytes: 89 50 4E 47
      const bytes = new Uint8Array(buf);
      expect(bytes[0]).toBe(0x89);
      expect(bytes[1]).toBe(0x50); // 'P'
      expect(bytes[2]).toBe(0x4e); // 'N'
      expect(bytes[3]).toBe(0x47); // 'G'
    });

    it('generates an SVG QR code when format=svg', async () => {
      const res = await app.request('/v1/qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${devKey}`,
        },
        body: JSON.stringify({ text: 'hello world', format: 'svg' }),
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
      const text = await res.text();
      expect(text).toContain('<svg');
    });

    it('respects size and margin params', async () => {
      const res = await app.request('/v1/qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${devKey}`,
        },
        body: JSON.stringify({ text: 'test', size: 200, margin: 1 }),
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('image/png');
    });

    it('rejects size out of range', async () => {
      const res = await app.request('/v1/qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${devKey}`,
        },
        body: JSON.stringify({ text: 'test', size: 5 }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects invalid format', async () => {
      const res = await app.request('/v1/qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${devKey}`,
        },
        body: JSON.stringify({ text: 'test', format: 'gif' }),
      });
      expect(res.status).toBe(400);
    });
  });
});
