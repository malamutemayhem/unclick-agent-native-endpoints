import { Hono } from 'hono';
import { zv } from '../../middleware/validate.js';
import { z } from 'zod';
import { eq, and, isNull } from 'drizzle-orm';
import { ok, Errors, newId } from '@unclick/core';
import type { Db } from '../../db/index.js';
import { linkPages, socialLinks } from '../../db/schema.js';
import type { AppVariables } from '../../middleware/types.js';
import { requireScope } from '../../middleware/auth.js';

const SUPPORTED_PLATFORMS = [
  'instagram', 'youtube', 'twitter', 'x', 'tiktok',
  'linkedin', 'github', 'facebook', 'pinterest', 'snapchat',
  'twitch', 'discord', 'spotify', 'soundcloud', 'website',
] as const;

const SocialsSchema = z.object({
  socials: z.array(z.object({
    platform: z.enum(SUPPORTED_PLATFORMS),
    url: z.string().url(),
  })).max(20),
});

async function assertPageOwnership(db: Db, pageId: string, orgId: string) {
  const [page] = await db
    .select({ id: linkPages.id })
    .from(linkPages)
    .where(and(eq(linkPages.id, pageId), eq(linkPages.orgId, orgId), isNull(linkPages.deletedAt)))
    .limit(1);
  if (!page) throw Errors.notFound('Page not found');
}

export function createSocialsRouter(db: Db) {
  const router = new Hono<{ Variables: AppVariables }>();

  // GET /pages/:page_id/socials
  router.get('/', requireScope('links:read'), async (c) => {
    const { orgId } = c.get('org');
    const pageId = c.req.param('page_id') as string;

    await assertPageOwnership(db, pageId, orgId);

    const rows = await db
      .select()
      .from(socialLinks)
      .where(eq(socialLinks.pageId, pageId))
      .orderBy(socialLinks.position);

    return ok(c, rows.map((r) => ({ id: r.id, platform: r.platform, url: r.url, position: r.position })));
  });

  // PUT /pages/:page_id/socials — replace all
  router.put('/', requireScope('links:write'), zv('json', SocialsSchema), async (c) => {
    const { orgId } = c.get('org');
    const pageId = c.req.param('page_id') as string;
    const { socials } = c.req.valid('json');

    await assertPageOwnership(db, pageId, orgId);

    // Delete existing
    await db.delete(socialLinks).where(eq(socialLinks.pageId, pageId));

    // Insert new
    if (socials.length > 0) {
      await db.insert(socialLinks).values(
        socials.map((s, i) => ({
          id: `soc_${newId()}`,
          pageId,
          platform: s.platform,
          url: s.url,
          position: i,
        })),
      );
    }

    const rows = await db
      .select()
      .from(socialLinks)
      .where(eq(socialLinks.pageId, pageId))
      .orderBy(socialLinks.position);

    return ok(c, rows.map((r) => ({ id: r.id, platform: r.platform, url: r.url, position: r.position })));
  });

  return router;
}
