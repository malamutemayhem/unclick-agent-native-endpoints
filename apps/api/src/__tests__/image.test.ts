/**
 * Tests for UnClick Image — /v1/image
 */
import { describe, it, expect, beforeAll } from 'vitest';
import sharp from 'sharp';
import { createApp } from '../app.js';
import { setupTestDb } from './setup.js';

let app: ReturnType<typeof createApp>;
let devKey: string;

// A small 100×100 red JPEG used across tests
let testJpegBase64: string;
// A small 100×100 green PNG
let testPngBase64: string;

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

  testJpegBase64 = (
    await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .jpeg({ quality: 80 })
      .toBuffer()
  ).toString('base64');

  testPngBase64 = (
    await sharp({
      create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } },
    })
      .png()
      .toBuffer()
  ).toString('base64');
});

// ─── Auth guard ──────────────────────────────────────────────────────────────

describe('Auth guard', () => {
  it('rejects unauthenticated requests to /v1/image/metadata', async () => {
    const res = await app.request('/v1/image/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: testJpegBase64 }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── POST /v1/image/metadata ─────────────────────────────────────────────────

describe('POST /v1/image/metadata', () => {
  it('returns metadata for a JPEG', async () => {
    const res = await post('/v1/image/metadata', { image: testJpegBase64 });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    expect(body.data.width).toBe(100);
    expect(body.data.height).toBe(100);
    expect(body.data.format).toBe('jpeg');
    expect(body.data.size).toBeGreaterThan(0);
  });

  it('returns metadata for a PNG', async () => {
    const res = await post('/v1/image/metadata', { image: testPngBase64 });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    expect(body.data.format).toBe('png');
    expect(body.data.width).toBe(100);
    expect(body.data.height).toBe(100);
  });

  it('rejects invalid base64', async () => {
    const res = await post('/v1/image/metadata', { image: 'not-valid-image-data!!!!' });
    expect(res.status).toBe(400);
  });

  it('rejects empty image string', async () => {
    const res = await post('/v1/image/metadata', { image: '' });
    expect(res.status).toBe(400);
  });

  it('accepts a data URI prefix', async () => {
    const dataUri = `data:image/jpeg;base64,${testJpegBase64}`;
    const res = await post('/v1/image/metadata', { image: dataUri });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    expect(body.data.format).toBe('jpeg');
  });
});

// ─── POST /v1/image/resize ───────────────────────────────────────────────────

describe('POST /v1/image/resize', () => {
  it('resizes a JPEG to the specified dimensions', async () => {
    const res = await post('/v1/image/resize', { image: testJpegBase64, width: 50, height: 50 });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    expect(body.data.width).toBe(50);
    expect(body.data.height).toBe(50);
    expect(typeof body.data.image).toBe('string');
    // Verify the output is a valid image at 50×50
    const meta = await sharp(Buffer.from(body.data.image, 'base64')).metadata();
    expect(meta.width).toBe(50);
    expect(meta.height).toBe(50);
  });

  it('supports the contain fit mode', async () => {
    const res = await post('/v1/image/resize', {
      image: testJpegBase64,
      width: 40,
      height: 80,
      fit: 'contain',
    });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    expect(typeof body.data.image).toBe('string');
  });

  it('rejects width of 0', async () => {
    const res = await post('/v1/image/resize', { image: testJpegBase64, width: 0, height: 50 });
    expect(res.status).toBe(400);
  });

  it('rejects missing height', async () => {
    const res = await post('/v1/image/resize', { image: testJpegBase64, width: 50 });
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/image/convert ──────────────────────────────────────────────────

describe('POST /v1/image/convert', () => {
  it('converts JPEG to PNG', async () => {
    const res = await post('/v1/image/convert', { image: testJpegBase64, format: 'png' });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    expect(body.data.format).toBe('png');
    const meta = await sharp(Buffer.from(body.data.image, 'base64')).metadata();
    expect(meta.format).toBe('png');
  });

  it('converts JPEG to WebP', async () => {
    const res = await post('/v1/image/convert', { image: testJpegBase64, format: 'webp', quality: 90 });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    expect(body.data.format).toBe('webp');
  });

  it('converts PNG to AVIF', async () => {
    const res = await post('/v1/image/convert', { image: testPngBase64, format: 'avif', quality: 50 });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    expect(body.data.format).toBe('avif');
  });

  it('rejects unsupported format', async () => {
    const res = await post('/v1/image/convert', { image: testJpegBase64, format: 'bmp' });
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/image/compress ─────────────────────────────────────────────────

describe('POST /v1/image/compress', () => {
  it('compresses a JPEG with default quality', async () => {
    const res = await post('/v1/image/compress', { image: testJpegBase64 });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    expect(body.data.format).toBe('jpeg');
    expect(body.data.original_size).toBeGreaterThan(0);
    expect(body.data.compressed_size).toBeGreaterThan(0);
    expect(typeof body.data.image).toBe('string');
  });

  it('compresses a PNG with quality 30', async () => {
    const res = await post('/v1/image/compress', { image: testPngBase64, quality: 30 });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    expect(typeof body.data.image).toBe('string');
  });

  it('rejects quality out of range', async () => {
    const res = await post('/v1/image/compress', { image: testJpegBase64, quality: 0 });
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/image/crop ─────────────────────────────────────────────────────

describe('POST /v1/image/crop', () => {
  it('crops to a 40×40 region from origin', async () => {
    const res = await post('/v1/image/crop', { image: testJpegBase64, x: 0, y: 0, width: 40, height: 40 });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    expect(body.data.width).toBe(40);
    expect(body.data.height).toBe(40);
    const meta = await sharp(Buffer.from(body.data.image, 'base64')).metadata();
    expect(meta.width).toBe(40);
    expect(meta.height).toBe(40);
  });

  it('crops with non-zero offset', async () => {
    const res = await post('/v1/image/crop', { image: testJpegBase64, x: 10, y: 10, width: 30, height: 30 });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    expect(body.data.x).toBe(10);
    expect(body.data.y).toBe(10);
  });

  it('returns 400 when crop region exceeds image bounds', async () => {
    const res = await post('/v1/image/crop', { image: testJpegBase64, x: 0, y: 0, width: 500, height: 500 });
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/image/rotate ───────────────────────────────────────────────────

describe('POST /v1/image/rotate', () => {
  it('rotates 90 degrees', async () => {
    const res = await post('/v1/image/rotate', { image: testJpegBase64, degrees: 90 });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    expect(body.data.degrees).toBe(90);
    expect(typeof body.data.image).toBe('string');
  });

  it('rotates 180 degrees', async () => {
    const res = await post('/v1/image/rotate', { image: testJpegBase64, degrees: 180 });
    expect(res.status).toBe(200);
  });

  it('rotates negative degrees', async () => {
    const res = await post('/v1/image/rotate', { image: testJpegBase64, degrees: -45 });
    expect(res.status).toBe(200);
  });

  it('rejects degrees outside ±360', async () => {
    const res = await post('/v1/image/rotate', { image: testJpegBase64, degrees: 400 });
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/image/grayscale ────────────────────────────────────────────────

describe('POST /v1/image/grayscale', () => {
  it('converts a JPEG to grayscale', async () => {
    const res = await post('/v1/image/grayscale', { image: testJpegBase64 });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    expect(typeof body.data.image).toBe('string');
    // JPEG always encodes as 3-channel; verify it round-trips as a valid image
    const meta = await sharp(Buffer.from(body.data.image, 'base64')).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(100);
  });

  it('converts a PNG to grayscale', async () => {
    const res = await post('/v1/image/grayscale', { image: testPngBase64 });
    expect(res.status).toBe(200);
    const body = await json<any>(res);
    expect(typeof body.data.image).toBe('string');
  });

  it('rejects missing image field', async () => {
    const res = await post('/v1/image/grayscale', {});
    expect(res.status).toBe(400);
  });
});
