import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, isNull, or, gt, desc, sql } from 'drizzle-orm';
import { ok, noContent, list, Errors, newId } from '@unclick/core';
import type { Db } from '../db/index.js';
import { pastes } from '../db/schema.js';
import type { AppVariables } from '../middleware/types.js';
import { requireScope } from '../middleware/auth.js';
import { zv } from '../middleware/validate.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function notExpired() {
  return or(isNull(pastes.expiresAt), gt(pastes.expiresAt, sql`NOW()`))!;
}

function orgPaste(orgId: string, id: string) {
  return and(eq(pastes.orgId, orgId), eq(pastes.id, id))!;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CreateSchema = z.object({
  content: z.string().min(1).max(1_000_000),
  title: z.string().max(255).optional(),
  language: z.string().max(64).optional(),
  expiry_hours: z.number().int().min(1).max(8760).default(24),
});

const ListSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export function createPasteRouter(db: Db) {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /paste/create - create a new paste
  router.post('/create', requireScope('paste:write'), zv('json', CreateSchema), async (c) => {
    const { orgId } = c.get('org');
    const { content, title, language, expiry_hours } = c.req.valid('json');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiry_hours * 60 * 60 * 1000);
    const id = `paste_${newId()}`;

    await db.insert(pastes).values({
      id,
      orgId,
      title: title ?? null,
      content,
      language: language ?? null,
      createdAt: now,
      expiresAt,
    });

    return ok(c, {
      id,
      title: title ?? null,
      language: language ?? null,
      size: content.length,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      url: `/v1/paste/${id}`,
    });
  });

  // POST /paste/list - list pastes for this org (most recent first)
  router.post('/list', requireScope('paste:read'), zv('json', ListSchema), async (c) => {
    const { orgId } = c.get('org');
    const { page, limit: perPage } = c.req.valid('json');

    const where = and(eq(pastes.orgId, orgId), notExpired())!;

    const [countRow] = await db
      .select({ n: sql`count(*)` })
      .from(pastes)
      .where(where);

    const total = Number(countRow?.n ?? 0);
    const offset = (page - 1) * perPage;

    const rows = await db
      .select()
      .from(pastes)
      .where(where)
      .orderBy(desc(pastes.createdAt))
      .limit(perPage)
      .offset(offset);

    return list(
      c,
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        language: r.language,
        size: r.content.length,
        created_at: r.createdAt.toISOString(),
        expires_at: r.expiresAt?.toISOString() ?? null,
      })),
      {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    );
  });

  // GET /paste/:id - retrieve a paste by ID
  router.get('/:id', requireScope('paste:read'), async (c) => {
    const { orgId } = c.get('org');
    const id = c.req.param('id');

    const [row] = await db
      .select()
      .from(pastes)
      .where(and(orgPaste(orgId, id), notExpired()))
      .limit(1);

    if (!row) throw Errors.notFound(`Paste "${id}" not found`);

    return ok(c, {
      id: row.id,
      title: row.title,
      content: row.content,
      language: row.language,
      size: row.content.length,
      created_at: row.createdAt.toISOString(),
      expires_at: row.expiresAt?.toISOString() ?? null,
    });
  });

  // DELETE /paste/:id - delete a paste
  router.delete('/:id', requireScope('paste:write'), async (c) => {
    const { orgId } = c.get('org');
    const id = c.req.param('id');

    const [row] = await db
      .select({ id: pastes.id })
      .from(pastes)
      .where(orgPaste(orgId, id))
      .limit(1);

    if (!row) throw Errors.notFound(`Paste "${id}" not found`);

    await db.delete(pastes).where(orgPaste(orgId, id));

    return noContent();
  });

  // POST /paste/:id/raw - get raw text only (no metadata)
  router.post('/:id/raw', requireScope('paste:read'), async (c) => {
    const { orgId } = c.get('org');
    const id = c.req.param('id');

    const [row] = await db
      .select({ content: pastes.content })
      .from(pastes)
      .where(and(orgPaste(orgId, id), notExpired()))
      .limit(1);

    if (!row) throw Errors.notFound(`Paste "${id}" not found`);

    return c.text(row.content);
  });

  return router;
}
