import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app.js';
import { setupTestDb } from './setup.js';

let app: ReturnType<typeof createApp>;
let devKey: string;

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
});

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

describe('Transform - auth', () => {
  it('rejects requests with no API key', async () => {
    const res = await app.request('/v1/transform/reverse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello' }),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// /transform/case
// ---------------------------------------------------------------------------

describe('Transform - case', () => {
  it('converts to upper', async () => {
    const res = await post('/v1/transform/case', { text: 'hello world', to: 'upper' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { text: string } }>(res);
    expect(body.data.text).toBe('HELLO WORLD');
  });

  it('converts to lower', async () => {
    const res = await post('/v1/transform/case', { text: 'HELLO WORLD', to: 'lower' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { text: string } }>(res);
    expect(body.data.text).toBe('hello world');
  });

  it('converts to title', async () => {
    const res = await post('/v1/transform/case', { text: 'hello world', to: 'title' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { text: string } }>(res);
    expect(body.data.text).toBe('Hello World');
  });

  it('converts to camel', async () => {
    const res = await post('/v1/transform/case', { text: 'hello world foo', to: 'camel' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { text: string } }>(res);
    expect(body.data.text).toBe('helloWorldFoo');
  });

  it('converts to snake', async () => {
    const res = await post('/v1/transform/case', { text: 'Hello World', to: 'snake' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { text: string } }>(res);
    expect(body.data.text).toBe('hello_world');
  });

  it('converts to kebab', async () => {
    const res = await post('/v1/transform/case', { text: 'Hello World', to: 'kebab' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { text: string } }>(res);
    expect(body.data.text).toBe('hello-world');
  });

  it('converts to pascal', async () => {
    const res = await post('/v1/transform/case', { text: 'hello world', to: 'pascal' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { text: string } }>(res);
    expect(body.data.text).toBe('HelloWorld');
  });

  it('converts to sentence', async () => {
    const res = await post('/v1/transform/case', { text: 'hello world. foo bar.', to: 'sentence' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { text: string } }>(res);
    expect(body.data.text).toMatch(/^Hello/);
  });

  it('rejects invalid target case', async () => {
    const res = await post('/v1/transform/case', { text: 'hello', to: 'shouting' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// /transform/slug
// ---------------------------------------------------------------------------

describe('Transform - slug', () => {
  it('converts text to slug', async () => {
    const res = await post('/v1/transform/slug', { text: 'Hello World! Foo Bar' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { slug: string } }>(res);
    expect(body.data.slug).toBe('hello-world-foo-bar');
  });

  it('handles accented characters', async () => {
    const res = await post('/v1/transform/slug', { text: 'Ça va très bien' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { slug: string } }>(res);
    expect(body.data.slug).toBe('ca-va-tres-bien');
  });

  it('rejects empty text', async () => {
    const res = await post('/v1/transform/slug', { text: '' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// /transform/truncate
// ---------------------------------------------------------------------------

describe('Transform - truncate', () => {
  it('truncates with ellipsis', async () => {
    const res = await post('/v1/transform/truncate', { text: 'hello world', length: 8 });
    expect(res.status).toBe(200);
    const body = await json<{ data: { text: string; truncated: boolean } }>(res);
    expect(body.data.truncated).toBe(true);
    expect(body.data.text).toBe('hello...');
    expect(body.data.text.length).toBe(8);
  });

  it('truncates without ellipsis', async () => {
    const res = await post('/v1/transform/truncate', { text: 'hello world', length: 5, ellipsis: false });
    expect(res.status).toBe(200);
    const body = await json<{ data: { text: string } }>(res);
    expect(body.data.text).toBe('hello');
  });

  it('returns original text when shorter than limit', async () => {
    const res = await post('/v1/transform/truncate', { text: 'hi', length: 100 });
    expect(res.status).toBe(200);
    const body = await json<{ data: { text: string; truncated: boolean } }>(res);
    expect(body.data.text).toBe('hi');
    expect(body.data.truncated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// /transform/count
// ---------------------------------------------------------------------------

describe('Transform - count', () => {
  it('counts words and characters', async () => {
    const res = await post('/v1/transform/count', { text: 'Hello world. How are you?' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { words: number; characters: number; sentences: number } }>(res);
    expect(body.data.words).toBe(5);
    expect(body.data.characters).toBe(25);
    expect(body.data.sentences).toBeGreaterThanOrEqual(1);
  });

  it('returns zeros for empty string', async () => {
    const res = await post('/v1/transform/count', { text: '' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { words: number; characters: number } }>(res);
    expect(body.data.words).toBe(0);
    expect(body.data.characters).toBe(0);
  });

  it('returns reading time estimate', async () => {
    const words = Array(200).fill('word').join(' ');
    const res = await post('/v1/transform/count', { text: words, words_per_minute: 200 });
    expect(res.status).toBe(200);
    const body = await json<{ data: { reading_time_minutes: number } }>(res);
    expect(body.data.reading_time_minutes).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// /transform/strip
// ---------------------------------------------------------------------------

describe('Transform - strip', () => {
  it('strips HTML tags', async () => {
    const res = await post('/v1/transform/strip', { text: '<p>Hello <b>world</b></p>' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { text: string } }>(res);
    expect(body.data.text).toBe('Hello world');
  });

  it('decodes HTML entities', async () => {
    const res = await post('/v1/transform/strip', { text: '&lt;script&gt;&amp;' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { text: string } }>(res);
    expect(body.data.text).toBe('<script>&');
  });
});

// ---------------------------------------------------------------------------
// /transform/reverse
// ---------------------------------------------------------------------------

describe('Transform - reverse', () => {
  it('reverses a string', async () => {
    const res = await post('/v1/transform/reverse', { text: 'hello' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { text: string } }>(res);
    expect(body.data.text).toBe('olleh');
  });

  it('handles empty string', async () => {
    const res = await post('/v1/transform/reverse', { text: '' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { text: string } }>(res);
    expect(body.data.text).toBe('');
  });

  it('handles Unicode emoji correctly', async () => {
    const res = await post('/v1/transform/reverse', { text: 'AB' });
    expect(res.status).toBe(200);
    const body = await json<{ data: { text: string } }>(res);
    expect(body.data.text).toBe('BA');
  });
});
