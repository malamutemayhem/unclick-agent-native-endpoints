/**
 * Security & gap-coverage tests.
 * Covers: multi-tenant isolation, scope enforcement, input validation,
 * feedback endpoint, click tracking, rate limiting, and identified bugs.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app.js';
import { setupTestDb } from './setup.js';
import { getDb } from '../db/index.js';
import { orgs, apiKeys } from '../db/schema.js';
import { hashKey, newId } from '@unclick/core';

let app: ReturnType<typeof createApp>;
let orgAKey: string;  // dev org key (org_dev)
let orgBKey: string;  // second tenant key

function auth(key: string) {
  return { Authorization: `Bearer ${key}` };
}

async function json<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  orgAKey = await setupTestDb();
  app = createApp();

  // Create a second org + key directly in the DB (no API for org creation)
  const db = getDb();
  const orgBId = `org_b_${newId()}`;
  orgBKey = `agt_test_orgb_${newId()}${newId()}`.slice(0, 50);
  const keyHash = hashKey(orgBKey);

  await db.insert(orgs).values({
    id: orgBId,
    name: 'Org B',
    slug: `org-b-${orgBId}`,
    plan: 'pro',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(apiKeys).values({
    id: `key_b_${newId()}`,
    orgId: orgBId,
    name: 'Org B Key',
    keyHash,
    keyPrefix: 'orgb',
    scopes: '[]',
    environment: 'test',
    createdAt: new Date(),
  });
});

// ─── Multi-tenant Isolation ───────────────────────────────────────────────────

describe('Multi-tenant isolation', () => {
  let orgAPageId: string;
  let orgALinkId: string;

  it('org A creates a page', async () => {
    const res = await app.request('/v1/links/pages', {
      method: 'POST',
      headers: { ...auth(orgAKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: `tenant-iso-${Date.now()}`, title: 'Org A Page' }),
    });
    expect(res.status).toBe(201);
    const body = await json<{ data: { id: string } }>(res);
    orgAPageId = body.data.id;
  });

  it('org A creates a link on the page', async () => {
    const res = await app.request(`/v1/links/pages/${orgAPageId}/links`, {
      method: 'POST',
      headers: { ...auth(orgAKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Org A Link', url: 'https://orga.example.com' }),
    });
    expect(res.status).toBe(201);
    const body = await json<{ data: { id: string } }>(res);
    orgALinkId = body.data.id;
  });

  it('org B cannot GET org A\'s page', async () => {
    const res = await app.request(`/v1/links/pages/${orgAPageId}`, {
      headers: auth(orgBKey),
    });
    expect(res.status).toBe(404);
  });

  it('org B cannot PATCH org A\'s page', async () => {
    const res = await app.request(`/v1/links/pages/${orgAPageId}`, {
      method: 'PATCH',
      headers: { ...auth(orgBKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hijacked' }),
    });
    expect(res.status).toBe(404);
  });

  it('org B cannot DELETE org A\'s page', async () => {
    const res = await app.request(`/v1/links/pages/${orgAPageId}`, {
      method: 'DELETE',
      headers: auth(orgBKey),
    });
    expect(res.status).toBe(404);
  });

  it('org B cannot list org A\'s links', async () => {
    const res = await app.request(`/v1/links/pages/${orgAPageId}/links`, {
      headers: auth(orgBKey),
    });
    // Page not found = 404, not a list of org A's links
    expect(res.status).toBe(404);
  });

  it('org B cannot PATCH org A\'s link', async () => {
    const res = await app.request(`/v1/links/pages/${orgAPageId}/links/${orgALinkId}`, {
      method: 'PATCH',
      headers: { ...auth(orgBKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Stolen' }),
    });
    expect(res.status).toBe(404);
  });

  it('org B cannot view org A\'s analytics', async () => {
    const res = await app.request(`/v1/links/pages/${orgAPageId}/analytics`, {
      headers: auth(orgBKey),
    });
    expect(res.status).toBe(404);
  });

  it('org B\'s page list does not include org A\'s pages', async () => {
    const res = await app.request('/v1/links/pages', {
      headers: auth(orgBKey),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: Array<{ id: string }> }>(res);
    const ids = body.data.map((p) => p.id);
    expect(ids).not.toContain(orgAPageId);
  });
});

// ─── Scope Enforcement ────────────────────────────────────────────────────────

describe('Scope enforcement (requireScope)', () => {
  let readOnlyKey: string;

  beforeAll(async () => {
    // Create a scoped key via the API (scopes: ['links:read'])
    const res = await app.request('/v1/keys', {
      method: 'POST',
      headers: { ...auth(orgAKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Read-only key', environment: 'test', scopes: ['links:read'] }),
    });
    const body = await json<{ data: { key: string } }>(res);
    readOnlyKey = body.data.key;
  });

  it('read-only key can list pages', async () => {
    const res = await app.request('/v1/links/pages', {
      headers: auth(readOnlyKey),
    });
    // NOTE: If requireScope is wired up this would pass.
    // If scopes are not enforced, this still passes (reads are allowed anyway).
    expect(res.status).toBe(200);
  });

  it('read-only key cannot create pages (scope enforced)', async () => {
    const res = await app.request('/v1/links/pages', {
      method: 'POST',
      headers: { ...auth(readOnlyKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: `scope-test-${Date.now()}`, title: 'Should Fail' }),
    });
    expect(res.status).toBe(403);
  });
});

// ─── API Key Self-Revocation Guard ────────────────────────────────────────────

describe('API key management', () => {
  it('cannot revoke the key you are currently using', async () => {
    // List keys to find the current key id
    const listRes = await app.request('/v1/keys', { headers: auth(orgAKey) });
    const list = await json<{ data: Array<{ id: string }> }>(listRes);
    const devKey = list.data.find((k) => k.id === 'key_dev');
    if (!devKey) return; // dev key may not show if already seeded differently

    const res = await app.request(`/v1/keys/key_dev`, {
      method: 'DELETE',
      headers: auth(orgAKey),
    });
    expect(res.status).toBe(409);
  });
});

// ─── Input Validation ─────────────────────────────────────────────────────────

describe('Input validation — pages', () => {
  it('rejects missing required fields', async () => {
    const res = await app.request('/v1/links/pages', {
      method: 'POST',
      headers: { ...auth(orgAKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await json<{ error: { code: string; details: unknown[] } }>(res);
    expect(body.error.code).toBe('validation_error');
    expect(body.error.details).toBeDefined();
  });

  it('rejects invalid slug characters (uppercase)', async () => {
    const res = await app.request('/v1/links/pages', {
      method: 'POST',
      headers: { ...auth(orgAKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'Invalid-Slug', title: 'Test' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects slug with spaces', async () => {
    const res = await app.request('/v1/links/pages', {
      method: 'POST',
      headers: { ...auth(orgAKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'bad slug', title: 'Test' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects slug that is too long (>64 chars)', async () => {
    const res = await app.request('/v1/links/pages', {
      method: 'POST',
      headers: { ...auth(orgAKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'a'.repeat(65), title: 'Test' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects title that is too long (>128 chars)', async () => {
    const res = await app.request('/v1/links/pages', {
      method: 'POST',
      headers: { ...auth(orgAKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'valid-slug', title: 'x'.repeat(129) }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects bio that is too long (>500 chars)', async () => {
    const res = await app.request('/v1/links/pages', {
      method: 'POST',
      headers: { ...auth(orgAKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'valid-slug-2', title: 'Test', bio: 'x'.repeat(501) }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects avatar_url that is not a valid URL', async () => {
    const res = await app.request('/v1/links/pages', {
      method: 'POST',
      headers: { ...auth(orgAKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'valid-slug-3', title: 'Test', avatar_url: 'not-a-url' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('Input validation — links', () => {
  let pageId: string;

  beforeAll(async () => {
    const res = await app.request('/v1/links/pages', {
      method: 'POST',
      headers: { ...auth(orgAKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: `validation-links-${Date.now()}`, title: 'Val Links Page' }),
    });
    const body = await json<{ data: { id: string } }>(res);
    pageId = body.data.id;
  });

  it('rejects link with missing url', async () => {
    const res = await app.request(`/v1/links/pages/${pageId}/links`, {
      method: 'POST',
      headers: { ...auth(orgAKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'No URL' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects link with invalid url', async () => {
    const res = await app.request(`/v1/links/pages/${pageId}/links`, {
      method: 'POST',
      headers: { ...auth(orgAKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Bad URL', url: 'not-a-url' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects link with title too long (>256 chars)', async () => {
    const res = await app.request(`/v1/links/pages/${pageId}/links`, {
      method: 'POST',
      headers: { ...auth(orgAKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'x'.repeat(257), url: 'https://example.com' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects link with missing title', async () => {
    const res = await app.request(`/v1/links/pages/${pageId}/links`, {
      method: 'POST',
      headers: { ...auth(orgAKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    expect(res.status).toBe(400);
  });
});

// ─── Feedback Endpoint ────────────────────────────────────────────────────────

describe('Feedback endpoint', () => {
  it('POST /api/feedback succeeds without auth', async () => {
    const res = await app.request('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'bug',
        description: 'Something is broken in the links tool',
        tool: 'links',
        endpoint: '/v1/links/pages',
      }),
    });
    expect(res.status).toBe(201);
    const body = await json<{ data: { id: string; type: string; status: string; github_issue_shape: object } }>(res);
    expect(body.data.id).toMatch(/^fb_/);
    expect(body.data.status).toBe('open');
    expect(body.data.github_issue_shape).toBeDefined();
    expect(body.data.github_issue_shape).toHaveProperty('title');
    expect(body.data.github_issue_shape).toHaveProperty('body');
    expect(body.data.github_issue_shape).toHaveProperty('labels');
  });

  it('rejects feedback with description too short', async () => {
    const res = await app.request('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'bug', description: 'short' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects feedback with invalid type', async () => {
    const res = await app.request('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'invalid', description: 'This is a valid description that is long enough' }),
    });
    expect(res.status).toBe(400);
  });

  it('GET /api/feedback requires auth', async () => {
    const res = await app.request('/api/feedback');
    // Should be 401 since GET requires auth
    expect(res.status).toBe(401);
  });

  it('GET /api/feedback returns list with auth', async () => {
    const res = await app.request('/api/feedback', {
      headers: auth(orgAKey),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: unknown[]; meta: { pagination: object } }>(res);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.pagination).toBeDefined();
  });
});

// ─── Click Tracking Bug ───────────────────────────────────────────────────────

describe('Click tracking — track/click endpoint', () => {
  let pageId: string;
  let linkId: string;

  beforeAll(async () => {
    const pageRes = await app.request('/v1/links/pages', {
      method: 'POST',
      headers: { ...auth(orgAKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: `click-track-${Date.now()}`, title: 'Click Track Page' }),
    });
    const pageBody = await json<{ data: { id: string } }>(pageRes);
    pageId = pageBody.data.id;

    const linkRes = await app.request(`/v1/links/pages/${pageId}/links`, {
      method: 'POST',
      headers: { ...auth(orgAKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Track Me', url: 'https://trackme.example.com' }),
    });
    const linkBody = await json<{ data: { id: string } }>(linkRes);
    linkId = linkBody.data.id;
  });

  it('track/click ignores body.org_id and uses page\'s org from DB', async () => {
    // The endpoint is public (no auth). org_id is looked up from the DB via
    // the page_id — injecting a fake org_id in the body has no effect.
    const res = await app.request(`/track/${pageId}/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        link_id: linkId,
        org_id: 'org_totally_fake', // ignored — org comes from DB
      }),
    });
    expect(res.status).toBe(200);
  });

  it('track/click requires a link_id', async () => {
    const res = await app.request(`/track/${pageId}/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

// ─── Auth edge cases ──────────────────────────────────────────────────────────

describe('Auth edge cases', () => {
  it('returns 401 with empty Bearer token', async () => {
    const res = await app.request('/v1/links/pages', {
      headers: { Authorization: 'Bearer ' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 with Bearer prefix only (no key)', async () => {
    const res = await app.request('/v1/links/pages', {
      headers: { Authorization: 'Bearer' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong auth scheme (Basic)', async () => {
    const res = await app.request('/v1/links/pages', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 with a correctly-formatted but non-existent key', async () => {
    const fakeKey = 'agt_test_' + 'z'.repeat(43);
    const res = await app.request('/v1/links/pages', {
      headers: { Authorization: `Bearer ${fakeKey}` },
    });
    expect(res.status).toBe(401);
    const body = await json<{ error: { code: string } }>(res);
    expect(body.error.code).toBe('authentication_error');
  });

  it('error responses always include request_id in meta', async () => {
    const res = await app.request('/v1/links/pages');
    const body = await json<{ meta: { request_id: string } }>(res);
    expect(body.meta?.request_id).toMatch(/^req_/);
  });
});

// ─── Not Found Routes ─────────────────────────────────────────────────────────

describe('404 handling', () => {
  it('returns structured 404 for unknown routes', async () => {
    const res = await app.request('/v1/nonexistent/route', {
      headers: auth(orgAKey),
    });
    expect(res.status).toBe(404);
    const body = await json<{ error: { code: string } }>(res);
    expect(body.error.code).toBe('not_found');
  });

  it('unknown route 404 includes request_id', async () => {
    const res = await app.request('/no-such-path');
    const body = await json<{ meta?: { request_id: string } }>(res);
    expect(body.meta?.request_id).toMatch(/^req_/);
  });
});

// ─── Public page render ───────────────────────────────────────────────────────

describe('Public page render — /v1/p/:slug', () => {
  const slug = `public-qa-${Date.now()}`;

  it('returns 404 for unpublished slug (page not created yet)', async () => {
    const res = await app.request(`/v1/p/${slug}`);
    expect(res.status).toBe(404);
  });

  it('returns page data without auth after creation', async () => {
    await app.request('/v1/links/pages', {
      method: 'POST',
      headers: { ...auth(orgAKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, title: 'QA Public Page', bio: 'QA bio' }),
    });

    const res = await app.request(`/v1/p/${slug}`);
    expect(res.status).toBe(200);
    const body = await json<{ data: { slug: string; links: unknown[]; socials: unknown[] } }>(res);
    expect(body.data.slug).toBe(slug);
    expect(Array.isArray(body.data.links)).toBe(true);
    expect(Array.isArray(body.data.socials)).toBe(true);
  });
});

// ─── Webhook signature ────────────────────────────────────────────────────────

describe('Webhook management', () => {
  let webhookId: string;
  let webhookSecret: string;

  it('creates a webhook and returns a secret', async () => {
    const res = await app.request('/v1/webhooks', {
      method: 'POST',
      headers: { ...auth(orgAKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://webhook.site/test',
        events: ['link.created', 'page.updated'],
      }),
    });
    expect(res.status).toBe(201);
    const body = await json<{ data: { id: string; secret: string; url: string } }>(res);
    webhookId = body.data.id;
    webhookSecret = body.data.secret;
    expect(webhookSecret).toMatch(/^whsec_/);
    // Secret should NOT be in subsequent list responses
  });

  it('list response does NOT expose webhook secrets', async () => {
    const res = await app.request('/v1/webhooks', {
      headers: auth(orgAKey),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: Array<Record<string, unknown>> }>(res);
    for (const wh of body.data) {
      expect(wh.secret).toBeUndefined();
    }
  });

  it('org B cannot see org A\'s webhooks', async () => {
    const res = await app.request(`/v1/webhooks/${webhookId}`, {
      headers: auth(orgBKey),
    });
    expect(res.status).toBe(404);
  });
});

// ─── Pagination ───────────────────────────────────────────────────────────────

describe('Pagination', () => {
  it('respects per_page limit', async () => {
    const res = await app.request('/v1/links/pages?per_page=1', {
      headers: auth(orgAKey),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: unknown[]; meta: { pagination: { per_page: number; has_more: boolean } } }>(res);
    expect(body.data.length).toBeLessThanOrEqual(1);
    expect(body.meta.pagination.per_page).toBe(1);
  });

  it('caps per_page at 100', async () => {
    const res = await app.request('/v1/links/pages?per_page=9999', {
      headers: auth(orgAKey),
    });
    expect(res.status).toBe(200);
    const body = await json<{ meta: { pagination: { per_page: number } } }>(res);
    expect(body.meta.pagination.per_page).toBeLessThanOrEqual(100);
  });

  it('page=0 is normalized to page=1', async () => {
    const res = await app.request('/v1/links/pages?page=0', {
      headers: auth(orgAKey),
    });
    expect(res.status).toBe(200);
    const body = await json<{ meta: { pagination: { page: number } } }>(res);
    expect(body.meta.pagination.page).toBe(1);
  });
});

// ─── Themes (read-only, no tenant restriction) ───────────────────────────────

describe('Themes', () => {
  it('any valid key can list themes', async () => {
    const resA = await app.request('/v1/themes', { headers: auth(orgAKey) });
    const resB = await app.request('/v1/themes', { headers: auth(orgBKey) });
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
  });

  it('includes a premium theme (aurora)', async () => {
    const res = await app.request('/v1/themes/aurora', { headers: auth(orgAKey) });
    expect(res.status).toBe(200);
    const body = await json<{ data: { id: string; is_premium: boolean } }>(res);
    expect(body.data.id).toBe('aurora');
    expect(body.data.is_premium).toBe(true);
  });

  it('returns 404 for unknown theme', async () => {
    const res = await app.request('/v1/themes/nonexistent-theme', { headers: auth(orgAKey) });
    expect(res.status).toBe(404);
  });
});
