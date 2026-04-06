/**
 * Tests for UnClick Regex — /v1/regex
 */
import { describe, it, expect, beforeAll } from 'vitest';
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

// ─── POST /v1/regex/test ─────────────────────────────────────────────────────

describe('POST /v1/regex/test', () => {
  it('finds a single match', async () => {
    const res = await app.request('/v1/regex/test', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: 'hello', flags: '', input: 'say hello world' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.match_count).toBe(1);
    expect(body.data.matches[0].match).toBe('hello');
    expect(body.data.matches[0].start).toBe(4);
    expect(body.data.matches[0].end).toBe(9);
  });

  it('finds multiple matches when global', async () => {
    const res = await app.request('/v1/regex/test', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: '\\d+', flags: 'g', input: 'a1 b22 c333' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.match_count).toBe(3);
    expect(body.data.matches.map((m: any) => m.match)).toEqual(['1', '22', '333']);
  });

  it('adds g flag automatically even when not supplied', async () => {
    const res = await app.request('/v1/regex/test', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: 'a', flags: '', input: 'aaa' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.match_count).toBe(3);
  });

  it('returns numbered capture groups', async () => {
    const res = await app.request('/v1/regex/test', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: '(\\w+)@(\\w+)', flags: '', input: 'user@example' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.matches[0].groups['$1']).toBe('user');
    expect(body.data.matches[0].groups['$2']).toBe('example');
  });

  it('returns named capture groups', async () => {
    const res = await app.request('/v1/regex/test', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pattern: '(?<year>\\d{4})-(?<month>\\d{2})',
        flags: '',
        input: '2024-01 and 2025-06',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.matches[0].named_groups).toMatchObject({ year: '2024', month: '01' });
    expect(body.data.matches[1].named_groups).toMatchObject({ year: '2025', month: '06' });
  });

  it('returns empty matches array when no match', async () => {
    const res = await app.request('/v1/regex/test', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: 'xyz', flags: '', input: 'hello world' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.match_count).toBe(0);
    expect(body.data.matches).toHaveLength(0);
  });

  it('is case-insensitive with i flag', async () => {
    const res = await app.request('/v1/regex/test', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: 'HELLO', flags: 'i', input: 'say hello' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.match_count).toBe(1);
  });

  it('reports correct start/end indices', async () => {
    const res = await app.request('/v1/regex/test', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: 'world', flags: '', input: 'hello world' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.matches[0].start).toBe(6);
    expect(body.data.matches[0].end).toBe(11);
  });

  it('rejects invalid pattern', async () => {
    const res = await app.request('/v1/regex/test', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: '[invalid', flags: '', input: 'test' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects invalid flags', async () => {
    const res = await app.request('/v1/regex/test', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: 'a', flags: 'z', input: 'abc' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects unauthenticated request', async () => {
    const res = await app.request('/v1/regex/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: 'a', flags: '', input: 'abc' }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── POST /v1/regex/replace ───────────────────────────────────────────────────

describe('POST /v1/regex/replace', () => {
  it('replaces all occurrences by default', async () => {
    const res = await app.request('/v1/regex/replace', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: 'foo', flags: '', input: 'foo and foo', replacement: 'bar' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.result).toBe('bar and bar');
    expect(body.data.changed).toBe(true);
  });

  it('replaces only first occurrence when global is false', async () => {
    const res = await app.request('/v1/regex/replace', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pattern: 'foo',
        flags: '',
        input: 'foo and foo',
        replacement: 'bar',
        global: false,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.result).toBe('bar and foo');
  });

  it('supports $1 $2 backreferences', async () => {
    const res = await app.request('/v1/regex/replace', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pattern: '(\\w+)@(\\w+)',
        flags: '',
        input: 'user@example',
        replacement: '$2/$1',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.result).toBe('example/user');
  });

  it('reports changed: false when nothing was replaced', async () => {
    const res = await app.request('/v1/regex/replace', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: 'xyz', flags: '', input: 'hello', replacement: 'y' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.changed).toBe(false);
    expect(body.data.result).toBe('hello');
  });

  it('supports case-insensitive replace', async () => {
    const res = await app.request('/v1/regex/replace', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: 'HELLO', flags: 'i', input: 'hello world', replacement: 'Hi' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.result).toBe('Hi world');
  });
});

// ─── POST /v1/regex/extract ───────────────────────────────────────────────────

describe('POST /v1/regex/extract', () => {
  it('extracts all matches as flat strings', async () => {
    const res = await app.request('/v1/regex/extract', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: '\\d+', flags: '', input: 'order 12, item 34, qty 5' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.matches).toEqual(['12', '34', '5']);
    expect(body.data.count).toBe(3);
  });

  it('returns empty array when no matches', async () => {
    const res = await app.request('/v1/regex/extract', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: 'xyz', flags: '', input: 'hello world' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.matches).toEqual([]);
    expect(body.data.count).toBe(0);
  });

  it('extracts email addresses', async () => {
    const res = await app.request('/v1/regex/extract', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pattern: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}',
        flags: 'g',
        input: 'contact us at support@example.com or help@test.org',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.matches).toContain('support@example.com');
    expect(body.data.matches).toContain('help@test.org');
  });
});

// ─── POST /v1/regex/split ─────────────────────────────────────────────────────

describe('POST /v1/regex/split', () => {
  it('splits on whitespace', async () => {
    const res = await app.request('/v1/regex/split', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: '\\s+', flags: '', input: 'foo  bar   baz' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.parts).toEqual(['foo', 'bar', 'baz']);
  });

  it('respects limit', async () => {
    const res = await app.request('/v1/regex/split', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: ',', flags: '', input: 'a,b,c,d,e', limit: 3 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.parts).toHaveLength(3);
    expect(body.data.parts[0]).toBe('a');
  });

  it('splits on comma-space', async () => {
    const res = await app.request('/v1/regex/split', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: ',\\s*', flags: '', input: 'one, two, three' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.parts).toEqual(['one', 'two', 'three']);
  });

  it('returns entire string as single element when pattern does not match', async () => {
    const res = await app.request('/v1/regex/split', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: 'xyz', flags: '', input: 'hello world' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.parts).toEqual(['hello world']);
    expect(body.data.count).toBe(1);
  });
});

// ─── POST /v1/regex/validate ──────────────────────────────────────────────────

describe('POST /v1/regex/validate', () => {
  it('reports valid for a correct pattern', async () => {
    const res = await app.request('/v1/regex/validate', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: '^\\d{3}-\\d{4}$', flags: '' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.valid).toBe(true);
    expect(body.data.error).toBeNull();
  });

  it('reports invalid and includes error message for a bad pattern', async () => {
    const res = await app.request('/v1/regex/validate', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: '[unclosed', flags: '' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.valid).toBe(false);
    expect(typeof body.data.error).toBe('string');
    expect(body.data.error!.length).toBeGreaterThan(0);
  });

  it('validates pattern with flags', async () => {
    const res = await app.request('/v1/regex/validate', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: 'hello', flags: 'im' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.valid).toBe(true);
  });

  it('rejects empty pattern', async () => {
    const res = await app.request('/v1/regex/validate', {
      method: 'POST',
      headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: '', flags: '' }),
    });
    expect(res.status).toBe(400);
  });
});
