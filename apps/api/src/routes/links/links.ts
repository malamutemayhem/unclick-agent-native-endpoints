import { Hono } from 'hono';
import { zv } from '../../middleware/validate.js';
import { z } from 'zod';
import { eq, and, isNull, asc, count } from 'drizzle-orm';
import { ok, created, list, Errors, parsePagination, newId } from '@unclick/core';
import type { Db } from '../../db/index.js';
import { linkPages, links } from '../../db/schema.js';
import type { AppVariables } from '../../middleware/types.js';
import { requireScope } from '../../middleware/auth.js';

const CreateLinkSchema = z.object({
  title: z.string().min(1).max(256),
  url: z.string().url(),
  thumbnail_url: z.string().url().optional(),
  position: z.number().int().min(0).optional(),
  highlight: z.boolean().default(false),
  schedule: z.object({
    starts_at: z.string().datetime().optional(),
    ends_at: z.string().datetime().optional(),
  }).optional(),
});

const UpdateLinkSchema = CreateLinkSchema.partial();

const ReorderSchema = z.object({
  ids: z.array(z.string()).min(1),
});

const BatchSchema = z.object({
  operations: z.array(z.discriminatedUnion('action', [
    z.object({
      action: z.literal('create'),
      data: CreateLinkSchema,
    }),
    z.object({
      action: z.literal('update'),
      id: z.string(),
      data: UpdateLinkSchema,
    }),
    z.object({
      action: z.literal('delete'),
      id: z.string(),
    }),
  ])),
});

