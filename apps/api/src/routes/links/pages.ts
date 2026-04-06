import { Hono } from 'hono';
import { zv } from '../../middleware/validate.js';
import { z } from 'zod';
import { eq, and, isNull, desc, count } from 'drizzle-orm';
import { ok, created, list, Errors, parsePagination } from '@unclick/core';
import { newId } from '@unclick/core';
import type { Db } from '../../db/index.js';
import { linkPages, links } from '../../db/schema.js';
import type { AppVariables } from '../../middleware/types.js';
import { requireScope } from '../../middleware/auth.js';

const CreatePageSchema = z.object({
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  title: z.string().min(1).max(128),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().url().optional(),
  theme_id: z.string().default('default'),
  seo: z.object({
    title: z.string().max(128).optional(),
    description: z.string().max(256).optional(),
    og_image_url: z.string().url().optional(),
  }).optional(),
  sensitive: z.boolean().default(false),
});

const UpdatePageSchema = CreatePageSchema.partial().omit({ slug: true }).extend({
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/).optional(),
});

function formatPage(row: typeof linkPages.$inferSelect) {
  return {
    id: row.id,
    slug: row.slug,
    url: `https://links.unclick.world/@${row.slug}`,
    title: row.title,
    bio: row.bio,
    avatar_url: row.avatarUrl,
    theme_id: row.themeId,
    theme_overrides: JSON.parse(row.themeOverrides ?? '{}'),
    seo: {
      title: row.seoTitle,
      description: row.seoDescription,
      og_image_url: row.seoOgImage,
    },
    custom_domain: row.customDomain,
    domain_verified: row.domainVerified,
    sensitive: row.sensitive,
    published_at: row.publishedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function createPagesRouter(db: Db) {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /pages — create a page
  router.post('/', requireScope('links:write'), zv('json', CreatePageSchema), async (c) => {
    const { orgId } = c.get('org');
    const body = c.req.valid('json');

    // Slug uniqueness check
    const [existing] = await db
      .select({ id: linkPages.id })
      .from(linkPages)
      .where(and(eq(linkPages.slug, body.slug), isNull(linkPages.deletedAt)))
      .limit(1);

    if (existing) throw Errors.conflict(`Slug '${body.slug}' is already taken`);

    const now = new Date();
    const page: typeof linkPages.$inferInsert = {
      id: `pg_${newId()}`,
      orgId,
      slug: body.slug,
      title: body.title,
      bio: body.bio ?? null,
      avatarUrl: body.avatar_url ?? null,
      themeId: body.theme_id ?? 'default',
      themeOverrides: '{}',
      seoTitle: body.seo?.title ?? null,
      seoDescription: body.seo?.description ?? null,
      seoOgImage: body.seo?.og_image_url ?? null,
      sensitive: body.sensitive ?? false,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(linkPages).values(page);
    const [inserted] = await db.select().from(linkPages).where(eq(linkPages.id, page.id));

    return created(c, formatPage(inserted));
  });

  // GET /pages — list pages for org
  router.get('/', requireScope('links:read'), async (c) => {
    const { orgId } = c.get('org');
    const { page, per_page } = parsePagination(c.req.query() as Record<string, string>);

    const [{ total }] = await db
      .select({ total: count() })
      .from(linkPages)
      .where(and(eq(linkPages.orgId, orgId), isNull(linkPages.deletedAt)));

    const rows = await db
      .select()
      .from(linkPages)
      .where(and(eq(linkPages.orgId, orgId), isNull(linkPages.deletedAt)))
      .orderBy(desc(linkPages.createdAt))
      .limit(per_page)
      .offset((page - 1) * per_page);

    return list(c, rows.map(formatPage), {
      total,
      page,
      per_page,
      has_more: page * per_page < total,
    });
  });

  // GET /pages/:id — get single page
  router.get('/:id', requireScope('links:read'), async (c) => {
    const { orgId } = c.get('org');
    const { id } = c.req.param();

    const [row] = await db
      .select()
      .from(linkPages)
      .where(and(eq(linkPages.id, id), eq(linkPages.orgId, orgId), isNull(linkPages.deletedAt)))
      .limit(1);

    if (!row) throw Errors.notFound('Page not found');
    return ok(c, formatPage(row));
  });

  // PATCH /pages/:id — update page
  router.patch('/:id', requireScope('links:write'), zv('json', UpdatePageSchema), async (c) => {
    const { orgId } = c.get('org');
    const { id } = c.req.param();
    const body = c.req.valid('json');

    const [existing] = await db
      .select()
      .from(linkPages)
      .where(and(eq(linkPages.id, id), eq(linkPages.orgId, orgId), isNull(linkPages.deletedAt)))
      .limit(1);

    if (!existing) throw Errors.notFound('Page not found');

    // Check slug uniqueness if slug is changing
    if (body.slug && body.slug !== existing.slug) {
      const [slugTaken] = await db
        .select({ id: linkPages.id })
        .from(linkPages)
        .where(and(eq(linkPages.slug, body.slug), isNull(linkPages.deletedAt)))
        .limit(1);
      if (slugTaken) throw Errors.conflict(`Slug '${body.slug}' is already taken`);
    }

    const updates: Partial<typeof linkPages.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.slug !== undefined) updates.slug = body.slug;
    if (body.title !== undefined) updates.title = body.title;
    if (body.bio !== undefined) updates.bio = body.bio ?? null;
    if (body.avatar_url !== undefined) updates.avatarUrl = body.avatar_url ?? null;
    if (body.theme_id !== undefined) updates.themeId = body.theme_id;
    if (body.sensitive !== undefined) updates.sensitive = body.sensitive;
    if (body.seo) {
      if (body.seo.title !== undefined) updates.seoTitle = body.seo.title ?? null;
      if (body.seo.description !== undefined) updates.seoDescription = body.seo.description ?? null;
      if (body.seo.og_image_url !== undefined) updates.seoOgImage = body.seo.og_image_url ?? null;
    }

    await db.update(linkPages).set(updates).where(eq(linkPages.id, id));
    const [updated] = await db.select().from(linkPages).where(eq(linkPages.id, id));

    return ok(c, formatPage(updated));
  });

  // DELETE /pages/:id — soft delete
  router.delete('/:id', requireScope('links:write'), async (c) => {
    const { orgId } = c.get('org');
    const { id } = c.req.param();

    const [existing] = await db
      .select({ id: linkPages.id })
      .from(linkPages)
      .where(and(eq(linkPages.id, id), eq(linkPages.orgId, orgId), isNull(linkPages.deletedAt)))
      .limit(1);

    if (!existing) throw Errors.notFound('Page not found');

    await db
      .update(linkPages)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(linkPages.id, id));

    return new Response(null, { status: 204 });
  });

  // POST /pages/:id/publish
  router.post('/:id/publish', requireScope('links:write'), async (c) => {
    const { orgId } = c.get('org');
    const { id } = c.req.param();

    const [existing] = await db
      .select()
      .from(linkPages)
      .where(and(eq(linkPages.id, id), eq(linkPages.orgId, orgId), isNull(linkPages.deletedAt)))
      .limit(1);

    if (!existing) throw Errors.notFound('Page not found');

    const now = new Date();
    await db.update(linkPages).set({ publishedAt: now, updatedAt: now }).where(eq(linkPages.id, id));
    const [updated] = await db.select().from(linkPages).where(eq(linkPages.id, id));

    return ok(c, formatPage(updated));
  });

  // POST /pages/:id/duplicate
  router.post('/:id/duplicate', requireScope('links:write'), async (c) => {
    const { orgId } = c.get('org');
    const { id } = c.req.param();

    const [original] = await db
      .select()
      .from(linkPages)
      .where(and(eq(linkPages.id, id), eq(linkPages.orgId, orgId), isNull(linkPages.deletedAt)))
      .limit(1);

    if (!original) throw Errors.notFound('Page not found');

    const originalLinks = await db
      .select()
      .from(links)
      .where(eq(links.pageId, id));

    const now = new Date();
    const newPageId = `pg_${newId()}`;
    const newSlug = `${original.slug}-copy-${Date.now()}`;

    await db.insert(linkPages).values({
      ...original,
      id: newPageId,
      slug: newSlug,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    if (originalLinks.length > 0) {
      await db.insert(links).values(
        originalLinks.map((l) => ({
          ...l,
          id: `lnk_${newId()}`,
          pageId: newPageId,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }

    const [newPage] = await db.select().from(linkPages).where(eq(linkPages.id, newPageId));
    return created(c, formatPage(newPage));
  });

  return router;
}
