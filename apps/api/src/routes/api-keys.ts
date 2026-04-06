import { Hono } from 'hono';
import { zv } from '../middleware/validate.js';
import { z } from 'zod';
import { eq, and, isNull, desc, count } from 'drizzle-orm';
import { ok, created, list, Errors, parsePagination, newId, generateApiKey } from '@unclick/core';
import type { Db } from '../db/index.js';
import { apiKeys } from '../db/schema.js';
import type { AppVariables } from '../middleware/types.js';
import { requireScope } from '../middleware/auth.js';

const CreateKeySchema = z.object({
  name: z.string().min(1).max(128),
  environment: z.enum(['live', 'test']).default('live'),
  scopes: z.array(z.string()).default([]),
  expires_at: z.string().datetime().optional(),
});

export function createApiKeysRouter(db: Db) {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /keys
  router.post('/', requireScope('keys:write'), zv('json', CreateKeySchema), async (c) => {
    const { orgId } = c.get('org');
    const body = c.req.valid('json');

    const generated = generateApiKey(body.environment);
    const now = new Date();

    const key: typeof apiKeys.$inferInsert = {
      id: `key_${newId()}`,
      orgId,
      name: body.name,
      keyHash: generated.hash,
      keyPrefix: generated.prefix,
      scopes: JSON.stringify(body.scopes),
      environment: generated.environment,
      expiresAt: body.expires_at ? new Date(body.expires_at) : null,
      createdAt: now,
    };

    await db.insert(apiKeys).values(key);

    // Return the plaintext key once — never shown again
    return created(c, {
      id: key.id,
      name: key.name,
      key: generated.key,
      key_prefix: generated.prefix,
      environment: generated.environment,
      scopes: body.scopes,
      expires_at: body.expires_at ?? null,
      created_at: now.toISOString(),
    });
  });

  // GET /keys
  router.get('/', requireScope('keys:read'), async (c) => {
    const { orgId } = c.get('org');
    const { page, per_page } = parsePagination(c.req.query() as Record<string, string>);

    const [{ total }] = await db
      .select({ total: count() })
      .from(apiKeys)
      .where(and(eq(apiKeys.orgId, orgId), isNull(apiKeys.revokedAt)));

    const rows = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        environment: apiKeys.environment,
        scopes: apiKeys.scopes,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.orgId, orgId), isNull(apiKeys.revokedAt)))
      .orderBy(desc(apiKeys.createdAt))
      .limit(per_page)
      .offset((page - 1) * per_page);

    return list(c, rows.map((r) => ({
      id: r.id,
      name: r.name,
      key_prefix: r.keyPrefix,
      environment: r.environment,
      scopes: JSON.parse(r.scopes ?? '[]'),
      last_used_at: r.lastUsedAt?.toISOString() ?? null,
      expires_at: r.expiresAt?.toISOString() ?? null,
      created_at: r.createdAt.toISOString(),
    })), { total, page, per_page, has_more: page * per_page < total });
  });

  // DELETE /keys/:id — revoke
  router.delete('/:id', requireScope('keys:write'), async (c) => {
    const { orgId, keyId } = c.get('org');
    const { id } = c.req.param();

    if (id === keyId) {
      throw Errors.conflict('Cannot revoke the key currently being used');
    }

    const [existing] = await db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.orgId, orgId), isNull(apiKeys.revokedAt)))
      .limit(1);

    if (!existing) throw Errors.notFound('API key not found');

    await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id));
    return new Response(null, { status: 204 });
  });

  return router;
}
