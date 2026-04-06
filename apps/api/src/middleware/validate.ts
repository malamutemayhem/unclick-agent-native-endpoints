import { validator } from 'hono/validator';
import type { z } from 'zod';
import { AppError } from '@unclick/core';

type Target = 'json' | 'query' | 'form';

/**
 * Hono middleware that validates the request body/query with a Zod schema.
 * Throws a 400 AppError on failure so our global error handler formats it correctly.
 */
export function zv<T extends z.ZodTypeAny>(target: Target, schema: T) {
  return validator(target, (value) => {
    const result = schema.safeParse(value);
    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        issue: e.message,
      }));
      throw new AppError('validation_error', 'Request validation failed', 400, details);
    }
    return result.data as z.infer<T>;
  });
}
