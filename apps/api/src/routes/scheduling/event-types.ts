import { Hono } from 'hono';
import { zv } from '../../middleware/validate.js';
import { z } from 'zod';
import { eq, and, isNull, count, asc } from 'drizzle-orm';
import { ok, created, list, Errors, parsePagination, newId } from '@unclick/core';
import type { Db } from '../../db/index.js';
import { eventTypes, eventTypeQuestions, schedules } from '../../db/schema.js';
import type { AppVariables } from '../../middleware/types.js';
import { requireScope } from '../../middleware/auth.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const CreateEventTypeSchema = z.object({
  name: z.string().min(1).max(256),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(2000).optional(),
  duration: z.number().int().min(5).max(480), // 5 min to 8 hours
  location: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#E2B93B'),
  schedule_id: z.string().optional(),
  booking_window_days: z.number().int().min(1).max(365).default(60),
  min_notice_minutes: z.number().int().min(0).max(10080).default(60), // up to 1 week
  active: z.boolean().default(true),
});

const UpdateEventTypeSchema = CreateEventTypeSchema.partial();

const CreateQuestionSchema = z.object({
  label: z.string().min(1).max(500),
  field_type: z.enum(['text', 'textarea', 'select', 'checkbox']).default('text'),
  options: z.array(z.string()).optional(),
  required: z.boolean().default(false),
  position: z.number().int().min(0).optional(),
});

