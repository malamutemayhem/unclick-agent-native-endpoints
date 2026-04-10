import { createMiddleware } from 'hono/factory';
import { eq, isNull } from 'drizzle-orm';
import { hashKey, Errors } from '@unclick/core';
import type { Db } from '../db/index.js';
import { apiKeys, orgs } from '../db/schema.js';
import type { AppVariables } from './types.js';
import type { Plan } from '@unclick/core';

/**
 * Create the auth middleware. Pass the db instance via closure.
 * Validates Bearer token API keys against the database.
 */
export function createAuthMiddleware(db: Db) {
  return createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw Errors.unauthorized('Missing Authorization: Bearer <key> header');
    }

    const rawKey = authHeader.slice(7).trim();
    if (!rawKey) throw Errors.unauthorized();

    const hash = hashKey(rawKey);

    const [row] = await db
      .select({
        keyId: apiKeys.id,
        orgId: apiKeys.orgId,
        scopes: apiKeys.scopes,
        revokedAt: apiKeys.revokedAt,
        expiresAt: apiKeys.expiresAt,
        orgPlan: orgs.plan,
      })
      .from(apiKeys)
      .innerJoin(orgs, eq(apiKeys.orgId, orgs.id))
      .where(eq(apiKeys.keyHash, hash))
      .limit(1);

    if (!row) throw Errors.unauthorized('Invalid API key');
    if (row.revokedAt) throw Errors.unauthorized('API key has been revoked');
    if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
      throw Errors.unauthorized('API key has expired');
    }

    // Parse scopes (stored as JSON string)
    let scopes: string[] = [];
    try {
      scopes = JSON.parse(row.scopes ?? '[]');
    } catch {
      scopes = [];
    }

    c.set('org', {
      orgId: row.orgId,
      scopes,
      plan: (row.orgPlan ?? 'free') as Plan,
      keyId: row.keyId,
      // keyHash is the SHA-256 of the raw key; used to namespace KV data per
      // API key so multiple keys in the same org cannot access each other's data.
      keyHash: hash,
    });

    // Update last_used_at in the background (fire-and-forget)
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, row.keyId))
      .execute()
      .catch(() => {}); // non-critical

    await next();
  });
}

/**
 * Scope guard middleware. Use after auth middleware.
 * requireScope('links:write') ensures the key has that scope,
 * or passes through if the key has no scope restrictions (empty = all).
 */
export function requireScope(scope: string) {
  return createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    const org = c.get('org');
    const { scopes } = org;
    // Empty scopes array = unrestricted key
    if (scopes.length === 0 || scopes.includes(scope)) {
      await next();
    } else {
      throw Errors.forbidden(`This key requires the '${scope}' scope`);
    }
  });
}
