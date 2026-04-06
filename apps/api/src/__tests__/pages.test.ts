import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app.js';
import { setupTestDb } from './setup.js';

let app: ReturnType<typeof createApp>;
let devKey: string;

function authHeader(key: string) {
  return { Authorization: `Bearer ${key}` };
}

async function json<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

beforeAll(async () => {
  devKey = await setupTestDb();
  app = createApp();
});

describe('Pages CRUD', () => {
  let pageId: string;
  const slug = `test-page-${Date.now()}`;

  it('creates a page', async () => {
    const res = await app.request('/v1/links/pages', {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        title: 'Test Page',
        bio: 'A test bio',
        theme_id: 'default',
      }),
    });
    expect(res.status).toBe(201);
    const body = await json<{ data: { id: string; slug: string; title: string } }>(res);
    expect(body.data.slug).toBe(slug);
    expect(body.data.title).toBe('Test Page');
    pageId = body.data.id;
  });

  it('returns 409 for duplicate slug', async () => {
    const res = await app.request('/v1/links/pages', {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, title: 'Duplicate' }),
    });
    expect(res.status).toBe(409);
  });

  it('lists pages', async () => {
    const res = await app.request('/v1/links/pages', {
      headers: authHeader(devKey),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: unknown[]; meta: { pagination: { total: number } } }>(res);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.pagination.total).toBeGreaterThanOrEqual(1);
  });

  it('gets single page', async () => {
    const res = await app.request(`/v1/links/pages/${pageId}`, {
      headers: authHeader(devKey),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { id: string } }>(res);
    expect(body.data.id).toBe(pageId);
  });

  it('updates a page', async () => {
    const res = await app.request(`/v1/links/pages/${pageId}`, {
      method: 'PATCH',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Title', bio: 'Updated bio' }),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { title: string; bio: string } }>(res);
    expect(body.data.title).toBe('Updated Title');
    expect(body.data.bio).toBe('Updated bio');
  });

  it('publishes a page', async () => {
    const res = await app.request(`/v1/links/pages/${pageId}/publish`, {
      method: 'POST',
      headers: authHeader(devKey),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { published_at: string } }>(res);
    expect(body.data.published_at).toBeTruthy();
  });

  it('duplicates a page', async () => {
    const res = await app.request(`/v1/links/pages/${pageId}/duplicate`, {
      method: 'POST',
      headers: authHeader(devKey),
    });
    expect(res.status).toBe(201);
    const body = await json<{ data: { id: string; slug: string } }>(res);
    expect(body.data.id).not.toBe(pageId);
    expect(body.data.slug).toContain('-copy-');
  });

  it('returns 404 for non-existent page', async () => {
    const res = await app.request('/v1/links/pages/pg_nonexistent', {
      headers: authHeader(devKey),
    });
    expect(res.status).toBe(404);
  });

  it('deletes a page (soft delete)', async () => {
    const res = await app.request(`/v1/links/pages/${pageId}`, {
      method: 'DELETE',
      headers: authHeader(devKey),
    });
    expect(res.status).toBe(204);

    // Should not be accessible after delete
    const checkRes = await app.request(`/v1/links/pages/${pageId}`, {
      headers: authHeader(devKey),
    });
    expect(checkRes.status).toBe(404);
  });
});

describe('Public page render', () => {
  const slug = `public-page-${Date.now()}`;

  it('renders a published page without auth', async () => {
    // Create page
    await app.request('/v1/links/pages', {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, title: 'Public Page' }),
    });

    const res = await app.request(`/v1/p/${slug}`);
    expect(res.status).toBe(200);
    const body = await json<{ data: { slug: string; links: unknown[] } }>(res);
    expect(body.data.slug).toBe(slug);
    expect(Array.isArray(body.data.links)).toBe(true);
  });

  it('returns 404 for unknown slug', async () => {
    const res = await app.request('/v1/p/nonexistent-slug-xyz');
    expect(res.status).toBe(404);
  });
});
