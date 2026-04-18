/**
 * UnClick UUID - stateless UUID utility.
 *
 * All endpoints sit under /v1/* and inherit the global auth + rate-limit
 * middleware; no database access is needed.
 *
 * Scope: uuid:use
 *
 *   POST /v1/uuid/v4        - generate one or more UUIDv4s
 *   POST /v1/uuid/validate  - check if a string is a valid UUID, return version
 *   POST /v1/uuid/parse     - parse UUID into its RFC 4122 components
 */
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ok, Errors } from '@unclick/core';
import { zv } from '../middleware/validate.js';
import { requireScope } from '../middleware/auth.js';
import type { AppVariables } from '../middleware/types.js';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const GenerateSchema = z.object({
  count: z.number().int().min(1).max(100).default(1),
});

const ValidateSchema = z.object({
  uuid: z.string().max(128),
});

const ParseSchema = z.object({
  uuid: z.string().max(128),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Matches UUID versions 1-5 in standard 8-4-4-4-12 format.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-([1-5])[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function detectUuidVersion(uuid: string): number | null {
  const m = uuid.match(UUID_RE);
  return m ? parseInt(m[1]!, 10) : null;
}

function parseUuid(uuid: string) {
  // Strip hyphens and work on the raw 32 hex chars.
  const hex = uuid.replace(/-/g, '').toLowerCase();
  if (hex.length !== 32) return null;

  // RFC 4122 field layout (big-endian):
  //   time_low        [0..7]    4 bytes
  //   time_mid        [8..11]   2 bytes
  //   time_hi_version [12..15]  2 bytes
  //   clock_seq_hi    [16..17]  1 byte
  //   clock_seq_low   [18..19]  1 byte
  //   node            [20..31]  6 bytes
  const time_low = hex.slice(0, 8);
  const time_mid = hex.slice(8, 12);
  const time_hi = hex.slice(12, 16);
  const clock_seq_hi = hex.slice(16, 18);
  const clock_seq_low = hex.slice(18, 20);
  const node = hex.slice(20, 32);
  const version = parseInt(time_hi[0]!, 16);
  const variant_bits = (parseInt(clock_seq_hi, 16) >> 6) & 0x3;
  const variant =
    variant_bits === 0b10 ? 'RFC 4122'
    : variant_bits === 0b11 ? 'Microsoft'
    : 'NCS / reserved';

  return { time_low, time_mid, time_hi, clock_seq_hi, clock_seq_low, node, version, variant };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createUuidRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /uuid/v4 - generate UUIDv4(s)
  router.post('/v4', requireScope('uuid:use'), zv('json', GenerateSchema), (c) => {
    const { count } = c.req.valid('json');
    const uuids = Array.from({ length: count }, () => randomUUID());
    return ok(c, { count, uuids: count === 1 ? undefined : uuids, uuid: count === 1 ? uuids[0] : undefined });
  });

  // POST /uuid/validate - check if a string is a valid UUID
  router.post('/validate', requireScope('uuid:use'), zv('json', ValidateSchema), (c) => {
    const { uuid } = c.req.valid('json');
    const version = detectUuidVersion(uuid);
    return ok(c, {
      input: uuid,
      valid: version !== null,
      version,
    });
  });

  // POST /uuid/parse - parse UUID into RFC 4122 components
  router.post('/parse', requireScope('uuid:use'), zv('json', ParseSchema), (c) => {
    const { uuid } = c.req.valid('json');
    const parts = parseUuid(uuid.trim());
    if (!parts) {
      throw Errors.validation('Input is not a valid UUID - expected 32 hex digits in 8-4-4-4-12 format');
    }
    return ok(c, { input: uuid, ...parts });
  });

  return router;
}
