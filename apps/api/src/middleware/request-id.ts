import { createMiddleware } from 'hono/factory';
import { ulid } from 'ulid';
import type { AppVariables } from './types.js';

export const requestId = createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
  const id = `req_${ulid().toLowerCase()}`;
  c.set('requestId', id);
  c.header('X-Request-ID', id);
  await next();
});
