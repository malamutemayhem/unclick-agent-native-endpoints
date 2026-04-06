import type { ApiErrorDetail } from './types.js';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly status: number,
    public readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  notFound: (msg = 'Resource not found') =>
    new AppError('not_found', msg, 404),

  unauthorized: (msg = 'Invalid or missing API key') =>
    new AppError('authentication_error', msg, 401),

  forbidden: (msg = 'Insufficient permissions') =>
    new AppError('authorization_error', msg, 403),

  validation: (msg: string, details?: ApiErrorDetail[]) =>
    new AppError('validation_error', msg, 400, details),

  conflict: (msg: string) =>
    new AppError('conflict', msg, 409),

  rateLimited: () =>
    new AppError('rate_limit_exceeded', 'Too many requests', 429),

  internal: (msg = 'Internal server error') =>
    new AppError('internal_error', msg, 500),

  unavailable: (msg = 'Service temporarily unavailable') =>
    new AppError('service_unavailable', msg, 503),
} as const;
