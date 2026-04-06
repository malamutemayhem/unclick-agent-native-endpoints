import type { OrgContext } from '@unclick/core';

/** Variables stored on the Hono context for every request */
export interface AppVariables {
  requestId: string;
  org: OrgContext;
}