function formatLink(row: typeof links.$inferSelect) {
  return {
    id: row.id,
    page_id: row.pageId,
    title: row.title,
    url: row.url,
    thumbnail_url: row.thumbnailUrl,
    position: row.position,
    highlight: row.highlight,
    active: row.active,
    schedule: {
      starts_at: row.scheduleStart?.toISOString() ?? null,
      ends_at: row.scheduleEnd?.toISOString() ?? null,
    },
    ab_variant: row.abVariant,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

async function assertPageOwnership(db: Db, pageId: string, orgId: string) {
  const [page] = await db
    .select({ id: linkPages.id })
    .from(linkPages)
    .where(and(eq(linkPages.id, pageId), eq(linkPages.orgId, orgId), isNull(linkPages.deletedAt)))
    .limit(1);
  if (!page) throw Errors.notFound('Page not found');
  return page;
}

export function createLinksRouter(db: Db) {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /pages/:page_id/links
  router.post('/', requireScope('links:write'), zv('json', CreateLinkSchema), async (c) => {
    const { orgId } = c.get('org');
    const pageId = c.req.param('page_id') as string;

    await assertPageOwnership(db, pageId, orgId);

    // Auto-assign position if not provided
    const body = c.req.valid('json');
    let position = body.position;
    if (position === undefined) {
      const [{ total }] = await db
        .select({ total: count() })
        .from(links)
        .where(eq(links.pageId, pageId));
      position = total;
    }

    const now = new Date();
    const link: typeof links.$inferInsert = {
      id: `lnk_${newId()}`,
      pageId,
      orgId,
      title: body.title,
      url: body.url,
      thumbnailUrl: body.thumbnail_url ?? null,
      position,
      highlight: body.highlight ?? false,
      scheduleStart: body.schedule?.starts_at ? new Date(body.schedule.starts_at) : null,
      scheduleEnd: body.schedule?.ends_at ? new Date(body.schedule.ends_at) : null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(links).values(link);
    const [inserted] = await db.select().from(links).where(eq(links.id, link.id));
    return created(c, formatLink(inserted));
  });

  // GET /pages/:page_id/links
  router.get('/', requireScope('links:read'), async (c) => {
    const { orgId } = c.get('org');
    const pageId = c.req.param('page_id') as string;

    await assertPageOwnership(db, pageId, orgId);

    const { page, per_page } = parsePagination(c.req.query() as Record<string, string>);
    const [{ total }] = await db.select({ total: count() }).from(links).where(eq(links.pageId, pageId));

    const rows = await db
      .select()
      .from(links)
      .where(eq(links.pageId, pageId))
      .orderBy(asc(links.position))
      .limit(per_page)
      .offset((page - 1) * per_page);

    return list(c, rows.map(formatLink), { total, page, per_page, has_more: page * per_page < total });
  });

  // PATCH /pages/:page_id/links/:id
  router.patch('/:id', requireScope('links:write'), zv('json', UpdateLinkSchema), async (c) => {
    const { orgId } = c.get('org');
    const pageId = c.req.param('page_id') as string;
    const { id } = c.req.param();
    const body = c.req.valid('json');

    await assertPageOwnership(db, pageId, orgId);

    const [existing] = await db
      .select()
      .from(links)
      .where(and(eq(links.id, id), eq(links.pageId, pageId)))
      .limit(1);

    if (!existing) throw Errors.notFound('Link not found');

    const updates: Partial<typeof links.$inferInsert> = { updatedAt: new Date() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.url !== undefined) updates.url = body.url;
    if (body.thumbnail_url !== undefined) updates.thumbnailUrl = body.thumbnail_url ?? null;
    if (body.position !== undefined) updates.position = body.position;
    if (body.highlight !== undefined) updates.highlight = body.highlight;
    if (body.schedule !== undefined) {
      updates.scheduleStart = body.schedule.starts_at ? new Date(body.schedule.starts_at) : null;
      updates.scheduleEnd = body.schedule.ends_at ? new Date(body.schedule.ends_at) : null;
    }

    await db.update(links).set(updates).where(eq(links.id, id));
    const [updated] = await db.select().from(links).where(eq(links.id, id));
    return ok(c, formatLink(updated));
  });

  // DELETE /pages/:page_id/links/:id
  router.delete('/:id', requireScope('links:write'), async (c) => {
    const { orgId } = c.get('org');
    const pageId = c.req.param('page_id') as string;
    const { id } = c.req.param();

    await assertPageOwnership(db, pageId, orgId);

    const [existing] = await db
      .select({ id: links.id })
      .from(links)
      .where(and(eq(links.id, id), eq(links.pageId, pageId)))
      .limit(1);

    if (!existing) throw Errors.notFound('Link not found');

    await db.delete(links).where(eq(links.id, id));
    return new Response(null, { status: 204 });
  });

  // POST /pages/:page_id/links/reorder
  router.post('/reorder', requireScope('links:write'), zv('json', ReorderSchema), async (c) => {
    const { orgId } = c.get('org');
    const pageId = c.req.param('page_id') as string;
    const { ids } = c.req.valid('json');

    await assertPageOwnership(db, pageId, orgId);

    // Update positions in order
    await Promise.all(
      ids.map((linkId, index) =>
        db.update(links)
          .set({ position: index, updatedAt: new Date() })
          .where(and(eq(links.id, linkId), eq(links.pageId, pageId)))
      ),
    );

    const rows = await db
      .select()
      .from(links)
      .where(eq(links.pageId, pageId))
      .orderBy(asc(links.position));

    return ok(c, rows.map(formatLink));
  });

  // POST /pages/:page_id/links/batch
  router.post('/batch', requireScope('links:write'), zv('json', BatchSchema), async (c) => {
    const { orgId } = c.get('org');
    const pageId = c.req.param('page_id') as string;
    const { operations } = c.req.valid('json');

    await assertPageOwnership(db, pageId, orgId);

    const results: { action: string; id: string; data?: unknown }[] = [];

    for (const op of operations) {
      if (op.action === 'create') {
        const [{ total }] = await db.select({ total: count() }).from(links).where(eq(links.pageId, pageId));
        const now = new Date();
        const link: typeof links.$inferInsert = {
          id: `lnk_${newId()}`,
          pageId,
          orgId,
          title: op.data.title,
          url: op.data.url,
          thumbnailUrl: op.data.thumbnail_url ?? null,
          position: op.data.position ?? total,
          highlight: op.data.highlight ?? false,
          scheduleStart: op.data.schedule?.starts_at ? new Date(op.data.schedule.starts_at) : null,
          scheduleEnd: op.data.schedule?.ends_at ? new Date(op.data.schedule.ends_at) : null,
          createdAt: now,
          updatedAt: now,
        };
        await db.insert(links).values(link);
        const [inserted] = await db.select().from(links).where(eq(links.id, link.id));
        results.push({ action: 'create', id: link.id, data: formatLink(inserted) });

      } else if (op.action === 'update') {
        const [existing] = await db
          .select()
          .from(links)
          .where(and(eq(links.id, op.id), eq(links.pageId, pageId)))
          .limit(1);
        if (!existing) {
          results.push({ action: 'update', id: op.id, data: { error: 'not_found' } });
          continue;
        }
        const updates: Partial<typeof links.$inferInsert> = { updatedAt: new Date() };
        if (op.data.title) updates.title = op.data.title;
        if (op.data.url) updates.url = op.data.url;
        if (op.data.position !== undefined) updates.position = op.data.position;
        await db.update(links).set(updates).where(eq(links.id, op.id));
        const [updated] = await db.select().from(links).where(eq(links.id, op.id));
        results.push({ action: 'update', id: op.id, data: formatLink(updated) });

      } else if (op.action === 'delete') {
        await db.delete(links).where(and(eq(links.id, op.id), eq(links.pageId, pageId)));
        results.push({ action: 'delete', id: op.id });
      }
    }

    return ok(c, results);
  });

  return router;
}
