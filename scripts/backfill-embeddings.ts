/**
 * Backfill embeddings for all extracted_facts and session_summaries rows
 * that don't yet have an embedding.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... OPENAI_API_KEY=...
 *   npx tsx scripts/backfill-embeddings.ts
 *
 * Optional env vars:
 *   EMBED_API_URL       - base URL for the /api/memory/embed endpoint
 *                         (default: http://localhost:3000)
 *   ADMIN_EMBED_SECRET  - the x-embed-secret header value
 *   PAGE_SIZE           - rows per page (default: 50)
 *   MC_API_KEY_HASH     - if set, only backfill rows for this tenant (managed mode)
 *   BACKFILL_UNPREFIXED_TABLES=1
 *                       - explicitly target BYOD unprefixed tables
 *
 * The script is safely re-runnable: it skips rows that already have an embedding.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const EMBED_API_URL = (process.env.EMBED_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
const ADMIN_EMBED_SECRET = process.env.ADMIN_EMBED_SECRET ?? "";
const PAGE_SIZE = parseInt(process.env.PAGE_SIZE ?? "50", 10);
const MC_API_KEY_HASH = process.env.MC_API_KEY_HASH ?? "";
const BACKFILL_UNPREFIXED_TABLES = process.env.BACKFILL_UNPREFIXED_TABLES === "1";

const EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_INPUT_CHARS = 32_000;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required");
  process.exit(1);
}
if (!MC_API_KEY_HASH && !BACKFILL_UNPREFIXED_TABLES) {
  console.error(
    "MC_API_KEY_HASH is required for managed backfills. Set BACKFILL_UNPREFIXED_TABLES=1 only when intentionally backfilling BYOD legacy tables."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface Row {
  id: string;
  fact?: string;
  summary?: string;
}

interface TableConfig {
  table: string;
  textCol: string;
}

// Determine which tables to backfill based on managed vs explicitly requested BYOD mode
const TABLES: TableConfig[] = MC_API_KEY_HASH
  ? [
      { table: "mc_extracted_facts", textCol: "fact" },
      { table: "mc_session_summaries", textCol: "summary" },
    ]
  : [
      { table: "extracted_facts", textCol: "fact" },
      { table: "session_summaries", textCol: "summary" },
    ];

async function embedDirect(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.slice(0, MAX_INPUT_CHARS),
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
  const vec = data.data[0]?.embedding;
  if (!vec) throw new Error("no embedding returned");
  return vec;
}

async function embedViaApi(id: string, table: string, text: string): Promise<void> {
  const res = await fetch(`${EMBED_API_URL}/api/memory/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-embed-secret": ADMIN_EMBED_SECRET,
    },
    body: JSON.stringify({ id, table, text }),
  });
  if (!res.ok) throw new Error(`embed API ${res.status}: ${await res.text()}`);
}

async function backfillTable(config: TableConfig): Promise<void> {
  const { table, textCol } = config;
  console.log(`\n[${table}] scanning for rows without embeddings...`);

  let page = 0;
  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = supabase
      .from(table)
      .select(`id, ${textCol}`)
      .is("embedding", null)
      .order("created_at", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (MC_API_KEY_HASH) {
      query = query.eq("api_key_hash", MC_API_KEY_HASH);
    }

    // Only fetch active facts (session_summaries don't have status)
    if (textCol === "fact") {
      query = (query as typeof query).eq("status", "active");
    }

    const { data: rows, error } = await query;
    if (error) {
      console.error(`[${table}] query failed:`, error.message);
      break;
    }
    if (!rows || rows.length === 0) break;

    for (const row of rows as unknown as Row[]) {
      const text = (row[textCol as keyof Row] as string | undefined) ?? "";
      if (!text.trim()) {
        totalSkipped++;
        continue;
      }

      try {
        if (ADMIN_EMBED_SECRET) {
          await embedViaApi(row.id, table, text);
        } else {
          // Direct DB write when no API server is running
          const embedding = await embedDirect(text);
          const { error: writeErr } = await supabase
            .from(table)
            .update({
              embedding: JSON.stringify(embedding),
              embedding_model: EMBEDDING_MODEL,
              embedding_created_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          if (writeErr) throw writeErr;
        }
        totalProcessed++;
        if (totalProcessed % 10 === 0) {
          process.stdout.write(`  processed ${totalProcessed}...\r`);
        }
      } catch (err) {
        console.error(`\n[${table}] failed row ${row.id}:`, err);
        totalFailed++;
      }

      // Brief pause to avoid hitting OpenAI rate limits (3000 RPM for small)
      await new Promise((r) => setTimeout(r, 20));
    }

    if (rows.length < PAGE_SIZE) break;
    page++;
  }

  console.log(
    `[${table}] done - embedded: ${totalProcessed}, skipped: ${totalSkipped}, failed: ${totalFailed}`
  );
}

async function main() {
  console.log("UnClick memory embedding backfill");
  console.log(
    `  mode: ${MC_API_KEY_HASH ? `managed (hash: ${MC_API_KEY_HASH.slice(0, 8)}...)` : "BYOD legacy tables"}`
  );
  console.log(`  embed: ${ADMIN_EMBED_SECRET ? "via API endpoint" : "direct OpenAI + DB write"}`);
  console.log(`  page size: ${PAGE_SIZE}`);

  for (const config of TABLES) {
    await backfillTable(config);
  }

  console.log("\nBackfill complete.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
