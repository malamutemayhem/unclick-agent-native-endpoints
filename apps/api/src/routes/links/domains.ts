import { Hono } from 'hono';
import { zv } from '../../middleware/validate.js';
import { z } from 'zod';
import { eq, and, isNull } from 'drizzle-orm';
import { ok, Errors } from '@unclick/core';
import type { Db } from '../../db/index.js';
import { linkPages } from '../../db/schema.js';
import type { AppVariables } from '../../middleware/types.js';
import { requireScope } from '../../middleware/auth.js';

const DomainSchema = z.object({
  domain: z.string().min(3).max(253),
});

async function assertPageOwnership(db: Db, pageId: string, orgId: string) {
  const [page] = await db
    .select()
    .from(linkPages)
    .where(and(eq(linkPages.id, pageId), eq(linkPages.orgId, orgId), isNull(linkPages.deletedAt)))
    .limit(1);
  if (!page) throw Errors.notFound('Page not found');
  return page;
}

export function createDomainsRouter(db: Db) {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /pages/:page_id/domain
  router.post('/', requireScope('links:write'), zv('json', DomainSchema), async (c) => {
    const { orgId } = c.get('org');
    const pageId = c.req.param('page_id') as string;
    const { domain } = c.req.valid('json');

    await assertPageOwnership(db, pageId, orgId);

    await db
      .update(linkPages)
      .set({ customDomain: domain, domainVerified: false, updatedAt: new Date() })
      .where(eq(linkPages.id, pageId));

    return ok(c, {
      domain,
      verified: false,
      instructions: {
        type: 'CNAME',
        name: domain,
        value: 'links.unclick.world',
        ttl: 3600,
      },
    });
  });

  // DELETE /pages/:page_id/domain
  router.delete('/', requireScope('links:write'), async (c) => {
    const { orgId } = c.get('org');
    const pageId = c.req.param('page_id') as string;

    await assertPageOwnership(db, pageId, orgId);

    await db
      .update(linkPages)
      .set({ customDomain: null, domainVerified: false, updatedAt: new Date() })
      .where(eq(linkPages.id, pageId));

    return new Response(null, { status: 204 });
  });

  // GET /pages/:page_id/domain/verify
  router.get('/verify', requireScope('links:read'), async (c) => {
    const { orgId } = c.get('org');
    const pageId = c.req.param('page_id') as string;

    const page = await assertPageOwnership(db, pageId, orgId);

    if (!page.customDomain) {
      throw Errors.notFound('No custom domain configured for this page');
    }

    // In production, this would do a real DNS lookup.
    // For now, simulate verification status.
    const verified = page.domainVerified;

    return ok(c, {
      domain: page.customDomain,
      verified,
      status: verified ? 'active' : 'pending',
      instructions: verified ? null : {
        type: 'CNAME',
        name: page.customDomain,
        value: 'links.unclick.world',
        ttl: 3600,
      },
    });
  });

  return router;
}
