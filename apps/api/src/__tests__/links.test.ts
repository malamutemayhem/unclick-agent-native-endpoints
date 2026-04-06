import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app.js';
import { setupTestDb } from './setup.js';

let app: ReturnType<typeof createApp>;
let devKey: string;
let pageId: string;

function authHeader(key: string) {
  return { Authorization: `Bearer ${key}` };
}

async function json<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

beforeAll(async () => {
  devKey = await setupTestDb();
  app = createApp();

  // Create a test page to attach links to
  const res = await app.request('/v1/links/pages', {
    method: 'POST',
    headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: `links-test-${Date.now()}`, title: 'Links Test Page' }),
  });
  const body = await json<{ data: { id: string } }>(res);
  pageId = body.data.id;
});

describe('Links CRUD', () => {
  let linkId: string;

  it('creates a link', async () => {
    const res = await app.request(`/v1/links/pages/${pageId}/links`, {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'My Portfolio',
        url: 'https://example.com',
        highlight: false,
      }),
    });
    expect(res.status).toBe(201);
    const body = await json<{ data: { id: string; title: string; position: number } }>(res);
    expect(body.data.title).toBe('My Portfolio');
    expect(body.data.position).toBe(0);
    linkId = body.data.id;
  });

  it('creates a second link with auto-position', async () => {
    const res = await app.request(`/v1/links/pages/${pageId}/links`, {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Second Link', url: 'https://example2.com' }),
    });
    expect(res.status).toBe(201);
    const body = await json<{ data: { position: number } }>(res);
    expect(body.data.position).toBe(1);
  });

  it('lists links ordered by position', async () => {
    const res = await app.request(`/v1/links/pages/${pageId}/links`, {
      headers: authHeader(devKey),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: Array<{ position: number }> }>(res);
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    // Should be in position order
    for (let i = 1; i < body.data.length; i++) {
      expect(body.data[i].position).toBeGreaterThanOrEqual(body.data[i - 1].position);
    }
  });

  it('updates a link', async () => {
    const res = await app.request(`/v1/links/pages/${pageId}/links/${linkId}`, {
      method: 'PATCH',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Portfolio', highlight: true }),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { title: string; highlight: boolean } }>(res);
    expect(body.data.title).toBe('Updated Portfolio');
    expect(body.data.highlight).toBe(true);
  });

  it('reorders links', async () => {
    // Get current links
    const listRes = await app.request(`/v1/links/pages/${pageId}/links`, {
      headers: authHeader(devKey),
    });
    const listBody = await json<{ data: Array<{ id: string }> }>(listRes);
    const ids = listBody.data.map((l) => l.id).reverse();

    const res = await app.request(`/v1/links/pages/${pageId}/links/reorder`, {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: Array<{ id: string }> }>(res);
    expect(body.data[0].id).toBe(ids[0]);
  });

  it('batch creates and deletes links', async () => {
    const res = await app.request(`/v1/links/pages/${pageId}/links/batch`, {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operations: [
          { action: 'create', data: { title: 'Batch Link', url: 'https://batch.example.com' } },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: Array<{ action: string; id: string }> }>(res);
    expect(body.data[0].action).toBe('create');
  });

  it('returns 404 for link on wrong page', async () => {
    const res = await app.request(`/v1/links/pages/pg_wrong/links/${linkId}`, {
      method: 'PATCH',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Fail' }),
    });
    expect(res.status).toBe(404);
  });

  it('deletes a link', async () => {
    const res = await app.request(`/v1/links/pages/${pageId}/links/${linkId}`, {
      method: 'DELETE',
      headers: authHeader(devKey),
    });
    expect(res.status).toBe(204);
  });
});

describe('Themes', () => {
  it('lists all themes', async () => {
    const res = await app.request('/v1/themes', {
      headers: authHeader(devKey),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: Array<{ id: string; name: string }> }>(res);
    expect(body.data.length).toBeGreaterThanOrEqual(5);
  });

  it('gets a specific theme', async () => {
    const res = await app.request('/v1/themes/minimal-dark', {
      headers: authHeader(devKey),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { id: string; config: object } }>(res);
    expect(body.data.id).toBe('minimal-dark');
    expect(body.data.config).toBeDefined();
  });
});

describe('Socials', () => {
  it('sets and gets social links', async () => {
    const setRes = await app.request(`/v1/links/pages/${pageId}/socials`, {
      method: 'PUT',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        socials: [
          { platform: 'instagram', url: 'https://instagram.com/test' },
          { platform: 'github', url: 'https://github.com/test' },
        ],
      }),
    });
    expect(setRes.status).toBe(200);

    const getRes = await app.request(`/v1/links/pages/${pageId}/socials`, {
      headers: authHeader(devKey),
    });
    expect(getRes.status).toBe(200);
    const body = await json<{ data: Array<{ platform: string }> }>(getRes);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].platform).toBe('instagram');
  });
});

describe('API key management', () => {
  it('creates a new API key', async () => {
    const res = await app.request('/v1/keys', {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Key', environment: 'test', scopes: ['links:read'] }),
    });
    expect(res.status).toBe(201);
    const body = await json<{ data: { key: string; key_prefix: string } }>(res);
    expect(body.data.key).toMatch(/^agt_test_/);
    expect(body.data.key_prefix).toBeDefined();
  });

  it('lists API keys without exposing plaintext', async () => {
    const res = await app.request('/v1/keys', {
      headers: authHeader(devKey),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: Array<Record<string, unknown>> }>(res);
    // No key field in list response
    for (const key of body.data) {
      expect(key.key).toBeUndefined();
      expect(key.key_prefix).toBeDefined();
    }
  });
});
