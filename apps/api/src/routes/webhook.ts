import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, desc, lt, sql } from 'drizzle-orm';
import { ok, created, noContent, list, Errors, newId } from '@unclick/core';
import type { MiddlewareHandler } from 'hono';
import type { Db } from '../db/index.js';
import { webhookBins, webhookBinRequests } from '../db/schema.js';
import type { AppVariables } from '../middleware/types.js';
import { requireScope } from '../middleware/auth.js';
import { zv } from '../middleware/validate.js';

// Webhook bins auto-expire after 24 hours
const BIN_TTL_MS = 24 * 60 * 60 * 1000;
// Maximum body stored per request (100 KB)
const MAX_BODY_BYTES = 100_000;

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ListRequestsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  page: z.number().int().min(1).default(1),
});

// ─── Router ───────────────────────────────────────────────────────────────────

/**
 * Mounted BEFORE the global /v1/* auth middleware so the public receive
 * endpoint works without authentication.  Protected routes apply `auth`
 * inline via the passed-in middleware.
 */
export function createWebhookBinRouter(db: Db, auth: MiddlewareHandler) {
  const router = new Hono<{ Variables: AppVariables }>();

  // ── POST /webhook/create ─────────────────────────────────────────────────

  router.post('/create', auth, requireScope('webhook:write'), async (c) => {
    const { orgId } = c.get('org');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + BIN_TTL_MS);
    const id = `wbh_${newId()}`;

    await db.insert(webhookBins).values({ id, orgId, createdAt: now, expiresAt });

    const proto = c.req.header('X-Forwarded-Proto') ?? 'https';
    const host = c.req.header('X-Forwarded-Host') ?? c.req.header('Host') ?? 'api.unclick.world';
    const url = `${proto}://${host}/v1/webhook/${id}/receive`;

    return created(c, {
      id,
      url,
      expires_at: expiresAt.toISOString(),
      created_at: now.toISOString(),
    });
  });

  // ── ALL /webhook/:id/receive ─────────────────────────────────────────────
  // Public endpoint — accepts any HTTP method, stores the incoming request.

  router.all('/:id/receive', async (c) => {
    const { id } = c.req.param();
    const now = new Date();

    // Look up the bin
    const [bin] = await db
      .select()
      .from(webhookBins)
      .where(eq(webhookBins.id, id))
      .limit(1);

    if (!bin) {
      return c.json({ error: { code: 'not_found', message: 'Webhook bin not found' } }, 404);
    }

    if (bin.expiresAt < now) {
      return c.json({ error: { code: 'gone', message: 'Webhook bin has expired' } }, 410);
    }

    // Capture headers (filter out sensitive/large values)
    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'authorization') {
        headers[key] = value;
      }
    });

    // Capture body as text (capped at MAX_BODY_BYTES)
    let body: string | null = null;
    try {
      const raw = await c.req.text();
      body = raw.length > MAX_BODY_BYTES ? raw.slice(0, MAX_BODY_BYTES) + '…[truncated]' : raw;
    } catch {
      body = null;
    }

    // Capture query params
    const queryParams: Record<string, string> = {};
    const url = new URL(c.req.url);
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    const reqId = `wbr_${newId()}`;
    await db.insert(webhookBinRequests).values({
      id: reqId,
      binId: id,
      method: c.req.method,
      headers: JSON.stringify(headers),
      body,
      queryParams: JSON.stringify(queryParams),
      receivedAt: now,
    });

    return c.json({ ok: true, id: reqId, received_at: now.toISOString() });
  });

  // ── POST /webhook/:id/requests ───────────────────────────────────────────

  router.post('/:id/requests', auth, requireScope('webhook:read'), zv('json', ListRequestsSchema), async (c) => {
    const { orgId } = c.get('org');
    const { id } = c.req.param();
    const { limit: perPage, page } = c.req.valid('json');

    // Verify the bin belongs to this org
    const [bin] = await db
      .select()
      .from(webhookBins)
      .where(and(eq(webhookBins.id, id), eq(webhookBins.orgId, orgId)))
      .limit(1);

    if (!bin) throw Errors.notFound('Webhook bin not found');

    const offset = (page - 1) * perPage;

    const [countRow] = await db
      .select({ n: sql`count(*)` })
      .from(webhookBinRequests)
      .where(eq(webhookBinRequests.binId, id));

    const total = Number(countRow?.n ?? 0);

    const rows = await db
      .select()
      .from(webhookBinRequests)
      .where(eq(webhookBinRequests.binId, id))
      .orderBy(desc(webhookBinRequests.receivedAt))
      .limit(perPage)
      .offset(offset);

    return list(
      c,
      rows.map((r) => ({
        id: r.id,
        method: r.method,
        headers: JSON.parse(r.headers),
        body: r.body,
        query_params: JSON.parse(r.queryParams),
        received_at: r.receivedAt.toISOString(),
      })),
      {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    );
  });

  // ── DELETE /webhook/:id ──────────────────────────────────────────────────

  router.delete('/:id', auth, requireScope('webhook:write'), async (c) => {
    const { orgId } = c.get('org');
    const { id } = c.req.param();

    const [bin] = await db
      .select({ id: webhookBins.id })
      .from(webhookBins)
      .where(and(eq(webhookBins.id, id), eq(webhookBins.orgId, orgId)))
      .limit(1);

    if (!bin) throw Errors.notFound('Webhook bin not found');

    // Cascade delete requests first (PGlite doesn't enforce FK cascade in all cases)
    await db.delete(webhookBinRequests).where(eq(webhookBinRequests.binId, id));
    await db.delete(webhookBins).where(eq(webhookBins.id, id));

    return noContent();
  });

  // ── GET /webhook/cleanup (internal: purge expired bins) ──────────────────
  // Optional maintenance route — not exposed in docs but useful for tests.

  router.delete('/_cleanup', auth, requireScope('webhook:write'), async (c) => {
    const now = new Date();
    // Delete requests for expired bins first
    const expired = await db
      .select({ id: webhookBins.id })
      .from(webhookBins)
      .where(lt(webhookBins.expiresAt, now));

    for (const bin of expired) {
      await db.delete(webhookBinRequests).where(eq(webhookBinRequests.binId, bin.id));
    }
    await db.delete(webhookBins).where(lt(webhookBins.expiresAt, now));

    return ok(c, { purged: expired.length });
  });

  return router;
}
