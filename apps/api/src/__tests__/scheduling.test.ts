import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app.js';
import { setupTestDb } from './setup.js';

let app: ReturnType<typeof createApp>;
let devKey: string;

function authHeader(key: string) {
  return { Authorization: `Bearer ${key}` };
}

async function json<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

beforeAll(async () => {
  devKey = await setupTestDb();
  app = createApp();
});

// ---------------------------------------------------------------------------
// Schedules CRUD
// ---------------------------------------------------------------------------

describe('Schedules CRUD', () => {
  let scheduleId: string;

  it('creates a schedule', async () => {
    const res = await app.request('/v1/scheduling/schedules', {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Business Hours',
        timezone: 'Australia/Melbourne',
        weekly_hours: [
          { day: 1, start_time: '09:00', end_time: '17:00' },
          { day: 2, start_time: '09:00', end_time: '17:00' },
          { day: 3, start_time: '09:00', end_time: '17:00' },
          { day: 4, start_time: '09:00', end_time: '17:00' },
          { day: 5, start_time: '09:00', end_time: '17:00' },
        ],
        buffer_before: 10,
        buffer_after: 5,
        is_default: true,
      }),
    });
    expect(res.status).toBe(201);
    const body = await json<{ data: { id: string; name: string; is_default: boolean } }>(res);
    expect(body.data.name).toBe('Business Hours');
    expect(body.data.is_default).toBe(true);
    scheduleId = body.data.id;
  });

  it('lists schedules', async () => {
    const res = await app.request('/v1/scheduling/schedules', {
      headers: authHeader(devKey),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: unknown[] }>(res);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('gets a schedule by id', async () => {
    const res = await app.request(`/v1/scheduling/schedules/${scheduleId}`, {
      headers: authHeader(devKey),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { id: string; timezone: string } }>(res);
    expect(body.data.id).toBe(scheduleId);
    expect(body.data.timezone).toBe('Australia/Melbourne');
  });

  it('updates a schedule', async () => {
    const res = await app.request(`/v1/scheduling/schedules/${scheduleId}`, {
      method: 'PATCH',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ buffer_before: 15 }),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { buffer_before: number } }>(res);
    expect(body.data.buffer_before).toBe(15);
  });

  it('creates an override for a date', async () => {
    const res = await app.request(`/v1/scheduling/schedules/${scheduleId}/overrides`, {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-12-25',
        slots: null, // day off
        reason: 'Christmas',
      }),
    });
    expect(res.status).toBe(201);
    const body = await json<{ data: { date: string; slots: null; reason: string } }>(res);
    expect(body.data.date).toBe('2026-12-25');
    expect(body.data.slots).toBeNull();
    expect(body.data.reason).toBe('Christmas');
  });

  it('lists overrides for a schedule', async () => {
    const res = await app.request(`/v1/scheduling/schedules/${scheduleId}/overrides`, {
      headers: authHeader(devKey),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: unknown[] }>(res);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('returns 404 for unknown schedule', async () => {
    const res = await app.request('/v1/scheduling/schedules/sch_does_not_exist', {
      headers: authHeader(devKey),
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Event types CRUD
// ---------------------------------------------------------------------------

describe('Event Types CRUD', () => {
  let eventTypeId: string;
  let questionId: string;

  it('creates an event type', async () => {
    const res = await app.request('/v1/scheduling/event-types', {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '30 Minute Call',
        slug: '30min-call',
        description: 'A quick 30-minute intro call.',
        duration: 30,
        location: 'Zoom',
        color: '#E2B93B',
        booking_window_days: 30,
        min_notice_minutes: 60,
      }),
    });
    expect(res.status).toBe(201);
    const body = await json<{ data: { id: string; slug: string; duration: number } }>(res);
    expect(body.data.slug).toBe('30min-call');
    expect(body.data.duration).toBe(30);
    eventTypeId = body.data.id;
  });

  it('rejects duplicate slug within same org', async () => {
    const res = await app.request('/v1/scheduling/event-types', {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Another 30 Min',
        slug: '30min-call',
        duration: 30,
      }),
    });
    // Should be 409 or 500 from unique constraint
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('lists event types', async () => {
    const res = await app.request('/v1/scheduling/event-types', {
      headers: authHeader(devKey),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: unknown[] }>(res);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('updates an event type', async () => {
    const res = await app.request(`/v1/scheduling/event-types/${eventTypeId}`, {
      method: 'PATCH',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Updated description' }),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { description: string } }>(res);
    expect(body.data.description).toBe('Updated description');
  });

  it('adds a question to the event type', async () => {
    const res = await app.request(`/v1/scheduling/event-types/${eventTypeId}/questions`, {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: 'What do you want to discuss?',
        field_type: 'textarea',
        required: true,
      }),
    });
    expect(res.status).toBe(201);
    const body = await json<{ data: { id: string; label: string; required: boolean } }>(res);
    expect(body.data.required).toBe(true);
    questionId = body.data.id;
  });

  it('lists questions for event type', async () => {
    const res = await app.request(`/v1/scheduling/event-types/${eventTypeId}/questions`, {
      headers: authHeader(devKey),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: unknown[] }>(res);
    expect(body.data.length).toBe(1);
  });

  it('updates a question', async () => {
    const res = await app.request(`/v1/scheduling/event-types/${eventTypeId}/questions/${questionId}`, {
      method: 'PATCH',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ required: false }),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { required: boolean } }>(res);
    expect(body.data.required).toBe(false);
  });

  it('deletes a question', async () => {
    const res = await app.request(`/v1/scheduling/event-types/${eventTypeId}/questions/${questionId}`, {
      method: 'DELETE',
      headers: authHeader(devKey),
    });
    expect(res.status).toBe(204);
  });

  it('soft-deletes an event type', async () => {
    // Create a disposable one
    const createRes = await app.request('/v1/scheduling/event-types', {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Disposable', slug: 'disposable', duration: 15 }),
    });
    const { data: { id } } = await json<{ data: { id: string } }>(createRes);

    const delRes = await app.request(`/v1/scheduling/event-types/${id}`, {
      method: 'DELETE',
      headers: authHeader(devKey),
    });
    expect(delRes.status).toBe(204);

    // Should no longer appear in list or GET
    const getRes = await app.request(`/v1/scheduling/event-types/${id}`, {
      headers: authHeader(devKey),
    });
    expect(getRes.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Public slot availability
// ---------------------------------------------------------------------------

describe('Public slot availability', () => {
  let publicEventTypeId: string;

  beforeAll(async () => {
    // Create a schedule with Mon-Fri 9-17
    const schedRes = await app.request('/v1/scheduling/schedules', {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Slots Test Schedule',
        timezone: 'UTC',
        weekly_hours: [
          { day: 1, start_time: '09:00', end_time: '17:00' },
          { day: 2, start_time: '09:00', end_time: '17:00' },
          { day: 3, start_time: '09:00', end_time: '17:00' },
          { day: 4, start_time: '09:00', end_time: '17:00' },
          { day: 5, start_time: '09:00', end_time: '17:00' },
        ],
        is_default: false,
      }),
    });
    const { data: sched } = await json<{ data: { id: string } }>(schedRes);

    const etRes = await app.request('/v1/scheduling/event-types', {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Slots Test Event',
        slug: 'slots-test',
        duration: 30,
        schedule_id: sched.id,
        booking_window_days: 90,
        min_notice_minutes: 0,
      }),
    });
    const { data: et } = await json<{ data: { id: string } }>(etRes);
    publicEventTypeId = et.id;
  });

  it('returns available slots for a date range', async () => {
    // Use a Monday in the future
    const monday = getNextMonday();
    const res = await app.request(
      `/v1/schedule/${publicEventTypeId}/slots?start_date=${monday}&end_date=${monday}`,
    );
    expect(res.status).toBe(200);
    const body = await json<{ data: Array<{ start: string; end: string }> }>(res);
    // 9:00-17:00 with 30-min slots = 16 slots
    expect(body.data.length).toBe(16);
    expect(body.data[0].start).toContain('T09:00:00');
  });

  it('requires start_date and end_date', async () => {
    const res = await app.request(`/v1/schedule/${publicEventTypeId}/slots`);
    expect(res.status).toBe(400);
  });

  it('rejects date range > 60 days', async () => {
    const res = await app.request(
      `/v1/schedule/${publicEventTypeId}/slots?start_date=2026-01-01&end_date=2026-04-01`,
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown event type', async () => {
    const monday = getNextMonday();
    const res = await app.request(`/v1/schedule/evt_unknown/slots?start_date=${monday}&end_date=${monday}`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Booking flow
// ---------------------------------------------------------------------------

describe('Booking flow', () => {
  let bookingEventTypeId: string;
  let cancelToken: string;
  let bookingId: string;

  beforeAll(async () => {
    // Create a fresh schedule + event type for booking tests
    const schedRes = await app.request('/v1/scheduling/schedules', {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Booking Test Schedule',
        timezone: 'UTC',
        weekly_hours: [
          { day: 0, start_time: '00:00', end_time: '23:30' }, // Sunday open all day
          { day: 1, start_time: '00:00', end_time: '23:30' },
          { day: 2, start_time: '00:00', end_time: '23:30' },
          { day: 3, start_time: '00:00', end_time: '23:30' },
          { day: 4, start_time: '00:00', end_time: '23:30' },
          { day: 5, start_time: '00:00', end_time: '23:30' },
          { day: 6, start_time: '00:00', end_time: '23:30' },
        ],
        is_default: false,
      }),
    });
    const { data: sched } = await json<{ data: { id: string } }>(schedRes);

    const etRes = await app.request('/v1/scheduling/event-types', {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Booking Test Event',
        slug: `booking-test-${Date.now()}`,
        duration: 30,
        schedule_id: sched.id,
        booking_window_days: 365,
        min_notice_minutes: 0,
      }),
    });
    const { data: et } = await json<{ data: { id: string } }>(etRes);
    bookingEventTypeId = et.id;
  });

  it('creates a booking', async () => {
    const startTime = getFutureSlot();
    const res = await app.request(`/v1/schedule/${bookingEventTypeId}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_time: startTime,
        attendee_name: 'Alice Agent',
        attendee_email: 'alice@example.com',
        attendee_timezone: 'UTC',
        notes: 'Looking forward to it.',
      }),
    });
    expect(res.status).toBe(201);
    const body = await json<{
      data: { id: string; status: string; cancel_token: string; start_time: string }
    }>(res);
    expect(body.data.status).toBe('confirmed');
    expect(body.data.cancel_token).toBeTruthy();
    cancelToken = body.data.cancel_token;
    bookingId = body.data.id;
  });

  it('rejects a double-booking on the same slot', async () => {
    const startTime = getFutureSlot(bookingId); // same slot
    // Re-fetch the booking to get its start_time
    const getRes = await app.request(`/v1/scheduling/bookings/${bookingId}`, {
      headers: authHeader(devKey),
    });
    const { data: booking } = await json<{ data: { start_time: string } }>(getRes);

    const res = await app.request(`/v1/schedule/${bookingEventTypeId}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_time: booking.start_time,
        attendee_name: 'Bob Agent',
        attendee_email: 'bob@example.com',
        attendee_timezone: 'UTC',
      }),
    });
    expect(res.status).toBe(409);
    const body = await json<{ error: { code: string } }>(res);
    expect(body.error.code).toBe('slot_taken');
  });

  it('lists bookings (auth)', async () => {
    const res = await app.request('/v1/scheduling/bookings', {
      headers: authHeader(devKey),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: unknown[] }>(res);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('gets a booking by id (auth)', async () => {
    const res = await app.request(`/v1/scheduling/bookings/${bookingId}`, {
      headers: authHeader(devKey),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { id: string; attendee_name: string } }>(res);
    expect(body.data.attendee_name).toBe('Alice Agent');
  });

  it('cancels a booking via cancel token (public)', async () => {
    const res = await app.request(`/v1/schedule/cancel/${cancelToken}`, {
      method: 'POST',
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { status: string; cancelled_at: string } }>(res);
    expect(body.data.status).toBe('cancelled');
    expect(body.data.cancelled_at).toBeTruthy();
  });

  it('rejects cancelling an already-cancelled booking', async () => {
    const res = await app.request(`/v1/schedule/cancel/${cancelToken}`, {
      method: 'POST',
    });
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// Reschedule flow
// ---------------------------------------------------------------------------

describe('Reschedule flow', () => {
  let bookingEventTypeId: string;
  let cancelToken: string;
  let bookingId: string;

  beforeAll(async () => {
    const schedRes = await app.request('/v1/scheduling/schedules', {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Reschedule Test Schedule',
        timezone: 'UTC',
        weekly_hours: [
          { day: 0, start_time: '00:00', end_time: '23:30' },
          { day: 1, start_time: '00:00', end_time: '23:30' },
          { day: 2, start_time: '00:00', end_time: '23:30' },
          { day: 3, start_time: '00:00', end_time: '23:30' },
          { day: 4, start_time: '00:00', end_time: '23:30' },
          { day: 5, start_time: '00:00', end_time: '23:30' },
          { day: 6, start_time: '00:00', end_time: '23:30' },
        ],
        is_default: false,
      }),
    });
    const { data: sched } = await json<{ data: { id: string } }>(schedRes);

    const etRes = await app.request('/v1/scheduling/event-types', {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Reschedule Event',
        slug: `reschedule-test-${Date.now()}`,
        duration: 30,
        schedule_id: sched.id,
        booking_window_days: 365,
        min_notice_minutes: 0,
      }),
    });
    const { data: et } = await json<{ data: { id: string } }>(etRes);
    bookingEventTypeId = et.id;

    const bookRes = await app.request(`/v1/schedule/${bookingEventTypeId}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_time: getFutureSlot(),
        attendee_name: 'Charlie',
        attendee_email: 'charlie@example.com',
        attendee_timezone: 'UTC',
      }),
    });
    const { data: booking } = await json<{ data: { id: string; cancel_token: string } }>(bookRes);
    cancelToken = booking.cancel_token;
    bookingId = booking.id;
  });

  it('reschedules a booking to a new slot', async () => {
    const newSlot = getFutureSlot(undefined, 2); // different slot
    const res = await app.request(`/v1/schedule/reschedule/${cancelToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_time: newSlot }),
    });
    expect(res.status).toBe(201);
    const body = await json<{ data: { id: string; rescheduled_from_id: string; status: string } }>(res);
    expect(body.data.rescheduled_from_id).toBe(bookingId);
    expect(body.data.status).toBe('confirmed');
  });

  it('original booking is now rescheduled status', async () => {
    const res = await app.request(`/v1/scheduling/bookings/${bookingId}`, {
      headers: authHeader(devKey),
    });
    const body = await json<{ data: { status: string } }>(res);
    expect(body.data.status).toBe('rescheduled');
  });
});

// ---------------------------------------------------------------------------
// Calendar view
// ---------------------------------------------------------------------------

describe('Calendar view', () => {
  it('returns calendar agenda for a date range', async () => {
    const monday = getNextMonday();
    const res = await app.request(
      `/v1/scheduling/calendar?start_date=${monday}&end_date=${monday}`,
      { headers: authHeader(devKey) },
    );
    expect(res.status).toBe(200);
    const body = await json<{ data: unknown[] }>(res);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('returns day agenda', async () => {
    const monday = getNextMonday();
    const res = await app.request(`/v1/scheduling/calendar/day/${monday}`, {
      headers: authHeader(devKey),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { date: string; total: number } }>(res);
    expect(body.data.date).toBe(monday);
  });

  it('returns week agenda', async () => {
    const monday = getNextMonday();
    const res = await app.request(`/v1/scheduling/calendar/week/${monday}`, {
      headers: authHeader(devKey),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { week_start: string; week_end: string; total: number } }>(res);
    expect(body.data.week_start).toBeDefined();
    expect(body.data.week_end).toBeDefined();
  });

  it('requires auth on calendar endpoints', async () => {
    const monday = getNextMonday();
    const res = await app.request(
      `/v1/scheduling/calendar?start_date=${monday}&end_date=${monday}`,
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the next Monday as YYYY-MM-DD */
function getNextMonday(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const daysUntilMonday = (8 - day) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  return d.toISOString().slice(0, 10);
}

/** Returns an ISO datetime string in the future for a booking slot */
function getFutureSlot(_existingId?: string, hoursOffset = 1): string {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() + 24 + hoursOffset, 0, 0, 0);
  // Round to 30-minute boundary
  const minutes = d.getUTCMinutes();
  if (minutes < 30) d.setUTCMinutes(0);
  else d.setUTCMinutes(30);
  return d.toISOString();
}
