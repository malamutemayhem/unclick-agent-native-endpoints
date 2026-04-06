import { eq, and, isNull } from 'drizzle-orm';
import { Errors } from '@unclick/core';
import type { Db } from '../db/index.js';
import { linkPages, links } from '../db/schema.js';

/**
 * Asserts that a page exists and belongs to the given org.
 * Throws a 404 if the page is not found or is deleted.
 */
export async function assertPageOwnership(db: Db, pageId: string, orgId: string): Promise<void> {
  const [page] = await db
    .select({ id: linkPages.id })
    .from(linkPages)
    .where(and(eq(linkPages.id, pageId), eq(linkPages.orgId, orgId), isNull(linkPages.deletedAt)))
    .limit(1);
  if (!page) throw Errors.notFound('Page not found');
}

/**
 * Asserts that a link exists, belongs to the given page, and belongs to the given org.
 * Throws a 404 if the link is not found, is deleted, or does not belong to the page.
 */
export async function assertLinkOwnership(
  db: Db,
  linkId: string,
  pageId: string,
  orgId: string,
): Promise<void> {
  const [link] = await db
    .select({ id: links.id })
    .from(links)
    .where(
      and(
        eq(links.id, linkId),
        eq(links.pageId, pageId),
        eq(links.orgId, orgId),
        isNull(links.deletedAt),
      ),
    )
    .limit(1);
  if (!link) throw Errors.notFound('Link not found');
}
