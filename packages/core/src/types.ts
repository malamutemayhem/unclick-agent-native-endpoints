export type Plan = 'free' | 'pro' | 'team';

export interface OrgContext {
  orgId: string;
  scopes: string[];
  plan: Plan;
  keyId: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

export interface RateLimitMeta {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}

export interface ApiMeta {
  request_id: string;
  pagination?: PaginationMeta;
  rate_limit?: RateLimitMeta;
}

export interface ApiResponse<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiListResponse<T> {
  data: T[];
  meta: ApiMeta & { pagination: PaginationMeta };
}

export interface ApiErrorDetail {
  field: string;
  issue: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
  meta: { request_id: string };
}

export interface PaginationParams {
  page: number;
  per_page: number;
}

export function parsePagination(query: Record<string, string | undefined>): PaginationParams {
  const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
  const per_page = Math.min(100, Math.max(1, parseInt(query.per_page ?? '20', 10) || 20));
  return { page, per_page };
}
