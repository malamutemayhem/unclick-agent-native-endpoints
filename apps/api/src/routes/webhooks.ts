import { Hono } from 'hono';
import { zv } from '../middleware/validate.js';
import { z } from 'zod';
import { eq, and, desc, count } from 'drizzle-orm';
import { ok, created, list, Errors, parsePagination, newId, generateApiKey } from '@unclick/core';
import type { Db } from '../db/index.js';
import { webhookEndpoints, webhookDeliveries } from '../db/schema.js';
import type { AppVariables } from '../middleware/types.js';
import { requireScope } from '../middleware/auth.js';
import { createHmac, randomBytes } from 'node:crypto';

const ALL_EVENTS = [
  'link.created', 'link.updated', 'link.deleted', 'link.clicked',
  'page.created', 'page.updated', 'page.deleted', 'page.viewed',
] as const;

const CreateWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(ALL_EVENTS)).min(1),
});

const UpdateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.enum(ALL_EVENTS)).optional(),
  active: z.boolean().optional(),
});

function generateSecret(): string {
  return `whsec_${randomBytes(32).toString('base64url')}`;
}

function formatWebhook(row: typeof webhookEndpoints.$inferSelect) {
  return {
    id: row.id,
    url: row.url,
    events: JSON.parse(row.events ?? '[]'),
    active: row.active,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function createWebhooksRouter(db: Db) {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /webhooks
  router.post('/', requireScope('webhooks:write'), zv('json', CreateWebhookSchema), async (c) => {
    const { orgId } = c.get('org');
    const body = c.req.valid('json');

    const secret = generateSecret();
    const now = new Date();
    const webhook: typeof webhookEndpoints.$inferInsert = {
      id: `wh_${newId()}`,
      orgId,
      url: body.url,
      events: JSON.stringify(body.events),
      secret,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(webhookEndpoints).values(webhook);
    const [inserted] = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, webhook.id));

    // Return secret only on creation
    return created(c, { ...formatWebhook(inserted), secret });
  });

  // GET /webhooks
  router.get('/', requireScope('webhooks:read'), async (c) => {
    const { orgId } = c.get('org');
    const { page, per_page } = parsePagination(c.req.query() as Record<string, string>);

    const [{ total }] = await db
      .select({ total: count() })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.orgId, orgId));

    const rows = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.orgId, orgId))
      .orderBy(desc(webhookEndpoints.createdAt))
      .limit(per_page)
      .offset((page - 1) * per_page);

    return list(c, rows.map(formatWebhook), { total, page, per_page, has_more: page * per_page < total });
  });

  // GET /webhooks/:id
  router.get('/:id', requireScope('webhooks:read'), async (c) => {
    const { orgId } = c.get('org');
    const { id } = c.req.param();

    const [row] = await db
      .select()
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.orgId, orgId)))
      .limit(1);

    if (!row) throw Errors.notFound('Webhook not found');
    return ok(c, formatWebhook(row));
  });

  // PATCH /webhooks/:id
  router.patch('/:id', requireScope('webhooks:write'), zv('json', UpdateWebhookSchema), async (c) => {
    const { orgId } = c.get('org');
    const { id } = c.req.param();
    const body = c.req.valid('json');

    const [existing] = await db
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.orgId, orgId)))
      .limit(1);

    if (!existing) throw Errors.notFound('Webhook not found');

    const updates: Partial<typeof webhookEndpoints.$inferInsert> = { updatedAt: new Date() };
    if (body.url !== undefined) updates.url = body.url;
    if (body.events !== undefined) updates.events = JSON.stringify(body.events);
    if (body.active !== undefined) updates.active = body.active;

    await db.update(webhookEndpoints).set(updates).where(eq(webhookEndpoints.id, id));
    const [updated] = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, id));

    return ok(c, formatWebhook(updated));
  });

  // DELETE /webhooks/:id
  router.delete('/:id', requireScope('webhooks:write'), async (c) => {
    const { orgId } = c.get('org');
    const { id } = c.req.param();

    const [existing] = await db
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.orgId, orgId)))
      .limit(1);

    if (!existing) throw Errors.notFound('Webhook not found');

    await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id));
    return new Response(null, { status: 204 });
  });

  // POST /webhooks/:id/test : send a test event
  router.post('/:id/test', requireScope('webhooks:write'), async (c) => {
    const { orgId } = c.get('org');
    const { id } = c.req.param();

    const [row] = await db
      .select()
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.orgId, orgId)))
      .limit(1);

    if (!row) throw Errors.notFound('Webhook not found');

    const payload = {
      id: `evt_${newId()}`,
      type: 'test.event',
      created_at: new Date().toISOString(),
      data: { message: 'This is a test event from UnClick' },
    };

    const body = JSON.stringify(payload);
    const signature = createHmac('sha256', row.secret)
      .update(body)
      .digest('hex');

    let statusCode = 0;
    try {
      const res = await fetch(row.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature-256': `sha256=${signature}`,
          'X-UnClick-Event': 'test.event',
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      statusCode = res.status;
    } catch {
      statusCode = 0;
    }

    const delivery: typeof webhookDeliveries.$inferInsert = {
      id: `del_${newId()}`,
      endpointId: id,
      eventType: 'test.event',
      payload: body,
      statusCode,
      attempt: 1,
      deliveredAt: statusCode >= 200 && statusCode < 300 ? new Date() : null,
      createdAt: new Date(),
    };
    await db.insert(webhookDeliveries).values(delivery);

    return ok(c, {
      delivered: statusCode >= 200 && statusCode < 300,
      status_code: statusCode,
      payload,
    });
  });

  // GET /webhooks/:id/deliveries
  router.get('/:id/deliveries', requireScope('webhooks:read'), async (c) => {
    const { orgId } = c.get('org');
    const { id } = c.req.param();

    const [endpoint] = await db
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.orgId, orgId)))
      .limit(1);

    if (!endpoint) throw Errors.notFound('Webhook not found');

    const { page, per_page } = parsePagination(c.req.query() as Record<string, string>);
    const [{ total }] = await db.select({ total: count() }).from(webhookDeliveries).where(eq(webhookDeliveries.endpointId, id));

    const rows = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.endpointId, id))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(per_page)
      .offset((page - 1) * per_page);

    return list(c, rows.map((r) => ({
      id: r.id,
      event_type: r.eventType,
      status_code: r.statusCode,
      attempt: r.attempt,
      delivered_at: r.deliveredAt?.toISOString() ?? null,
      created_at: r.createdAt.toISOString(),
    })), { total, page, per_page, has_more: page * per_page < total });
  });

  return router;
}
