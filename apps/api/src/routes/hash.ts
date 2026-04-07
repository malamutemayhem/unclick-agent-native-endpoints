import { Hono } from 'hono';
import { createHmac, createHash } from 'node:crypto';
import { z } from 'zod';
import { ok, Errors } from '@unclick/core';
import { zv } from '../middleware/validate.js';
import { requireScope } from '../middleware/auth.js';
import type { AppVariables } from '../middleware/types.js';

const ALGORITHMS = ['md5', 'sha1', 'sha256', 'sha512'] as const;
type Algorithm = (typeof ALGORITHMS)[number];

const HashSchema = z.object({
  text: z.string().min(1).max(1_000_000),
  algorithm: z.enum(ALGORITHMS).default('sha256'),
});

const VerifySchema = z.object({
  text: z.string().min(1).max(1_000_000),
  hash: z.string().min(1),
  algorithm: z.enum(ALGORITHMS).default('sha256'),
});

const HmacSchema = z.object({
  text: z.string().min(1).max(1_000_000),
  key: z.string().min(1),
  algorithm: z.enum(ALGORITHMS).default('sha256'),
});

function computeHash(text: string, algorithm: Algorithm): string {
  return createHash(algorithm).update(text, 'utf8').digest('hex');
}

export function createHashRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /hash - compute a hash
  router.post('/', requireScope('hash:use'), zv('json', HashSchema), (c) => {
    const { text, algorithm } = c.req.valid('json');
    const hash = computeHash(text, algorithm);
    return ok(c, { algorithm, hash, length: hash.length });
  });

  // POST /hash/verify - check text against a hash
  router.post('/verify', requireScope('hash:use'), zv('json', VerifySchema), (c) => {
    const { text, hash, algorithm } = c.req.valid('json');
    const computed = computeHash(text, algorithm);
    // Constant-time comparison to avoid timing attacks
    const match =
      computed.length === hash.length &&
      Buffer.from(computed).equals(Buffer.from(hash.toLowerCase()));
    return ok(c, { match, algorithm });
  });

  // POST /hash/hmac - compute an HMAC
  router.post('/hmac', requireScope('hash:use'), zv('json', HmacSchema), (c) => {
    const { text, key, algorithm } = c.req.valid('json');
    try {
      const hmac = createHmac(algorithm, key).update(text, 'utf8').digest('hex');
      return ok(c, { algorithm, hmac, length: hmac.length });
    } catch {
      throw Errors.validation('Failed to compute HMAC - check the key and algorithm');
    }
  });

  return router;
}