const UpdateQuestionSchema = CreateQuestionSchema.partial();

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatEventType(row: typeof eventTypes.$inferSelect) {
  return {
    id: row.id,
    org_id: row.orgId,
    schedule_id: row.scheduleId ?? null,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    duration: row.duration,
    location: row.location ?? null,
    color: row.color,
    booking_window_days: row.bookingWindowDays,
    min_notice_minutes: row.minNoticeMinutes,
    active: row.active,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function formatQuestion(row: typeof eventTypeQuestions.$inferSelect) {
  return {
    id: row.id,
    event_type_id: row.eventTypeId,
    label: row.label,
    field_type: row.fieldType,
    options: row.options ? JSON.parse(row.options) : null,
    required: row.required,
    position: row.position,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function assertEventTypeOwnership(db: Db, eventTypeId: string, orgId: string) {
  const [et] = await db
    .select({ id: eventTypes.id })
    .from(eventTypes)
    .where(and(eq(eventTypes.id, eventTypeId), eq(eventTypes.orgId, orgId), isNull(eventTypes.deletedAt)))
    .limit(1);
  if (!et) throw Errors.notFound('Event type not found');
  return et;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createEventTypesRouter(db: Db) {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /scheduling/event-types
  router.post('/', requireScope('scheduling:write'), zv('json', CreateEventTypeSchema), async (c) => {
    const { orgId } = c.get('org');
    const body = c.req.valid('json');

    // Validate schedule_id belongs to this org if provided
    if (body.schedule_id) {
      const [sched] = await db
        .select({ id: schedules.id })
        .from(schedules)
        .where(and(eq(schedules.id, body.schedule_id), eq(schedules.orgId, orgId), isNull(schedules.deletedAt)))
        .limit(1);
      if (!sched) throw Errors.notFound('Schedule not found');
    }

    const now = new Date();
    const eventType: typeof eventTypes.$inferInsert = {
      id: `evt_${newId()}`,
      orgId,
      scheduleId: body.schedule_id ?? null,
      name: body.name,
      slug: body.slug,
      description: body.description ?? null,
      duration: body.duration,
      location: body.location ?? null,
      color: body.color,
      bookingWindowDays: body.booking_window_days,
      minNoticeMinutes: body.min_notice_minutes,
      active: body.active,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(eventTypes).values(eventType);
    const [inserted] = await db.select().from(eventTypes).where(eq(eventTypes.id, eventType.id));
    return created(c, formatEventType(inserted));
  });

  // GET /scheduling/event-types
  router.get('/', requireScope('scheduling:read'), async (c) => {
    const { orgId } = c.get('org');
    const { page, per_page } = parsePagination(c.req.query() as Record<string, string>);

    const [{ total }] = await db
      .select({ total: count() })
      .from(eventTypes)
      .where(and(eq(eventTypes.orgId, orgId), isNull(eventTypes.deletedAt)));

    const rows = await db
      .select()
      .from(eventTypes)
      .where(and(eq(eventTypes.orgId, orgId), isNull(eventTypes.deletedAt)))
      .limit(per_page)
      .offset((page - 1) * per_page);

    return list(c, rows.map(formatEventType), { total, page, per_page, has_more: page * per_page < total });
  });

  // GET /scheduling/event-types/:id
  router.get('/:id', requireScope('scheduling:read'), async (c) => {
    const { orgId } = c.get('org');
    const { id } = c.req.param();

    const [row] = await db
      .select()
      .from(eventTypes)
      .where(and(eq(eventTypes.id, id), eq(eventTypes.orgId, orgId), isNull(eventTypes.deletedAt)))
      .limit(1);

    if (!row) throw Errors.notFound('Event type not found');
    return ok(c, formatEventType(row));
  });

  // PATCH /scheduling/event-types/:id
  router.patch('/:id', requireScope('scheduling:write'), zv('json', UpdateEventTypeSchema), async (c) => {
    const { orgId } = c.get('org');
    const { id } = c.req.param();
    const body = c.req.valid('json');

    await assertEventTypeOwnership(db, id, orgId);

    if (body.schedule_id) {
      const [sched] = await db
        .select({ id: schedules.id })
        .from(schedules)
        .where(and(eq(schedules.id, body.schedule_id), eq(schedules.orgId, orgId), isNull(schedules.deletedAt)))
        .limit(1);
      if (!sched) throw Errors.notFound('Schedule not found');
    }

    const updates: Partial<typeof eventTypes.$inferInsert> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.slug !== undefined) updates.slug = body.slug;
    if (body.description !== undefined) updates.description = body.description ?? null;
    if (body.duration !== undefined) updates.duration = body.duration;
    if (body.location !== undefined) updates.location = body.location ?? null;
    if (body.color !== undefined) updates.color = body.color;
    if (body.schedule_id !== undefined) updates.scheduleId = body.schedule_id ?? null;
    if (body.booking_window_days !== undefined) updates.bookingWindowDays = body.booking_window_days;
    if (body.min_notice_minutes !== undefined) updates.minNoticeMinutes = body.min_notice_minutes;
    if (body.active !== undefined) updates.active = body.active;

    await db.update(eventTypes).set(updates).where(eq(eventTypes.id, id));
    const [updated] = await db.select().from(eventTypes).where(eq(eventTypes.id, id));
    return ok(c, formatEventType(updated));
  });

  // DELETE /scheduling/event-types/:id
  router.delete('/:id', requireScope('scheduling:write'), async (c) => {
    const { orgId } = c.get('org');
    const { id } = c.req.param();

    await assertEventTypeOwnership(db, id, orgId);

    await db.update(eventTypes)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eventTypes.id, id));

    return new Response(null, { status: 204 });
  });

  // ---------------------------------------------------------------------------
  // Questions sub-resource
  // ---------------------------------------------------------------------------

  // POST /scheduling/event-types/:id/questions
  router.post('/:id/questions', requireScope('scheduling:write'), zv('json', CreateQuestionSchema), async (c) => {
    const { orgId } = c.get('org');
    const { id: eventTypeId } = c.req.param();
    const body = c.req.valid('json');

    await assertEventTypeOwnership(db, eventTypeId, orgId);

    let position = body.position;
    if (position === undefined) {
      const [{ total }] = await db
        .select({ total: count() })
        .from(eventTypeQuestions)
        .where(eq(eventTypeQuestions.eventTypeId, eventTypeId));
      position = total;
    }

    const question: typeof eventTypeQuestions.$inferInsert = {
      id: `etq_${newId()}`,
      eventTypeId,
      orgId,
      label: body.label,
      fieldType: body.field_type,
      options: body.options ? JSON.stringify(body.options) : null,
      required: body.required,
      position,
    };

    await db.insert(eventTypeQuestions).values(question);
    const [inserted] = await db.select().from(eventTypeQuestions).where(eq(eventTypeQuestions.id, question.id));
    return created(c, formatQuestion(inserted));
  });

  // GET /scheduling/event-types/:id/questions
  router.get('/:id/questions', requireScope('scheduling:read'), async (c) => {
    const { orgId } = c.get('org');
    const { id: eventTypeId } = c.req.param();

    await assertEventTypeOwnership(db, eventTypeId, orgId);

    const rows = await db
      .select()
      .from(eventTypeQuestions)
      .where(eq(eventTypeQuestions.eventTypeId, eventTypeId))
      .orderBy(asc(eventTypeQuestions.position));

    return ok(c, rows.map(formatQuestion));
  });

  // PATCH /scheduling/event-types/:id/questions/:qid
  router.patch('/:id/questions/:qid', requireScope('scheduling:write'), zv('json', UpdateQuestionSchema), async (c) => {
    const { orgId } = c.get('org');
    const { id: eventTypeId, qid } = c.req.param();
    const body = c.req.valid('json');

    await assertEventTypeOwnership(db, eventTypeId, orgId);

    const [existing] = await db
      .select()
      .from(eventTypeQuestions)
      .where(and(eq(eventTypeQuestions.id, qid), eq(eventTypeQuestions.eventTypeId, eventTypeId)))
      .limit(1);

    if (!existing) throw Errors.notFound('Question not found');

    const updates: Partial<typeof eventTypeQuestions.$inferInsert> = {};
    if (body.label !== undefined) updates.label = body.label;
    if (body.field_type !== undefined) updates.fieldType = body.field_type;
    if (body.options !== undefined) updates.options = body.options ? JSON.stringify(body.options) : null;
    if (body.required !== undefined) updates.required = body.required;
    if (body.position !== undefined) updates.position = body.position;

    await db.update(eventTypeQuestions).set(updates).where(eq(eventTypeQuestions.id, qid));
    const [updated] = await db.select().from(eventTypeQuestions).where(eq(eventTypeQuestions.id, qid));
    return ok(c, formatQuestion(updated));
  });

  // DELETE /scheduling/event-types/:id/questions/:qid
  router.delete('/:id/questions/:qid', requireScope('scheduling:write'), async (c) => {
    const { orgId } = c.get('org');
    const { id: eventTypeId, qid } = c.req.param();

    await assertEventTypeOwnership(db, eventTypeId, orgId);

    const [existing] = await db
      .select({ id: eventTypeQuestions.id })
      .from(eventTypeQuestions)
      .where(and(eq(eventTypeQuestions.id, qid), eq(eventTypeQuestions.eventTypeId, eventTypeId)))
      .limit(1);

    if (!existing) throw Errors.notFound('Question not found');

    await db.delete(eventTypeQuestions).where(eq(eventTypeQuestions.id, qid));
    return new Response(null, { status: 204 });
  });

  return router;
}
