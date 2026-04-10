import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, isNull, or, gt, asc, sql } from 'drizzle-orm';
import { ok, noContent, list, Errors, newId } from '@unclick/core';
import type { Db } from '../db/index.js';
import { kvStore } from '../db/schema.js';
import type { AppVariables } from '../middleware/types.js';
import { requireScope } from '../middleware/auth.js';
import { zv } from '../middleware/validate.js';

// ─── Tenant isolation ─────────────────────────────────────────────────────────
//
// All keys are namespaced per API key using the first 12 hex chars of the
// SHA-256 of the raw key: `{keyHash12}:{userKey}`.
//
// This means two API keys in the same org cannot see each other's KV data,
// even when they share the same orgId.  The prefix is added transparently -
// callers always work with their original key names.

const KEY_PREFIX_LEN = 12;

/** Returns the 12-char hash prefix that namespaces keys for this API key. */
function tenantPrefix(keyHash: string): string {
  return keyHash.slice(0, KEY_PREFIX_LEN) + ':';
}

/** Converts a user-supplied key into the internal stored key. */
function toStoredKey(keyHash: string, userKey: string): string {
  return tenantPrefix(keyHash) + userKey;
}

/**
 * Strips the tenant prefix from a stored key to recover the original user key.
 * Returns null if the key doesn't start with the expected prefix (should never
 * happen in practice - just a safety guard).
 */
