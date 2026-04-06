import { Hono } from 'hono';
import { zv } from '../../middleware/validate.js';
import { z } from 'zod';
import { eq, and, isNull, count } from 'drizzle-orm';
import { ok, created, list, Errors, parsePagination, newId } from '@unclick/core';
import type { Db } from '../../db/index.js';
import { schedules, scheduleOverrides } from '../../db/schema.js';
import type { AppVariables } from '../../middleware/types.js';
import { requireScope } from '../../middleware/auth.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const DaySlotSchema = z.object({
  day: z.number().int().min(0).max(6), // 0=Sun, 6=Sat
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM'),
});

const CreateScheduleSchema = z.object({
  name: z.string().min(1).max(256),
  timezone: z.string().min(1).max(100).default('UTC'),
  weekly_hours: z.array(DaySlotSchema).default([]),
  buffer_before: z.number().int().min(0).max(120).default(0),
  buffer_after: z.number().int().min(0).max(120).default(0),
  is_default: z.boolean().default(false),
});

const UpdateScheduleSchema = CreateScheduleSchema.partial();

const CreateOverrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  slots: z.array(z.object({
    start_time: z.string().regex(/^\d{2}:\d{2}$/),
    end_time: z.string().regex(/^\d{2}:\d{2}$/),
  })).nullable().default(null),
  reason: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatSchedule(row: typeof schedules.$inferSelect) {
  return {
    id: row.id,
    org_id: row.orgId,
    name: row.name,
    timezone: row.timezone,
    weekly_hours: JSON.parse(row.weeklyHours ?? '[]'),
    buffer_before: row.bufferBefore,
    buffer_after: row.bufferAfter,
    is_default: row.isDefault,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function formatOverride(row: typeof scheduleOverrides.$inferSelect) {
  return {
    id: row.id,
    schedule_id: row.scheduleId,
    date: row.date,
    slots: row.slots ? JSON.parse(row.slots) : null,
    reason: row.reason ?? null,
    created_at: row.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createSchedulesRouter(db: Db) {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /scheduling/schedules
  router.post('/', requireScope('scheduling:write'), zv('json', CreateScheduleSchema), async (c) => {
    const { orgId } = c.get('org');
    const body = c.req.valid('json');

    // If is_default is set, clear existing default for this org
    if (body.is_default) {
      await db.update(schedules)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(schedules.orgId, orgId), isNull(schedules.deletedAt)));
    }

    const now = new Date();
    const schedule: typeof schedules.$inferInsert = {
      id: `sch_${newId()}`,
      orgId,
      name: body.name,
      timezone: body.timezone,
      weeklyHours: JSON.stringify(body.weekly_hours),
      bufferBefore: body.buffer_before,
      bufferAfter: body.buffer_after,
      isDefault: body.is_default,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(schedules).values(schedule);
    const [inserted] = await db.select().from(schedules).where(eq(schedules.id, schedule.id));
    return created(c, formatSchedule(inserted));
  });

  // GET /scheduling/schedules
  router.get('/', requireScope('scheduling:read'), async (c) => {
    const { orgId } = c.get('org');
    const { page, per_page } = parsePagination(c.req.query() as Record<string, string>);

    const [{ total }] = await db
      .select({ total: count() })
      .from(schedules)
      .where(and(eq(schedules.orgId, orgId), isNull(schedules.deletedAt)));

    const rows = await db
      .select()
      .from(schedules)
      .where(and(eq(schedules.orgId, orgId), isNull(schedules.deletedAt)))
      .limit(per_page)
      .offset((page - 1) * per_page);

    return list(c, rows.map(formatSchedule), { total, page, per_page, has_more: page * per_page < total });
  });

  // GET /scheduling/schedules/:id
  router.get('/:id', requireScope('scheduling:read'), async (c) => {
    const { orgId } = c.get('org');
    const { id } = c.req.param();

    const [row] = await db
      .select()
      .from(schedules)
      .where(and(eq(schedules.id, id), eq(schedules.orgId, orgId), isNull(schedules.deletedAt)))
      .limit(1);

    if (!row) throw Errors.notFound('Schedule not found');
    return ok(c, formatSchedule(row));
  });

  // PATCH /scheduling/schedules/:id
  router.patch('/:id', requireScope('scheduling:write'), zv('json', UpdateScheduleSchema), async (c) => {
    const { orgId } = c.get('org');
    const { id } = c.req.param();
    const body = c.req.valid('json');

    const [existing] = await db
      .select()
      .from(schedules)
      .where(and(eq(schedules.id, id), eq(schedules.orgId, orgId), isNull(schedules.deletedAt)))
      .limit(1);

    if (!existing) throw Errors.notFound('Schedule not found');

    if (body.is_default) {
      await db.update(schedules)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(schedules.orgId, orgId), isNull(schedules.deletedAt)));
    }

    const updates: Partial<typeof schedules.$inferInsert> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.timezone !== undefined) updates.timezone = body.timezone;
    if (body.weekly_hours !== undefined) updates.weeklyHours = JSON.stringify(body.weekly_hours);
    if (body.buffer_before !== undefined) updates.bufferBefore = body.buffer_before;
    if (body.buffer_after !== undefined) updates.bufferAfter = body.buffer_after;
    if (body.is_default !== undefined) updates.isDefault = body.is_default;

    await db.update(schedules).set(updates).where(eq(schedules.id, id));
    const [updated] = await db.select().from(schedules).where(eq(schedules.id, id));
    return ok(c, formatSchedule(updated));
  });

  // DELETE /scheduling/schedules/:id
  router.delete('/:id', requireScope('scheduling:write'), async (c) => {
    const { orgId } = c.get('org');
    const { id } = c.req.param();

    const [existing] = await db
      .select({ id: schedules.id })
      .from(schedules)
      .where(and(eq(schedules.id, id), eq(schedules.orgId, orgId), isNull(schedules.deletedAt)))
      .limit(1);

    if (!existing) throw Errors.notFound('Schedule not found');

    await db.update(schedules)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(schedules.id, id));

    return new Response(null, { status: 204 });
  });

  // ---------------------------------------------------------------------------
  // Overrides sub-resource: /scheduling/schedules/:id/overrides
  // ---------------------------------------------------------------------------

  // POST /scheduling/schedules/:id/overrides
  router.post('/:id/overrides', requireScope('scheduling:write'), zv('json', CreateOverrideSchema), async (c) => {
    const { orgId } = c.get('org');
    const { id: scheduleId } = c.req.param();
    const body = c.req.valid('json');

    const [parent] = await db
      .select({ id: schedules.id })
      .from(schedules)
      .where(and(eq(schedules.id, scheduleId), eq(schedules.orgId, orgId), isNull(schedules.deletedAt)))
      .limit(1);

    if (!parent) throw Errors.notFound('Schedule not found');

    // Upsert: if override for this date already exists, replace it
    const existing = await db
      .select({ id: scheduleOverrides.id })
      .from(scheduleOverrides)
      .where(and(eq(scheduleOverrides.scheduleId, scheduleId), eq(scheduleOverrides.date, body.date)))
      .limit(1);

    if (existing.length > 0) {
      await db.update(scheduleOverrides)
        .set({ slots: body.slots ? JSON.stringify(body.slots) : null, reason: body.reason ?? null })
        .where(eq(scheduleOverrides.id, existing[0].id));
      const [updated] = await db.select().from(scheduleOverrides).where(eq(scheduleOverrides.id, existing[0].id));
      return ok(c, formatOverride(updated));
    }

    const override: typeof scheduleOverrides.$inferInsert = {
      id: `sco_${newId()}`,
      scheduleId,
      orgId,
      date: body.date,
      slots: body.slots ? JSON.stringify(body.slots) : null,
      reason: body.reason ?? null,
      createdAt: new Date(),
    };

    await db.insert(scheduleOverrides).values(override);
    const [inserted] = await db.select().from(scheduleOverrides).where(eq(scheduleOverrides.id, override.id));
    return created(c, formatOverride(inserted));
  });

  // GET /scheduling/schedules/:id/overrides
  router.get('/:id/overrides', requireScope('scheduling:read'), async (c) => {
    const { orgId } = c.get('org');
    const { id: scheduleId } = c.req.param();

    const [parent] = await db
      .select({ id: schedules.id })
      .from(schedules)
      .where(and(eq(schedules.id, scheduleId), eq(schedules.orgId, orgId), isNull(schedules.deletedAt)))
      .limit(1);

    if (!parent) throw Errors.notFound('Schedule not found');

    const rows = await db
      .select()
      .from(scheduleOverrides)
      .where(eq(scheduleOverrides.scheduleId, scheduleId));

    return ok(c, rows.map(formatOverride));
  });

  // DELETE /scheduling/schedules/:id/overrides/:override_id
  router.delete('/:id/overrides/:override_id', requireScope('scheduling:write'), async (c) => {
    const { orgId } = c.get('org');
    const { id: scheduleId, override_id } = c.req.param();

    const [parent] = await db
      .select({ id: schedules.id })
      .from(schedules)
      .where(and(eq(schedules.id, scheduleId), eq(schedules.orgId, orgId), isNull(schedules.deletedAt)))
      .limit(1);

    if (!parent) throw Errors.notFound('Schedule not found');

    const [existing] = await db
      .select({ id: scheduleOverrides.id })
      .from(scheduleOverrides)
      .where(and(eq(scheduleOverrides.id, override_id), eq(scheduleOverrides.scheduleId, scheduleId)))
      .limit(1);

    if (!existing) throw Errors.notFound('Override not found');

    await db.delete(scheduleOverrides).where(eq(scheduleOverrides.id, override_id));
    return new Response(null, { status: 204 });
  });

  return router;
}
