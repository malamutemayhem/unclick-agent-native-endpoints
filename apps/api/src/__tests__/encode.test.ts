/**
 * Tests for UnClick Encode — /v1/encode/* and /v1/decode/*
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app.js';
import { setupTestDb } from './setup.js';

let app: ReturnType<typeof createApp>;
let apiKey: string;

function auth(key: string) {
  return { Authorization: `Bearer ${key}` };
}

async function post(path: string, body: object) {
  return app.request(path, {
    method: 'POST',
    headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  apiKey = await setupTestDb();
  app = createApp();
});

// ─── Base64 ───────────────────────────────────────────────────────────────────

describe('POST /v1/encode/base64', () => {
  it('encodes text to base64', async () => {
    const res = await post('/v1/encode/base64', { text: 'Hello, World!' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.encoded).toBe(Buffer.from('Hello, World!').toString('base64'));
  });

  it('encodes empty string', async () => {
    const res = await post('/v1/encode/base64', { text: '' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.encoded).toBe('');
  });

  it('handles unicode', async () => {
    const res = await post('/v1/encode/base64', { text: '日本語' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.encoded).toBe(Buffer.from('日本語', 'utf8').toString('base64'));
  });
});

describe('POST /v1/decode/base64', () => {
  it('decodes base64 to text', async () => {
    const encoded = Buffer.from('Hello, World!').toString('base64');
    const res = await post('/v1/decode/base64', { text: encoded });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.decoded).toBe('Hello, World!');
  });

  it('roundtrips unicode', async () => {
    const original = '日本語 emoji 🎉';
    const encoded = Buffer.from(original, 'utf8').toString('base64');
    const res = await post('/v1/decode/base64', { text: encoded });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.decoded).toBe(original);
  });
});

// ─── URL encoding ─────────────────────────────────────────────────────────────

describe('POST /v1/encode/url', () => {
  it('encodes URL special characters', async () => {
    const res = await post('/v1/encode/url', { text: 'hello world & foo=bar' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.encoded).toBe(encodeURIComponent('hello world & foo=bar'));
  });

  it('leaves unreserved characters unchanged', async () => {
    const res = await post('/v1/encode/url', { text: 'abc-_.~' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.encoded).toBe('abc-_.~');
  });
});

describe('POST /v1/decode/url', () => {
  it('decodes percent-encoded string', async () => {
    const res = await post('/v1/decode/url', { text: 'hello%20world%20%26%20foo%3Dbar' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.decoded).toBe('hello world & foo=bar');
  });

  it('returns 400 for malformed percent-encoding', async () => {
    const res = await post('/v1/decode/url', { text: '%zz' });
    expect(res.status).toBe(400);
  });
});

// ─── HTML encoding ────────────────────────────────────────────────────────────

describe('POST /v1/encode/html', () => {
  it('encodes HTML special characters', async () => {
    const res = await post('/v1/encode/html', { text: '<script>alert("xss")</script>' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.encoded).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('encodes ampersand and single quote', async () => {
    const res = await post('/v1/encode/html', { text: "Tom & Jerry's" });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.encoded).toBe('Tom &amp; Jerry&#39;s');
  });

  it('leaves plain text unchanged', async () => {
    const res = await post('/v1/encode/html', { text: 'Hello World' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.encoded).toBe('Hello World');
  });
});

describe('POST /v1/decode/html', () => {
  it('decodes named entities', async () => {
    const res = await post('/v1/decode/html', { text: '&lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot;' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.decoded).toBe('<b>bold</b> & "quoted"');
  });

  it('decodes decimal numeric entities', async () => {
    const res = await post('/v1/decode/html', { text: '&#65;&#66;&#67;' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.decoded).toBe('ABC');
  });

  it('decodes hex numeric entities', async () => {
    const res = await post('/v1/decode/html', { text: '&#x41;&#x42;&#x43;' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.decoded).toBe('ABC');
  });

  it('roundtrips encoded HTML', async () => {
    const original = '<script>alert("xss & \'injection\'");</script>';
    const encRes = await post('/v1/encode/html', { text: original });
    const { encoded } = ((await encRes.json()) as any).data;
    const decRes = await post('/v1/decode/html', { text: encoded });
    const { decoded } = ((await decRes.json()) as any).data;
    expect(decoded).toBe(original);
  });
});

// ─── Hex encoding ─────────────────────────────────────────────────────────────

describe('POST /v1/encode/hex', () => {
  it('converts text to hex', async () => {
    const res = await post('/v1/encode/hex', { text: 'ABC' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.encoded).toBe('414243');
  });

  it('handles empty string', async () => {
    const res = await post('/v1/encode/hex', { text: '' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.encoded).toBe('');
  });
});

describe('POST /v1/decode/hex', () => {
  it('converts hex back to text', async () => {
    const res = await post('/v1/decode/hex', { text: '414243' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.decoded).toBe('ABC');
  });

  it('roundtrips arbitrary UTF-8', async () => {
    const original = 'Hello, 世界!';
    const encRes = await post('/v1/encode/hex', { text: original });
    const { encoded } = ((await encRes.json()) as any).data;
    const decRes = await post('/v1/decode/hex', { text: encoded });
    const { decoded } = ((await decRes.json()) as any).data;
    expect(decoded).toBe(original);
  });

  it('returns 400 for odd-length hex', async () => {
    const res = await post('/v1/decode/hex', { text: 'abc' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-hex characters', async () => {
    const res = await post('/v1/decode/hex', { text: 'zzzz' });
    expect(res.status).toBe(400);
  });
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe('authentication', () => {
  it('rejects encode request without API key', async () => {
    const res = await app.request('/v1/encode/base64', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello' }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects decode request without API key', async () => {
    const res = await app.request('/v1/decode/base64', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'aGVsbG8=' }),
    });
    expect(res.status).toBe(401);
  });
});
