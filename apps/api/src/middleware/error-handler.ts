import type { Context } from 'hono';
import { ZodError } from 'zod';
import { AppError } from '@unclick/core';
import type { ApiErrorBody } from '@unclick/core';

export function handleError(err: Error, c: Context): Response {
  const requestId = c.get('requestId') ?? 'req_unknown';

  if (err instanceof AppError) {
    const body: ApiErrorBody = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
      meta: { request_id: requestId },
    };
    return c.json(body, err.status as 400);
  }

  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      issue: e.message,
    }));
    const body: ApiErrorBody = {
      error: {
        code: 'validation_error',
        message: 'Request validation failed',
        details,
      },
      meta: { request_id: requestId },
    };
    return c.json(body, 400);
  }

  console.error('[unhandled]', err);
  const body: ApiErrorBody = {
    error: { code: 'internal_error', message: 'Internal server error' },
    meta: { request_id: requestId },
  };
  return c.json(body, 500);
}
