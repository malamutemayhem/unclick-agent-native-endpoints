/**
 * Tests for UnClick Markdown - /v1/markdown
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

async function post(path: string, body: unknown) {
  return app.request(`/v1/markdown${path}`, {
    method: 'POST',
    headers: { ...auth(apiKey), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── POST /v1/markdown/to-html ────────────────────────────────────────────────

describe('POST /v1/markdown/to-html', () => {
  it('converts a heading to HTML', async () => {
    const res = await post('/to-html', { markdown: '# Hello World' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.html).toContain('<h1>');
    expect(body.data.html).toContain('Hello World');
  });

  it('converts bold text', async () => {
    const res = await post('/to-html', { markdown: '**bold**' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.html).toContain('<strong>');
  });

  it('converts a link', async () => {
    const res = await post('/to-html', { markdown: '[click](https://example.com)' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.html).toContain('<a');
    expect(body.data.html).toContain('href=');
  });

  it('handles empty markdown', async () => {
    const res = await post('/to-html', { markdown: '' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(typeof body.data.html).toBe('string');
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/v1/markdown/to-html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: '# hi' }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── POST /v1/markdown/to-text ────────────────────────────────────────────────

describe('POST /v1/markdown/to-text', () => {
  it('strips heading markers', async () => {
    const res = await post('/to-text', { markdown: '# Hello' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.text).not.toContain('#');
    expect(body.data.text).toContain('Hello');
  });

  it('strips bold markers', async () => {
    const res = await post('/to-text', { markdown: '**bold text**' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.text).not.toContain('**');
    expect(body.data.text).toContain('bold text');
  });

  it('keeps link text but removes URL', async () => {
    const res = await post('/to-text', { markdown: '[UnClick](https://example.com)' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.text).toContain('UnClick');
    expect(body.data.text).not.toContain('https://');
  });

  it('removes images', async () => {
    const res = await post('/to-text', { markdown: '![alt text](image.png)' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.text).not.toContain('![');
  });

  it('strips block-quote markers', async () => {
    const res = await post('/to-text', { markdown: '> quoted text' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.text).not.toContain('>');
    expect(body.data.text).toContain('quoted text');
  });
});

// ─── POST /v1/markdown/toc ────────────────────────────────────────────────────

describe('POST /v1/markdown/toc', () => {
  const src = `# Title\n\n## Section One\n\nSome text.\n\n### Subsection\n\n## Section Two\n`;

  it('extracts all headings with levels', async () => {
    const res = await post('/toc', { markdown: src });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.count).toBe(4);
    expect(body.data.headings[0]).toMatchObject({ level: 1, text: 'Title' });
    expect(body.data.headings[1]).toMatchObject({ level: 2, text: 'Section One' });
    expect(body.data.headings[2]).toMatchObject({ level: 3, text: 'Subsection' });
    expect(body.data.headings[3]).toMatchObject({ level: 2, text: 'Section Two' });
  });

  it('generates anchor slugs', async () => {
    const res = await post('/toc', { markdown: '## Hello World!' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.headings[0].anchor).toContain('hello');
    expect(body.data.headings[0].anchor).toContain('world');
  });

  it('returns empty for no headings', async () => {
    const res = await post('/toc', { markdown: 'just paragraph text here' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.count).toBe(0);
    expect(body.data.headings).toEqual([]);
  });
});

// ─── POST /v1/markdown/lint ───────────────────────────────────────────────────

describe('POST /v1/markdown/lint', () => {
  it('returns valid for clean markdown', async () => {
    const res = await post('/lint', {
      markdown: '# Hello\n\nA paragraph.\n\n```js\nconsole.log("hi");\n```\n',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.valid).toBe(true);
    expect(body.data.count).toBe(0);
  });

  it('detects an unclosed fenced code block', async () => {
    const res = await post('/lint', { markdown: '```js\nconst x = 1;\n' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.valid).toBe(false);
    expect(body.data.issues.some((i: any) => i.message.includes('Unclosed fenced code block'))).toBe(true);
  });

  it('detects an empty heading', async () => {
    const res = await post('/lint', { markdown: '## \n\nsome text' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.valid).toBe(false);
    expect(body.data.issues.some((i: any) => i.message.includes('Empty heading'))).toBe(true);
  });

  it('returns issues array and count', async () => {
    const res = await post('/lint', { markdown: '```\n# unclosed\n##\n' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data.issues)).toBe(true);
    expect(typeof body.data.count).toBe('number');
    expect(body.data.count).toBe(body.data.issues.length);
  });
});
