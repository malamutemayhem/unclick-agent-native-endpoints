import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  buildMemoryTaxonomySnapshots,
  isSensitiveMemorySnapshotText,
  memoryTaxonomySnapshotToLibraryDoc,
  writeMemoryTaxonomySnapshotsToLibrary,
} from "../supabase.js";

describe("memory taxonomy snapshots", () => {
  test("classifies technology documentaries as technology first with ordered secondary tags", () => {
    const [snapshot] = buildMemoryTaxonomySnapshots([
      {
        id: "fact-1",
        kind: "fact",
        text: "Chris loves technology documentaries",
        category: "preference",
        confidence: 0.93,
        updated_at: "2026-05-10T10:00:00.000Z",
      },
    ]);

    assert.equal(snapshot.primary_category, "17 Technology & Engineering");
    assert.deepEqual(snapshot.secondary_categories.slice(0, 2), [
      "18 Media & Entertainment",
      "04 Preferences & Taste",
    ]);
    assert.deepEqual(snapshot.source_ids, ["fact-1"]);
    assert.deepEqual(snapshot.source_receipts, [
      {
        memory_id: "fact:fact-1",
        source_kind: "fact",
        source_uri: "/admin/memory?tab=facts",
        confidence: 0.93,
        redaction_state: "clean",
        last_verified_at: "2026-05-10T10:00:00.000Z",
      },
    ]);
    assert.ok(snapshot.content.includes("Sources: fact:fact-1"));
  });

  test("skips raw secret, auth, and billing-like memory text", () => {
    assert.equal(isSensitiveMemorySnapshotText("Authorization: Bearer abc123token"), true);
    const snapshots = buildMemoryTaxonomySnapshots([
      {
        id: "fact-secret",
        kind: "fact",
        text: "The Stripe billing token is sk_live_example",
        category: "billing",
        confidence: 1,
      },
      {
        id: "fact-safe",
        kind: "fact",
        text: "Memory snapshots should keep compact source pointers",
        category: "technical",
        confidence: 0.8,
      },
    ]);

    assert.equal(snapshots.length, 1);
    assert.deepEqual(snapshots[0].source_ids, ["fact-safe"]);
    assert.equal(snapshots[0].content.includes("sk_live_example"), false);
  });

  test("dedupes repeated facts and keeps the strongest source", () => {
    const [snapshot] = buildMemoryTaxonomySnapshots([
      {
        id: "fact-low",
        kind: "fact",
        text: "UnClick memory uses taxonomy shelves",
        category: "memory",
        confidence: 0.4,
        updated_at: "2026-05-09T10:00:00.000Z",
      },
      {
        id: "fact-high",
        kind: "fact",
        text: "UnClick memory uses taxonomy shelves",
        category: "memory",
        confidence: 0.9,
        updated_at: "2026-05-10T10:00:00.000Z",
      },
    ]);

    assert.deepEqual(snapshot.source_ids, ["fact-high"]);
    assert.equal(snapshot.confidence, 0.9);
    assert.equal(snapshot.last_confirmed_at, "2026-05-10T10:00:00.000Z");
  });

  test("formats snapshots as source-linked library docs", () => {
    const [snapshot] = buildMemoryTaxonomySnapshots([
      {
        id: "fact-memory",
        kind: "fact",
        text: "Memory snapshots should keep source pointers for audit",
        category: "memory",
        confidence: 0.88,
      },
    ]);
    const doc = memoryTaxonomySnapshotToLibraryDoc(snapshot);

    assert.equal(doc.category, "memory_snapshot");
    assert.equal(doc.slug, "memory-taxonomy-15-data-and-memory");
    assert.ok(doc.tags.includes("memory-taxonomy-snapshot"));
    assert.ok(doc.content.includes("Source pointers: fact:fact-memory"));
    assert.ok(doc.content.includes("Source receipt states: fact:fact-memory clean"));
  });

  test("writer supports dry runs and live upserts", async () => {
    const sources = [
      {
        id: "fact-ops",
        kind: "fact" as const,
        text: "Worker routing performance monitor should track repeated failures",
        category: "worker",
        confidence: 0.9,
      },
    ];

    const dryRun = await writeMemoryTaxonomySnapshotsToLibrary({
      sources,
      options: { dry_run: true },
      upsertLibraryDoc: async () => {
        throw new Error("dry run should not write");
      },
      generatedAt: "2026-05-10T12:00:00.000Z",
    });

    assert.equal(dryRun.dry_run, true);
    assert.equal(dryRun.snapshot_count, 1);
    assert.equal(dryRun.written_count, 0);
    assert.ok(dryRun.snapshots[0].source_receipts.every((receipt) => receipt.redaction_state === "clean"));

    const writtenDocs: string[] = [];
    const live = await writeMemoryTaxonomySnapshotsToLibrary({
      sources,
      upsertLibraryDoc: async (doc) => {
        writtenDocs.push(doc.slug);
        return `Library doc created: "${doc.title}" (v1)`;
      },
      generatedAt: "2026-05-10T12:00:00.000Z",
    });

    assert.equal(live.dry_run, false);
    assert.equal(live.written_count, 1);
    assert.ok(live.snapshots[0].source_receipts.every((receipt) => receipt.source_uri.startsWith("/admin/memory")));
    assert.deepEqual(writtenDocs, [live.written[0].slug]);
  });
});
