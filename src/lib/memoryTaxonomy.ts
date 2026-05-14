export interface MemoryTaxonomyDoc {
  id: string;
  slug?: string;
  title?: string;
  category?: string | null;
  tags?: string[] | null;
  updated_at?: string | null;
}

export interface MemoryTaxonomyShelf<TDoc extends MemoryTaxonomyDoc = MemoryTaxonomyDoc> {
  id: string;
  label: string;
  count: number;
  docs: TDoc[];
  source: "category" | "tag" | "fallback";
  newestUpdatedAt: string | null;
}

const FALLBACK_SHELF = "Uncategorized";
const METADATA_TAG_PREFIXES = ["source:", "source_", "kind:", "kind_", "id:", "fact:"];

function cleanLabel(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function shelfId(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "uncategorized";
}

function isMetadataTag(tag: string): boolean {
  const lower = tag.toLowerCase();
  return METADATA_TAG_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function labelFromTags(tags: string[] | null | undefined): string | null {
  const tag = (tags ?? [])
    .map(cleanLabel)
    .find((candidate) => candidate.length > 0 && !isMetadataTag(candidate));
  return tag ?? null;
}

function compareDocs(a: MemoryTaxonomyDoc, b: MemoryTaxonomyDoc): number {
  const dateCompare = cleanLabel(b.updated_at).localeCompare(cleanLabel(a.updated_at));
  if (dateCompare !== 0) return dateCompare;
  return cleanLabel(a.title || a.slug || a.id).localeCompare(cleanLabel(b.title || b.slug || b.id));
}

export function getMemoryTaxonomyShelfLabel(doc: MemoryTaxonomyDoc): {
  label: string;
  source: MemoryTaxonomyShelf["source"];
} {
  const category = cleanLabel(doc.category);
  if (category) return { label: category, source: "category" };

  const tag = labelFromTags(doc.tags);
  if (tag) return { label: tag, source: "tag" };

  return { label: FALLBACK_SHELF, source: "fallback" };
}

export function groupMemoryTaxonomyShelves<TDoc extends MemoryTaxonomyDoc>(
  docs: TDoc[],
): Array<MemoryTaxonomyShelf<TDoc>> {
  const shelves = new Map<string, MemoryTaxonomyShelf<TDoc>>();

  for (const doc of docs) {
    const { label, source } = getMemoryTaxonomyShelfLabel(doc);
    const id = shelfId(label);
    const shelf = shelves.get(id) ?? {
      id,
      label,
      source,
      count: 0,
      docs: [],
      newestUpdatedAt: null,
    };

    shelf.docs.push(doc);
    shelf.count += 1;
    if (!shelf.newestUpdatedAt || cleanLabel(doc.updated_at).localeCompare(shelf.newestUpdatedAt) > 0) {
      shelf.newestUpdatedAt = cleanLabel(doc.updated_at) || shelf.newestUpdatedAt;
    }
    shelves.set(id, shelf);
  }

  return Array.from(shelves.values())
    .map((shelf) => ({
      ...shelf,
      docs: [...shelf.docs].sort(compareDocs),
    }))
    .sort((a, b) => {
      if (a.label === FALLBACK_SHELF && b.label !== FALLBACK_SHELF) return 1;
      if (b.label === FALLBACK_SHELF && a.label !== FALLBACK_SHELF) return -1;
      return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" });
    });
}
