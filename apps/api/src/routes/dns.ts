import { Hono } from 'hono';
import { promises as dns } from 'node:dns';
import { z } from 'zod';
import { ok, Errors } from '@unclick/core';
import { zv } from '../middleware/validate.js';
import { requireScope } from '../middleware/auth.js';
import type { AppVariables } from '../middleware/types.js';

const RECORD_TYPES = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'SOA'] as const;
type RecordType = (typeof RECORD_TYPES)[number];

const LookupSchema = z.object({
  domain: z.string().min(1).max(253),
  type: z.enum(RECORD_TYPES).default('A'),
});

const AllSchema = z.object({
  domain: z.string().min(1).max(253),
});

async function resolveRecord(domain: string, type: RecordType): Promise<unknown> {
  switch (type) {
    case 'A':
      return dns.resolve4(domain);
    case 'AAAA':
      return dns.resolve6(domain);
    case 'MX':
      return dns.resolveMx(domain);
    case 'TXT':
      return dns.resolveTxt(domain);
    case 'CNAME':
      return dns.resolveCname(domain);
    case 'NS':
      return dns.resolveNs(domain);
    case 'SOA':
      return dns.resolveSoa(domain);
  }
}

export function createDnsRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /dns/lookup - resolve a single record type
  router.post('/lookup', requireScope('dns:use'), zv('json', LookupSchema), async (c) => {
    const { domain, type } = c.req.valid('json');
    try {
      const records = await resolveRecord(domain, type);
      return ok(c, { domain, type, records });
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOTFOUND' || code === 'ENODATA' || code === 'ESERVFAIL') {
        return ok(c, { domain, type, records: [] });
      }
      throw Errors.validation(`DNS lookup failed: ${(err as Error).message}`);
    }
  });

  // POST /dns/all - resolve all record types at once
  router.post('/all', requireScope('dns:use'), zv('json', AllSchema), async (c) => {
    const { domain } = c.req.valid('json');

    const results = await Promise.all(
      RECORD_TYPES.map(async (type) => {
        try {
          const records = await resolveRecord(domain, type);
          return [type, { records, error: null }] as const;
        } catch (err: unknown) {
          const code = (err as NodeJS.ErrnoException).code;
          const noData = code === 'ENOTFOUND' || code === 'ENODATA' || code === 'ESERVFAIL';
          return [type, { records: noData ? [] : null, error: noData ? null : (err as Error).message }] as const;
        }
      }),
    );

    const data = Object.fromEntries(results);
    return ok(c, { domain, records: data });
  });

  return router;
}
