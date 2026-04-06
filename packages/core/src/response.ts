import type { Context } from 'hono';
import type { ApiMeta, ApiResponse, ApiListResponse, PaginationMeta, ApiErrorBody } from './types.js';
import { AppError } from './errors.js';

function baseMeta(c: Context): ApiMeta {
  return {
    request_id: c.get('requestId') ?? 'req_unknown',
  };
}

export function ok<T>(c: Context, data: T, status = 200): Response {
  const body: ApiResponse<T> = {
    data,
    meta: baseMeta(c),
  };
  return c.json(body, status as 200);
}

export function list<T>(
  c: Context,
  data: T[],
  pagination: PaginationMeta,
): Response {
  const body: ApiListResponse<T> = {
    data,
    meta: {
      ...baseMeta(c),
      pagination,
    },
  };
  return c.json(body, 200);
}

export function created<T>(c: Context, data: T): Response {
  return ok(c, data, 201);
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export function errorResponse(c: Context, err: unknown): Response {
  if (err instanceof AppError) {
    const body: ApiErrorBody = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
      meta: { request_id: c.get('requestId') ?? 'req_unknown' },
    };
    return c.json(body, err.status as 400);
  }

  console.error('[unhandled]', err);
  const body: ApiErrorBody = {
    error: { code: 'internal_error', message: 'Internal server error' },
    meta: { request_id: c.get('requestId') ?? 'req_unknown' },
  };
  return c.json(body, 500);
}
