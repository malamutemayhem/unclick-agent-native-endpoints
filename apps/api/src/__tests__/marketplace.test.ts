/**
 * Tests for UnClick Marketplace - /v1/marketplace
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app.js';
import { setupTestDb } from './setup.js';

let app: ReturnType<typeof createApp>;
let apiKey: string;

function authHeaders(key: string) {
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

beforeAll(async () => {
  apiKey = await setupTestDb();
  app = createApp();
});

// ─── GET /v1/marketplace/categories ──────────────────────────────────────────

describe('GET /v1/marketplace/categories', () => {
  it('returns all 7 seeded categories', async () => {
    const res = await app.request('/v1/marketplace/categories');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(7);
  });

  it('each category has required fields', async () => {
    const res = await app.request('/v1/marketplace/categories');
    const body = await res.json() as any;
    for (const cat of body.data) {
      expect(cat).toHaveProperty('id');
      expect(cat).toHaveProperty('slug');
      expect(cat).toHaveProperty('name');
      expect(cat).toHaveProperty('icon');
      expect(cat).toHaveProperty('tool_count');
      expect(cat).toHaveProperty('sort_order');
    }
  });

  it('categories are ordered by sort_order', async () => {
    const res = await app.request('/v1/marketplace/categories');
    const body = await res.json() as any;
    const orders = body.data.map((c: any) => c.sort_order) as number[];
    const sorted = [...orders].sort((a, b) => a - b);
    expect(orders).toEqual(sorted);
  });

  it('includes expected slugs', async () => {
    const res = await app.request('/v1/marketplace/categories');
    const body = await res.json() as any;
    const slugs = body.data.map((c: any) => c.slug) as string[];
    expect(slugs).toContain('utility');
    expect(slugs).toContain('text');
    expect(slugs).toContain('data');
    expect(slugs).toContain('media');
    expect(slugs).toContain('network');
    expect(slugs).toContain('productivity');
    expect(slugs).toContain('security');
  });

  it('is accessible without authentication', async () => {
    const res = await app.request('/v1/marketplace/categories');
    expect(res.status).toBe(200);
  });
});

// ─── GET /v1/marketplace/tools ───────────────────────────────────────────────

describe('GET /v1/marketplace/tools', () => {
  it('returns all 23 seeded tools', async () => {
    const res = await app.request('/v1/marketplace/tools?per_page=100');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBe(23);
  });

  it('each tool has required fields', async () => {
    const res = await app.request('/v1/marketplace/tools');
    const body = await res.json() as any;
    for (const tool of body.data) {
      expect(tool).toHaveProperty('slug');
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('tagline');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('category');
      expect(tool).toHaveProperty('base_url');
      expect(tool).toHaveProperty('status');
      expect(tool).toHaveProperty('version');
      expect(tool).toHaveProperty('total_calls');
      expect(tool).toHaveProperty('rating_count');
    }
  });

  it('is accessible without authentication', async () => {
    const res = await app.request('/v1/marketplace/tools');
    expect(res.status).toBe(200);
  });

  it('filters by category', async () => {
    const res = await app.request('/v1/marketplace/tools?category=network&per_page=100');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBeGreaterThan(0);
    for (const tool of body.data) {
      expect(tool.category).toBe('network');
    }
  });

  it('paginates results', async () => {
    const res = await app.request('/v1/marketplace/tools?per_page=5&page=1');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBe(5);
    expect(body.meta.pagination.per_page).toBe(5);
    expect(body.meta.pagination.total).toBe(23);
    expect(body.meta.pagination.total_pages).toBe(5);
  });

  it('page 2 returns different tools than page 1', async () => {
    const p1 = await app.request('/v1/marketplace/tools?per_page=5&page=1');
    const p2 = await app.request('/v1/marketplace/tools?per_page=5&page=2');
    const b1 = await p1.json() as any;
    const b2 = await p2.json() as any;
    const slugs1 = b1.data.map((t: any) => t.slug) as string[];
    const slugs2 = b2.data.map((t: any) => t.slug) as string[];
    const overlap = slugs1.filter((s) => slugs2.includes(s));
    expect(overlap.length).toBe(0);
  });
});

// ─── GET /v1/marketplace/tools/:slug ─────────────────────────────────────────

describe('GET /v1/marketplace/tools/:slug', () => {
  it('returns tool detail for unclick-hash', async () => {
    const res = await app.request('/v1/marketplace/tools/unclick-hash');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.slug).toBe('unclick-hash');
    expect(body.data.category).toBe('security');
  });

  it('includes endpoints array', async () => {
    const res = await app.request('/v1/marketplace/tools/unclick-hash');
    const body = await res.json() as any;
    expect(Array.isArray(body.data.endpoints)).toBe(true);
    expect(body.data.endpoints.length).toBeGreaterThan(0);
  });

  it('each endpoint has method, path, summary, scopes_required', async () => {
    const res = await app.request('/v1/marketplace/tools/unclick-kv');
    const body = await res.json() as any;
    for (const ep of body.data.endpoints) {
      expect(ep).toHaveProperty('method');
      expect(ep).toHaveProperty('path');
      expect(ep).toHaveProperty('summary');
      expect(ep).toHaveProperty('scopes_required');
      expect(Array.isArray(ep.scopes_required)).toBe(true);
    }
  });

  it('includes publisher info', async () => {
    const res = await app.request('/v1/marketplace/tools/unclick-shorten');
    const body = await res.json() as any;
    expect(body.data.publisher).not.toBeNull();
    expect(body.data.publisher.slug).toBe('unclick');
    expect(body.data.publisher.verified).toBe(true);
  });

  it('includes openapi_spec field', async () => {
    const res = await app.request('/v1/marketplace/tools/unclick-kv');
    const body = await res.json() as any;
    expect(body.data).toHaveProperty('openapi_spec');
  });

  it('returns 404 for unknown slug', async () => {
    const res = await app.request('/v1/marketplace/tools/no-such-tool');
    expect(res.status).toBe(404);
  });

  it('is accessible without authentication', async () => {
    const res = await app.request('/v1/marketplace/tools/unclick-uuid');
    expect(res.status).toBe(200);
  });
});

// ─── GET /v1/marketplace/search ──────────────────────────────────────────────

describe('GET /v1/marketplace/search', () => {
  it('finds tools by name', async () => {
    const res = await app.request('/v1/marketplace/search?q=hash');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const slugs = body.data.map((t: any) => t.slug) as string[];
    expect(slugs).toContain('unclick-hash');
  });

  it('finds tools by tagline', async () => {
    const res = await app.request('/v1/marketplace/search?q=QR+code');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const slugs = body.data.map((t: any) => t.slug) as string[];
    expect(slugs).toContain('unclick-qr');
  });

  it('finds tools by description', async () => {
    const res = await app.request('/v1/marketplace/search?q=key-value');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const slugs = body.data.map((t: any) => t.slug) as string[];
    expect(slugs).toContain('unclick-kv');
  });

  it('returns empty array for no matches', async () => {
    const res = await app.request('/v1/marketplace/search?q=xyznomatch12345');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toEqual([]);
  });

  it('returns empty array when q is missing', async () => {
    const res = await app.request('/v1/marketplace/search');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toEqual([]);
  });

  it('is accessible without authentication', async () => {
    const res = await app.request('/v1/marketplace/search?q=color');
    expect(res.status).toBe(200);
  });
});

// ─── GET /v1/marketplace/featured ────────────────────────────────────────────

describe('GET /v1/marketplace/featured', () => {
  it('returns up to 10 tools', async () => {
    const res = await app.request('/v1/marketplace/featured');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeLessThanOrEqual(10);
  });

  it('is accessible without authentication', async () => {
    const res = await app.request('/v1/marketplace/featured');
    expect(res.status).toBe(200);
  });
});

// ─── GET /v1/marketplace/stats ───────────────────────────────────────────────

describe('GET /v1/marketplace/stats', () => {
  it('returns correct total_tools count', async () => {
    const res = await app.request('/v1/marketplace/stats');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.total_tools).toBe(23);
  });

  it('includes total_categories', async () => {
    const res = await app.request('/v1/marketplace/stats');
    const body = await res.json() as any;
    expect(body.data.total_categories).toBe(7);
  });

  it('includes categories array with slug, name, tool_count', async () => {
    const res = await app.request('/v1/marketplace/stats');
    const body = await res.json() as any;
    expect(Array.isArray(body.data.categories)).toBe(true);
    for (const cat of body.data.categories) {
      expect(cat).toHaveProperty('slug');
      expect(cat).toHaveProperty('name');
      expect(cat).toHaveProperty('tool_count');
    }
  });

  it('is accessible without authentication', async () => {
    const res = await app.request('/v1/marketplace/stats');
    expect(res.status).toBe(200);
  });
});

// ─── POST /v1/marketplace/tools/:slug/rate ────────────────────────────────────

describe('POST /v1/marketplace/tools/:slug/rate', () => {
  it('requires authentication', async () => {
    const res = await app.request('/v1/marketplace/tools/unclick-hash/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 5 }),
    });
    expect(res.status).toBe(401);
  });

  it('submits a rating and returns new average', async () => {
    const res = await app.request('/v1/marketplace/tools/unclick-kv/rate', {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({ rating: 5, review: 'Excellent tool!' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.rating).toBe(5);
    expect(body.data.review).toBe('Excellent tool!');
    expect(body.data.new_avg).toBe(5);
    expect(body.data.rating_count).toBe(1);
  });

  it('updates an existing rating', async () => {
    // First rate
    await app.request('/v1/marketplace/tools/unclick-uuid/rate', {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({ rating: 3 }),
    });
    // Update
    const res = await app.request('/v1/marketplace/tools/unclick-uuid/rate', {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({ rating: 4 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.rating).toBe(4);
    expect(body.data.rating_count).toBe(1); // still one rating per org
  });

  it('returns 400 for out-of-range rating', async () => {
    const res = await app.request('/v1/marketplace/tools/unclick-hash/rate', {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({ rating: 6 }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for rating of 0', async () => {
    const res = await app.request('/v1/marketplace/tools/unclick-hash/rate', {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({ rating: 0 }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown tool slug', async () => {
    const res = await app.request('/v1/marketplace/tools/no-such-tool/rate', {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({ rating: 5 }),
    });
    expect(res.status).toBe(404);
  });

  it('rating updates the tool average on detail endpoint', async () => {
    // Rate the tool
    await app.request('/v1/marketplace/tools/unclick-regex/rate', {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({ rating: 5 }),
    });
    // Check tool detail
    const res = await app.request('/v1/marketplace/tools/unclick-regex');
    const body = await res.json() as any;
    expect(body.data.rating).toBe(5);
    expect(body.data.rating_count).toBeGreaterThan(0);
  });
});

// ─── GET /v1/billing/pricing ─────────────────────────────────────────────────

describe('GET /v1/billing/pricing', () => {
  it('returns pricing for all 23 tools', async () => {
    const res = await app.request('/v1/billing/pricing');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBe(23);
  });

  it('each entry has required billing fields', async () => {
    const res = await app.request('/v1/billing/pricing');
    const body = await res.json() as any;
    for (const p of body.data) {
      expect(p).toHaveProperty('tool_slug');
      expect(p).toHaveProperty('price_per_call_micro');
      expect(p).toHaveProperty('price_per_1000_usd_cents');
      expect(p).toHaveProperty('free_tier_calls');
    }
  });

  it('is accessible without authentication', async () => {
    const res = await app.request('/v1/billing/pricing');
    expect(res.status).toBe(200);
  });
});
