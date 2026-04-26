/**
 * Phase 1 example wrap. Builds a ConversationalCard summarising a
 * search_memory result list. Only invoked when the caller opts in via
 * include_card=true on search_memory; the legacy raw-array response is the
 * default so existing agents keep working unchanged.
 *
 * Type imported from the new @unclick/wizard package (Phase 1 deliverable).
 */

import type { ConversationalCard } from "@unclick/wizard";

const MAX_PREVIEW_RESULTS = 5;
const MAX_PREVIEW_LENGTH = 140;

interface MemoryRowLike {
  id?: string;
  fact?: string;
  content?: string;
  category?: string;
  confidence?: number;
  created_at?: string;
}

function rowText(row: MemoryRowLike): string {
  const raw = row.fact ?? row.content ?? "";
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (trimmed.length <= MAX_PREVIEW_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_PREVIEW_LENGTH - 1)}…`;
}

export function buildSearchMemoryCard(
  query: string,
  results: unknown,
): ConversationalCard {
  const rows = Array.isArray(results) ? (results as MemoryRowLike[]) : [];
  const total = rows.length;
  const safeQuery = query.trim() || "(empty query)";

  if (total === 0) {
    return {
      title: `No memories found for "${safeQuery}"`,
      summary:
        "Memory was searched but nothing matched. Try a broader query or save a new fact if this is novel context.",
      severity: "info",
      followUps: [
        { label: "Refine the search query and try again" },
        {
          label: "Save this as a new fact",
          action: {
            tool: "save_fact",
            args: { fact: "", category: "general" },
            confirmation: "confirm",
          },
        },
      ],
      meta: { tool: "search_memory", query: safeQuery, result_count: 0 },
    };
  }

  const preview = rows.slice(0, MAX_PREVIEW_RESULTS).map(rowText).filter(Boolean);
  const shownCount = preview.length;
  const hiddenCount = Math.max(0, total - shownCount);

  return {
    title: `Found ${total} memor${total === 1 ? "y" : "ies"} matching "${safeQuery}"`,
    summary:
      hiddenCount > 0
        ? `Showing the top ${shownCount} of ${total}. The rest are in the raw results payload.`
        : `Showing all ${total}.`,
    severity: "success",
    body: [
      {
        kind: "list",
        heading: "Top matches",
        items: preview,
      },
    ],
    followUps: [
      { label: "Refine the search query and try again" },
      {
        label: "Save a new fact related to this query",
        action: {
          tool: "save_fact",
          args: { fact: "", category: "general" },
          confirmation: "confirm",
        },
      },
    ],
    meta: {
      tool: "search_memory",
      query: safeQuery,
      result_count: total,
    },
  };
}
