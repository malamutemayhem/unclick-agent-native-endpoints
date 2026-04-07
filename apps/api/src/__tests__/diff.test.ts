/**
 * Tests for UnClick Diff - /v1/diff
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createTwoFilesPatch } from 'diff';
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

async function post(path: string, body: unknown) {
  return app.request(`/v1/diff${path}`, {
    method: 'POST',
    headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── POST /v1/diff/text ───────────────────────────────────────────────────────

describe('POST /v1/diff/text', () => {
  it('returns a unified diff patch', async () => {
    const a = 'hello\nworld\n';
    const b = 'hello\nearth\n';
    const res = await post('/text', { a, b });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.patch).toContain('---');
    expect(body.data.patch).toContain('+++');
    expect(body.data.changed).toBe(true);
  });

  it('marks identical strings as unchanged', async () => {
    const res = await post('/text', { a: 'same', b: 'same' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.changed).toBe(false);
  });

  it('uses provided filenames in the header', async () => {
    const res = await post('/text', {
      a: 'foo',
      b: 'bar',
      filename_a: 'original.txt',
      filename_b: 'modified.txt',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.patch).toContain('original.txt');
    expect(body.data.patch).toContain('modified.txt');
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/v1/diff/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: 'a', b: 'b' }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── POST /v1/diff/lines ──────────────────────────────────────────────────────

describe('POST /v1/diff/lines', () => {
  it('returns line-by-line diff with types', async () => {
    const res = await post('/lines', {
      a: 'line1\nline2\nline3\n',
      b: 'line1\nchanged\nline3\n',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.changed).toBe(true);
    const types = body.data.lines.map((l: any) => l.type);
    expect(types).toContain('added');
    expect(types).toContain('removed');
    expect(types).toContain('unchanged');
  });

  it('includes line numbers for original and modified', async () => {
    const res = await post('/lines', {
      a: 'a\nb\n',
      b: 'a\nc\n',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const unchanged = body.data.lines.find((l: any) => l.type === 'unchanged');
    expect(unchanged.line_a).toBeTypeOf('number');
    expect(unchanged.line_b).toBeTypeOf('number');
  });

  it('reports added and removed counts', async () => {
    const res = await post('/lines', { a: 'old\n', b: 'new\n' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.added).toBeGreaterThan(0);
    expect(body.data.removed).toBeGreaterThan(0);
  });

  it('marks identical texts as unchanged', async () => {
    const res = await post('/lines', { a: 'same\n', b: 'same\n' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.changed).toBe(false);
    expect(body.data.added).toBe(0);
    expect(body.data.removed).toBe(0);
  });
});

// ─── POST /v1/diff/words ──────────────────────────────────────────────────────

describe('POST /v1/diff/words', () => {
  it('returns word-level tokens', async () => {
    const res = await post('/words', {
      a: 'The quick brown fox',
      b: 'The slow brown fox',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.changed).toBe(true);
    const tokenTypes = body.data.tokens.map((t: any) => t.type);
    expect(tokenTypes).toContain('added');
    expect(tokenTypes).toContain('removed');
  });

  it('counts added and removed tokens', async () => {
    const res = await post('/words', { a: 'hello world', b: 'hello earth' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.added).toBeGreaterThan(0);
    expect(body.data.removed).toBeGreaterThan(0);
  });

  it('marks identical strings as unchanged', async () => {
    const res = await post('/words', { a: 'same text', b: 'same text' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.changed).toBe(false);
  });
});

// ─── POST /v1/diff/patch ──────────────────────────────────────────────────────

describe('POST /v1/diff/patch', () => {
  it('applies a patch successfully', async () => {
    const original = 'hello\nworld\n';
    const modified = 'hello\nearth\n';
    const patch = createTwoFilesPatch('a', 'b', original, modified);

    const res = await post('/patch', { original, patch });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.result).toBe(modified);
    expect(body.data.changed).toBe(true);
  });

  it('reports unchanged when patch produces identical text', async () => {
    const original = 'hello\n';
    // A patch that changes nothing effectively (no-op)
    const patch = createTwoFilesPatch('a', 'b', original, original);
    const res = await post('/patch', { original, patch });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.changed).toBe(false);
  });

  it('returns 400 when patch does not match original', async () => {
    const res = await post('/patch', {
      original: 'completely different text',
      patch: createTwoFilesPatch('a', 'b', 'something else entirely\n', 'modified\n'),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when patch field is missing', async () => {
    const res = await post('/patch', { original: 'text' });
    expect(res.status).toBe(400);
  });
});
