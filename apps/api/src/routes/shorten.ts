import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { ok, created, Errors, newId } from '@unclick/core';
import type { Db } from '../db/index.js';
import { shortenedUrls } from '../db/schema.js';
import type { AppVariables } from '../middleware/types.js';
import { requireScope } from '../middleware/auth.js';
import { zv } from '../middleware/validate.js';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

const CreateShortenSchema = z.object({
  url: z.string().url('Must be a valid URL').max(2048, 'URL must be 2048 characters or fewer'),
});

export function createShortenRouter(db: Db) {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST / — shorten a URL
  router.post('/', requireScope('shorten:write'), zv('json', CreateShortenSchema), async (c) => {
    const { orgId } = c.get('org');
    const { url } = c.req.valid('json');

    // Generate a unique code (retry on collision, up to 5 attempts)
    let code = generateCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const [existing] = await db
        .select({ id: shortenedUrls.id })
        .from(shortenedUrls)
        .where(eq(shortenedUrls.code, code))
        .limit(1);
      if (!existing) break;
      if (attempt === 4) throw Errors.internal('Failed to generate unique short code');
      code = generateCode();
    }

    const id = `su_${newId()}`;
    const now = new Date();
    await db.insert(shortenedUrls).values({
      id,
      code,
      originalUrl: url,
      orgId,
      clickCount: 0,
      createdAt: now,
    });

    const proto = c.req.header('X-Forwarded-Proto') ?? 'https';
    const host = c.req.header('X-Forwarded-Host') ?? c.req.header('Host') ?? 'api.unclick.world';

    return created(c, {
      id,
      code,
      short_url: `${proto}://${host}/r/${code}`,
      original_url: url,
      created_at: now.toISOString(),
    });
  });

  // GET /:code/stats — click stats for a short URL (org-scoped)
  router.get('/:code/stats', requireScope('shorten:read'), async (c) => {
    const { orgId } = c.get('org');
    const { code } = c.req.param();

    const [row] = await db
      .select()
      .from(shortenedUrls)
      .where(and(eq(shortenedUrls.code, code), eq(shortenedUrls.orgId, orgId)))
      .limit(1);

    if (!row) throw Errors.notFound('Short URL not found');

    return ok(c, {
      id: row.id,
      code: row.code,
      original_url: row.originalUrl,
      click_count: row.clickCount,
      created_at: row.createdAt.toISOString(),
    });
  });

  return router;
}

/**
 * Public redirect router — no auth required.
 * Mounted at /r/:code so it resolves before the /v1/* auth middleware.
 */
export function createPublicShortenRouter(db: Db) {
  const router = new Hono();

  router.get('/:code', async (c) => {
    const { code } = c.req.param();

    const [row] = await db
      .select()
      .from(shortenedUrls)
      .where(eq(shortenedUrls.code, code))
      .limit(1);

    if (!row) {
      return c.json({ error: { code: 'not_found', message: 'Short URL not found' } }, 404);
    }

    // Increment click count in the background — don't block the redirect
    db.update(shortenedUrls)
      .set({ clickCount: sql`${shortenedUrls.clickCount} + 1` })
      .where(eq(shortenedUrls.id, row.id))
      .execute()
      .catch(() => {});

    return c.redirect(row.originalUrl, 302);
  });

  return router;
}
