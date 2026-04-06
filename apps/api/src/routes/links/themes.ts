import { Hono } from 'hono';
import { zv } from '../../middleware/validate.js';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { ok, Errors } from '@unclick/core';
import type { Db } from '../../db/index.js';
import { themes, linkPages } from '../../db/schema.js';
import type { AppVariables } from '../../middleware/types.js';
import { requireScope } from '../../middleware/auth.js';
import { assertPageOwnership } from '../../lib/ownership.js';

const ThemeOverrideSchema = z.object({
  base_theme: z.string().optional(),
  overrides: z.object({
    background_color: z.string().optional(),
    text_color: z.string().optional(),
    button_color: z.string().optional(),
    button_text_color: z.string().optional(),
    button_style: z.enum(['rounded', 'pill', 'sharp']).optional(),
    font_family: z.string().optional(),
    custom_css: z.string().max(4096).optional(),
  }).optional(),
});

export function createThemesRouter(db: Db) {
  const router = new Hono<{ Variables: AppVariables }>();

  // GET /themes
  router.get('/', async (c) => {
    const rows = await db.select().from(themes);
    return ok(c, rows.map((t) => ({
      id: t.id,
      name: t.name,
      preview_url: t.previewUrl,
      config: JSON.parse(t.config ?? '{}'),
      is_premium: t.isPremium,
    })));
  });

  // GET /themes/:id
  router.get('/:id', async (c) => {
    const { id } = c.req.param();
    const [row] = await db.select().from(themes).where(eq(themes.id, id)).limit(1);
    if (!row) throw Errors.notFound('Theme not found');
    return ok(c, {
      id: row.id,
      name: row.name,
      preview_url: row.previewUrl,
      config: JSON.parse(row.config ?? '{}'),
      is_premium: row.isPremium,
    });
  });

  // POST /pages/:page_id/theme : apply theme
  router.post('/', requireScope('links:write'), zv('json', z.object({ theme_id: z.string() })), async (c) => {
    const { orgId } = c.get('org');
    const pageId = c.req.param('page_id') as string;
    const { theme_id } = c.req.valid('json');

    await assertPageOwnership(db, pageId, orgId);

    const [theme] = await db.select().from(themes).where(eq(themes.id, theme_id)).limit(1);
    if (!theme) throw Errors.notFound('Theme not found');

    await db.update(linkPages).set({ themeId: theme_id, themeOverrides: '{}', updatedAt: new Date() }).where(eq(linkPages.id, pageId));
    const [updated] = await db.select().from(linkPages).where(eq(linkPages.id, pageId));

    return ok(c, {
      theme_id: updated.themeId,
      overrides: JSON.parse(updated.themeOverrides ?? '{}'),
    });
  });

  // PATCH /pages/:page_id/theme : customize theme
  router.patch('/', requireScope('links:write'), zv('json', ThemeOverrideSchema), async (c) => {
    const { orgId } = c.get('org');
    const pageId = c.req.param('page_id') as string;
    const body = c.req.valid('json');

    await assertPageOwnership(db, pageId, orgId);

    const [page] = await db.select({ themeOverrides: linkPages.themeOverrides }).from(linkPages).where(eq(linkPages.id, pageId)).limit(1);
    const existingOverrides = JSON.parse(page!.themeOverrides ?? '{}');
    const newOverrides = { ...existingOverrides, ...(body.overrides ?? {}) };

    const updates: Partial<typeof linkPages.$inferInsert> = {
      themeOverrides: JSON.stringify(newOverrides),
      updatedAt: new Date(),
    };
    if (body.base_theme) updates.themeId = body.base_theme;

    await db.update(linkPages).set(updates).where(eq(linkPages.id, pageId));
    const [updated] = await db.select().from(linkPages).where(eq(linkPages.id, pageId));

    return ok(c, {
      theme_id: updated.themeId,
      overrides: JSON.parse(updated.themeOverrides ?? '{}'),
    });
  });

  return router;
}