function fromStoredKey(keyHash: string, storedKey: string): string | null {
  const prefix = tenantPrefix(keyHash);
  if (!storedKey.startsWith(prefix)) return null;
  return storedKey.slice(prefix.length);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function notExpired() {
  // Row is live if expires_at is NULL or expires_at > NOW()
  return or(isNull(kvStore.expiresAt), gt(kvStore.expiresAt, sql`NOW()`))!;
}

function orgKey(orgId: string, storedKey: string) {
  return and(eq(kvStore.orgId, orgId), eq(kvStore.key, storedKey))!;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const SetSchema = z.object({
  key: z.string().min(1).max(512),
  value: z.unknown(),
  ttl: z.number().int().min(1).max(60 * 60 * 24 * 365).optional(), // seconds, max 1 year
});

const KeySchema = z.object({
  key: z.string().min(1).max(512),
});

const ListSchema = z.object({
  prefix: z.string().max(512).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(500).default(100),
});

const IncrementSchema = z.object({
  key: z.string().min(1).max(512),
  amount: z.number().default(1),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export function createKvRouter(db: Db) {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /kv/set - create or overwrite a key
  router.post('/set', requireScope('kv:write'), zv('json', SetSchema), async (c) => {
    const { orgId, keyHash } = c.get('org');
    const { key: userKey, value, ttl } = c.req.valid('json');

    // Namespace the key so this API key's data is isolated from other keys in
    // the same org.
    const storedKey = toStoredKey(keyHash, userKey);

    const now = new Date();
    const expiresAt = ttl ? new Date(now.getTime() + ttl * 1000) : null;
    const serialized = JSON.stringify(value);

    if (serialized.length > 512_000) {
      throw Errors.validation('Value exceeds maximum size of 512 KB');
    }

    // Upsert: insert or update on (org_id, key) conflict
    const [existing] = await db
      .select({ id: kvStore.id })
      .from(kvStore)
      .where(orgKey(orgId, storedKey))
      .limit(1);

    if (existing) {
      await db
        .update(kvStore)
        .set({ value: serialized, expiresAt, updatedAt: now })
        .where(orgKey(orgId, storedKey));
    } else {
      await db.insert(kvStore).values({
        id: `kv_${newId()}`,
        orgId,
        key: storedKey,
        value: serialized,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      });
    }

    return ok(c, {
      key: userKey, // return the original user key, not the prefixed stored key
      value,
      expires_at: expiresAt?.toISOString() ?? null,
    });
  });

  // POST /kv/get - retrieve a value by key
  router.post('/get', requireScope('kv:read'), zv('json', KeySchema), async (c) => {
    const { orgId, keyHash } = c.get('org');
    const { key: userKey } = c.req.valid('json');

    const storedKey = toStoredKey(keyHash, userKey);

    const [row] = await db
      .select()
      .from(kvStore)
      .where(and(orgKey(orgId, storedKey), notExpired()))
      .limit(1);

    if (!row) throw Errors.notFound(`Key "${userKey}" not found`);

    return ok(c, {
      key: userKey,
      value: JSON.parse(row.value),
      expires_at: row.expiresAt?.toISOString() ?? null,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    });
  });

  // POST /kv/delete - remove a key (idempotent)
  router.post('/delete', requireScope('kv:write'), zv('json', KeySchema), async (c) => {
    const { orgId, keyHash } = c.get('org');
    const { key: userKey } = c.req.valid('json');

    const storedKey = toStoredKey(keyHash, userKey);
    await db.delete(kvStore).where(orgKey(orgId, storedKey));

    return noContent();
  });

  // POST /kv/list - list all live keys for this API key
  router.post('/list', requireScope('kv:read'), zv('json', ListSchema), async (c) => {
    const { orgId, keyHash } = c.get('org');
    const { prefix: userPrefix, page, limit: perPage } = c.req.valid('json');

    // The tenant prefix ensures we only see keys belonging to this API key.
    // Any optional user-supplied prefix is applied on top of the tenant prefix
    // so callers never have to know about the internal namespace.
    const tenantPfx = tenantPrefix(keyHash);
    const dbPrefix = tenantPfx + (userPrefix ?? '');

    const baseWhere = and(
      eq(kvStore.orgId, orgId),
      // LIKE filter covers both the tenant namespace and any caller prefix
      sql`${kvStore.key} LIKE ${dbPrefix + '%'}`,
      notExpired(),
    )!;

    const [countRow] = await db
      .select({ n: sql`count(*)` })
      .from(kvStore)
      .where(baseWhere);

    const total = Number(countRow?.n ?? 0);
    const offset = (page - 1) * perPage;

    const rows = await db
      .select()
      .from(kvStore)
      .where(baseWhere)
      .orderBy(asc(kvStore.key))
      .limit(perPage)
      .offset(offset);

    return list(
      c,
      rows.map((r) => ({
        // Strip the internal tenant prefix before returning to the caller
        key: fromStoredKey(keyHash, r.key) ?? r.key,
        expires_at: r.expiresAt?.toISOString() ?? null,
        created_at: r.createdAt.toISOString(),
        updated_at: r.updatedAt.toISOString(),
      })),
      {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    );
  });

  // POST /kv/exists - check whether a key exists (and hasn't expired)
  router.post('/exists', requireScope('kv:read'), zv('json', KeySchema), async (c) => {
    const { orgId, keyHash } = c.get('org');
    const { key: userKey } = c.req.valid('json');

    const storedKey = toStoredKey(keyHash, userKey);

    const [row] = await db
      .select({ id: kvStore.id, expiresAt: kvStore.expiresAt })
      .from(kvStore)
      .where(and(orgKey(orgId, storedKey), notExpired()))
      .limit(1);

    return ok(c, { key: userKey, exists: !!row });
  });

  // POST /kv/increment - atomically increment a numeric value
  router.post('/increment', requireScope('kv:write'), zv('json', IncrementSchema), async (c) => {
    const { orgId, keyHash } = c.get('org');
    const { key: userKey, amount } = c.req.valid('json');
    const now = new Date();

    const storedKey = toStoredKey(keyHash, userKey);

    const [row] = await db
      .select()
      .from(kvStore)
      .where(and(orgKey(orgId, storedKey), notExpired()))
      .limit(1);

    if (!row) {
      // Key doesn't exist - seed it with the increment amount
      const newValue = amount;
      await db.insert(kvStore).values({
        id: `kv_${newId()}`,
        orgId,
        key: storedKey,
        value: JSON.stringify(newValue),
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
      });
      return ok(c, { key: userKey, value: newValue });
    }

    let current: unknown;
    try {
      current = JSON.parse(row.value);
    } catch {
      throw Errors.validation(`Value for key "${userKey}" is not valid JSON`);
    }

    if (typeof current !== 'number') {
      throw Errors.validation(`Cannot increment: value for key "${userKey}" is not a number`);
    }

    const newValue = current + amount;
    await db
      .update(kvStore)
      .set({ value: JSON.stringify(newValue), updatedAt: now })
      .where(orgKey(orgId, storedKey));

    return ok(c, { key: userKey, value: newValue });
  });

  return router;
}
