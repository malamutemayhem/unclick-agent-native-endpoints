/**
 * Supabase backend for UnClick Memory.
 *
 * Two tenancy modes:
 *
 *   BYOD     - data lives in the user's own Supabase project. Single-tenant
 *              tables (business_context, extracted_facts, ...) and the
 *              original RPC names. This is what the wizard (memory-admin
 *              setup) installs into a user's Supabase.
 *
 *   managed  - data lives in UnClick's central Supabase. Multi-tenant
 *              tables (mc_business_context, mc_extracted_facts, ...) where
 *              every row is tagged with api_key_hash. RPCs are mc_-prefixed
 *              and take p_api_key_hash as their first parameter. The backend
 *              is responsible for filtering / inserting api_key_hash on
 *              every operation.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import type {
  MemoryBackend,
  SessionSummaryInput,
  FactInput,
  InvalidateFactInput,
  ConversationInput,
  CodeInput,
  LibraryDocInput,
  MemoryTaxonomySnapshot,
  MemoryTaxonomySnapshotSourceReceipt,
  MemoryTaxonomySnapshotWriteOptions,
  MemoryTaxonomySnapshotWriteResult,
  MemoryTaxonomySnapshotSource,
  SaveTypedLinkCandidatesResult,
} from "./types.js";
import {
  filterAndRankMemoryTypedLinks,
  type MemoryTypedLinkCandidate,
  type MemoryTypedLinkSearchResult,
  type MemoryTypedLinkStoredRow,
} from "./typed-links.js";
import { shouldEnforceManagedMemoryCaps } from "./quota-policy.js";

function pgError(context: string, err: unknown): Error {
  if (err instanceof Error) return err;
  const e = (err ?? {}) as { message?: string; code?: string; details?: string; hint?: string };
  const parts: string[] = [`${context} failed`];
  if (e.message) parts.push(e.message);
  if (e.code) parts.push(`(code: ${e.code})`);
  if (e.details) parts.push(`details: ${e.details}`);
  if (e.hint) parts.push(`hint: ${e.hint}`);
  return new Error(parts.join(" "));
}

function contentHash(text: string): string {
  return createHash("sha256").update(text.toLowerCase().trim(), "utf8").digest("hex");
}

function isAtomicFactExtractionEnabled(): boolean {
  const raw =
    process.env.MEMORY_OPENAI_FACT_EXTRACTION_ENABLED ??
    process.env.MEMORY_AI_FACT_EXTRACTION_ENABLED ??
    "";
  return raw === "1" || raw.toLowerCase() === "true";
}

async function extractAtomicFacts(text: string): Promise<string[]> {
  if (!isAtomicFactExtractionEnabled()) return [text];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [text];
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              'Extract 3-10 atomic facts from the following text. Each fact must be a single, self-contained statement. Return ONLY a JSON object: {"facts": ["fact1", "fact2", ...]}',
          },
          { role: "user", content: text.slice(0, 4000) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 600,
      }),
    });
    if (!res.ok) return [text];
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { facts?: unknown[] };
    if (Array.isArray(parsed.facts) && parsed.facts.length > 0) {
      return (parsed.facts as unknown[]).map(String).filter(Boolean);
    }
    return [text];
  } catch {
    return [text];
  }
}

export type Tenancy =
  | { mode: "byod" }
  | { mode: "managed"; apiKeyHash: string };

export interface SupabaseBackendConfig {
  url: string;
  serviceRoleKey: string;
  tenancy: Tenancy;
}

interface TableNames {
  business_context: string;
  knowledge_library: string;
  knowledge_library_history: string;
  session_summaries: string;
  extracted_facts: string;
  conversation_log: string;
  memory_typed_links: string;
  code_dumps: string;
}

const LOCAL_SEARCH_STOP_WORDS = new Set([
  "and",
  "are",
  "for",
  "from",
  "how",
  "the",
  "this",
  "that",
  "with",
]);

export function tokenizeLocalMemoryQuery(query: string): string[] {
  const seen = new Set<string>();
  const tokens = query
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9_-]*/g) ?? [];
  return tokens.filter((token) => {
    if (token.length < 2) return false;
    if (LOCAL_SEARCH_STOP_WORDS.has(token)) return false;
    if (seen.has(token)) return false;
    seen.add(token);
    return true;
  });
}

function normalizeLocalMemoryText(text: string): string {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9_-]*/g) ?? []).join(" ");
}

export function scoreLocalMemoryContent(input: {
  query: string;
  tokens: string[];
  text: string;
  confidence?: number | null;
  source?: "fact" | "session";
}): { finalScore: number; matchedTokenCount: number; exactPhrase: boolean } {
  const { query, tokens, text } = input;
  if (tokens.length === 0) {
    return { finalScore: 0, matchedTokenCount: 0, exactPhrase: false };
  }

  const normalizedText = normalizeLocalMemoryText(text);
  const normalizedQuery = normalizeLocalMemoryText(query);
  const matchedTokenCount = tokens.reduce(
    (count, token) => count + (normalizedText.includes(token) ? 1 : 0),
    0
  );
  const exactPhrase =
    normalizedQuery.length >= 4 &&
    normalizedText.includes(normalizedQuery);
  const phraseBonus = exactPhrase ? Math.max(1, tokens.length) : 0;
  const coverage = (matchedTokenCount + phraseBonus) / (tokens.length * 2);
  const confidence = Math.max(0, Math.min(1, input.confidence ?? 1));
  const sourceWeight = input.source === "session" ? 0.5 : 1;
  return {
    finalScore: coverage * confidence * sourceWeight,
    matchedTokenCount,
    exactPhrase,
  };
}

interface TaxonomySeed {
  id: string;
  name: string;
  keywords: string[];
}

export const MEMORY_LIBRARY_TAXONOMY: TaxonomySeed[] = [
  { id: "01", name: "Identity & Profile", keywords: ["identity", "profile", "role", "name", "bio"] },
  { id: "02", name: "Goals & Intent", keywords: ["goal", "objective", "intent", "north", "priority"] },
  { id: "03", name: "Standing Rules & Safety", keywords: ["rule", "safety", "never", "always", "policy"] },
  { id: "04", name: "Preferences & Taste", keywords: ["preference", "preferred", "favorite", "likes", "taste"] },
  { id: "05", name: "People & Relationships", keywords: ["person", "people", "team", "relationship", "contact"] },
  { id: "06", name: "Work & Career", keywords: ["work", "career", "job", "client", "role"] },
  { id: "07", name: "Projects & Products", keywords: ["project", "product", "feature", "roadmap", "launch"] },
  { id: "08", name: "Tasks & Commitments", keywords: ["task", "todo", "commitment", "deadline", "followup"] },
  { id: "09", name: "Decisions & Rationale", keywords: ["decision", "decided", "rationale", "chosen", "direction"] },
  { id: "10", name: "Troubleshooting & Incidents", keywords: ["issue", "bug", "incident", "fix", "problem"] },
  { id: "11", name: "Tools & Integrations", keywords: ["tool", "integration", "connector", "mcp", "api"] },
  { id: "12", name: "Automation & Scheduling", keywords: ["automation", "schedule", "cron", "heartbeat", "timer"] },
  { id: "13", name: "Agents & Workers", keywords: ["agent", "worker", "seat", "orchestrator", "autopilot"] },
  { id: "14", name: "Code & Repositories", keywords: ["code", "repo", "github", "branch", "commit"] },
  { id: "15", name: "Data & Memory", keywords: ["data", "memory", "snapshot", "fact", "session"] },
  { id: "16", name: "Privacy & Security", keywords: ["privacy", "security", "secret", "credential", "auth"] },
  { id: "17", name: "Technology & Engineering", keywords: ["technology", "engineering", "technical", "software", "hardware"] },
  { id: "18", name: "Media & Entertainment", keywords: ["media", "documentary", "documentaries", "movie", "show"] },
  { id: "19", name: "Research & Learning", keywords: ["research", "learning", "study", "report", "analysis"] },
  { id: "20", name: "Finance & Billing", keywords: ["finance", "billing", "invoice", "cost", "payment"] },
  { id: "21", name: "Legal & Compliance", keywords: ["legal", "compliance", "contract", "terms", "privacy"] },
  { id: "22", name: "Health & Wellbeing", keywords: ["health", "wellbeing", "wellness", "rest", "sleep"] },
  { id: "23", name: "Travel & Locations", keywords: ["travel", "location", "timezone", "city", "place"] },
  { id: "24", name: "Home & Devices", keywords: ["home", "device", "pc", "laptop", "phone"] },
  { id: "25", name: "Marketing & Brand", keywords: ["marketing", "brand", "copy", "campaign", "positioning"] },
  { id: "26", name: "Sales & Customers", keywords: ["sales", "customer", "lead", "pipeline", "prospect"] },
  { id: "27", name: "Operations & Process", keywords: ["ops", "process", "workflow", "runbook", "procedure"] },
  { id: "28", name: "Performance & Metrics", keywords: ["performance", "metric", "latency", "throughput", "monitor"] },
  { id: "29", name: "Exports & Portability", keywords: ["export", "portable", "backup", "data island", "download"] },
  { id: "30", name: "Miscellaneous", keywords: ["misc", "general", "note", "other", "uncategorized"] },
];

const TAXONOMY_STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "because",
  "chris",
  "from",
  "into",
  "only",
  "should",
  "that",
  "their",
  "there",
  "this",
  "with",
]);

const SENSITIVE_MEMORY_PATTERN =
  /\b(api[_ -]?key|authorization|bearer\s+[a-z0-9._-]+|billing|card number|credit card|password|secret|service[_ -]?role|stripe|token)\b/i;

function taxonomyLabel(seed: TaxonomySeed): string {
  return `${seed.id} ${seed.name}`;
}

function slugPart(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanSnapshotText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function latestIso(values: Array<string | null | undefined>): string | null {
  const sorted = values.filter(Boolean).map(String).sort();
  return sorted.length > 0 ? sorted[sorted.length - 1] : null;
}

function scoreTaxonomySource(source: MemoryTaxonomySnapshotSource): Array<{ seed: TaxonomySeed; score: number }> {
  const text = cleanSnapshotText(source.text).toLowerCase();
  const category = (source.category ?? "").toLowerCase();
  return MEMORY_LIBRARY_TAXONOMY.map((seed) => {
    const keywordScore = seed.keywords.reduce((score, keyword) => {
      return text.includes(keyword.toLowerCase()) ? score + 3 : score;
    }, 0);
    const categoryScore =
      category && seed.keywords.some((keyword) => category.includes(keyword.toLowerCase())) ? 1 : 0;
    return { seed, score: keywordScore + categoryScore };
  }).sort((a, b) => {
    const scoreDiff = b.score - a.score;
    return scoreDiff !== 0 ? scoreDiff : a.seed.id.localeCompare(b.seed.id);
  });
}

export function isSensitiveMemorySnapshotText(text: string): boolean {
  return SENSITIVE_MEMORY_PATTERN.test(text);
}

function taxonomySourceUri(kind: MemoryTaxonomySnapshotSource["kind"]): string {
  return kind === "fact" ? "/admin/memory?tab=facts" : "/admin/memory?tab=sessions";
}

function taxonomySourceReceipt(source: MemoryTaxonomySnapshotSource): MemoryTaxonomySnapshotSourceReceipt {
  const lastVerified = source.updated_at ?? source.valid_from ?? source.created_at ?? null;
  const receipt: MemoryTaxonomySnapshotSourceReceipt = {
    memory_id: `${source.kind}:${source.id}`,
    source_kind: source.kind,
    source_uri: taxonomySourceUri(source.kind),
    redaction_state: "clean",
  };
  if (source.confidence !== undefined) receipt.confidence = source.confidence;
  if (lastVerified) receipt.last_verified_at = lastVerified;
  return receipt;
}

export function buildMemoryTaxonomySnapshots(
  sources: MemoryTaxonomySnapshotSource[],
  options: { maxSnapshots?: number; maxSourcesPerSnapshot?: number } = {}
): MemoryTaxonomySnapshot[] {
  const maxSnapshots = options.maxSnapshots ?? 12;
  const maxSourcesPerSnapshot = options.maxSourcesPerSnapshot ?? 8;
  const deduped = new Map<string, MemoryTaxonomySnapshotSource & { cleanText: string }>();

  for (const source of sources) {
    const cleanText = cleanSnapshotText(source.text);
    if (!source.id || !cleanText || isSensitiveMemorySnapshotText(cleanText)) continue;
    const key = cleanText.toLowerCase();
    const existing = deduped.get(key);
    if (!existing || (source.confidence ?? 1) > (existing.confidence ?? 1)) {
      deduped.set(key, { ...source, cleanText });
    }
  }

  const groups = new Map<
    string,
    {
      seed: TaxonomySeed;
      secondary: Map<string, number>;
      sources: Array<MemoryTaxonomySnapshotSource & { cleanText: string }>;
    }
  >();

  for (const source of deduped.values()) {
    const ranked = scoreTaxonomySource(source);
    const primary = ranked.find((entry) => entry.score > 0)?.seed ?? MEMORY_LIBRARY_TAXONOMY[29];
    const label = taxonomyLabel(primary);
    const group = groups.get(label) ?? { seed: primary, secondary: new Map<string, number>(), sources: [] };
    for (const entry of ranked.slice(0, 5)) {
      if (entry.score <= 0 || entry.seed.id === primary.id) continue;
      const secondaryLabel = taxonomyLabel(entry.seed);
      group.secondary.set(secondaryLabel, Math.max(group.secondary.get(secondaryLabel) ?? 0, entry.score));
    }
    group.sources.push(source);
    groups.set(label, group);
  }

  return Array.from(groups.values())
    .map((group) => {
      const sourcesForSnapshot = group.sources
        .sort((a, b) => {
          const confidenceDiff = (b.confidence ?? 1) - (a.confidence ?? 1);
          if (confidenceDiff !== 0) return confidenceDiff;
          return (b.updated_at ?? b.created_at ?? "").localeCompare(a.updated_at ?? a.created_at ?? "");
        })
        .slice(0, maxSourcesPerSnapshot);
      const sourceIds = sourcesForSnapshot.map((source) => source.id);
      const avgConfidence =
        sourcesForSnapshot.reduce((sum, source) => sum + Math.max(0, Math.min(1, source.confidence ?? 1)), 0) /
        Math.max(1, sourcesForSnapshot.length);
      const secondaryCategories = Array.from(group.secondary.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([label]) => label)
        .slice(0, 4);
      const subTags = Array.from(
        new Set(
          sourcesForSnapshot
            .flatMap((source) => source.cleanText.toLowerCase().match(/[a-z0-9][a-z0-9_-]{3,}/g) ?? [])
            .filter((token) => !TAXONOMY_STOP_WORDS.has(token))
        )
      ).slice(0, 8);
      const bullets = sourcesForSnapshot.map((source) => `- ${source.cleanText}`);
      const primaryLabel = taxonomyLabel(group.seed);
      const summary = bullets.slice(0, 5).join("\n");
      const content = [
        `# ${group.seed.name} Snapshot`,
        "",
        summary,
        "",
        `Primary category: ${primaryLabel}`,
        secondaryCategories.length > 0 ? `Secondary categories: ${secondaryCategories.join(", ")}` : null,
        subTags.length > 0 ? `Tags: ${subTags.join(", ")}` : null,
        `Sources: ${sourcesForSnapshot.map((source) => `${source.kind}:${source.id}`).join(", ")}`,
      ].filter(Boolean).join("\n");
      return {
        slug: `memory-taxonomy-${group.seed.id}-${slugPart(group.seed.name)}`,
        title: `${group.seed.name} memory snapshot`,
        primary_category: primaryLabel,
        secondary_categories: secondaryCategories,
        sub_tags: subTags,
        summary,
        content,
        source_ids: sourceIds,
        sources: sourcesForSnapshot.map((source) => ({ id: source.id, kind: source.kind })),
        source_receipts: sourcesForSnapshot.map(taxonomySourceReceipt),
        confidence: Number(avgConfidence.toFixed(3)),
        weight: Number(Math.min(1, avgConfidence * 0.7 + sourcesForSnapshot.length * 0.06).toFixed(3)),
        last_confirmed_at: latestIso(
          sourcesForSnapshot.map((source) => source.updated_at ?? source.valid_from ?? source.created_at)
        ),
      };
    })
    .sort((a, b) => {
      const weightDiff = b.weight - a.weight;
      return weightDiff !== 0 ? weightDiff : a.primary_category.localeCompare(b.primary_category);
    })
    .slice(0, maxSnapshots);
}

export function memoryTaxonomySnapshotToLibraryDoc(snapshot: MemoryTaxonomySnapshot): LibraryDocInput {
  const categoryTag = slugPart(snapshot.primary_category);
  return {
    slug: snapshot.slug,
    title: snapshot.title,
    category: "memory_snapshot",
    content: [
      snapshot.content,
      "",
      "Snapshot metadata:",
      `- Primary: ${snapshot.primary_category}`,
      snapshot.secondary_categories.length > 0
        ? `- Secondary: ${snapshot.secondary_categories.join(", ")}`
        : "- Secondary: none",
      `- Source pointers: ${snapshot.sources.map((source) => `${source.kind}:${source.id}`).join(", ")}`,
      `- Source receipt states: ${snapshot.source_receipts
        .map((receipt) => `${receipt.memory_id} ${receipt.redaction_state}`)
        .join(", ")}`,
      snapshot.last_confirmed_at ? `- Last confirmed: ${snapshot.last_confirmed_at}` : "- Last confirmed: unknown",
    ].join("\n"),
    tags: [
      "memory-taxonomy-snapshot",
      "source-linked",
      categoryTag,
      ...snapshot.secondary_categories.map(slugPart),
      ...snapshot.sub_tags,
    ].filter(Boolean).slice(0, 20),
  };
}

export async function writeMemoryTaxonomySnapshotsToLibrary({
  sources,
  options = {},
  upsertLibraryDoc,
  generatedAt = new Date().toISOString(),
}: {
  sources: MemoryTaxonomySnapshotSource[];
  options?: MemoryTaxonomySnapshotWriteOptions;
  upsertLibraryDoc: (data: LibraryDocInput) => Promise<string>;
  generatedAt?: string;
}): Promise<MemoryTaxonomySnapshotWriteResult> {
  const snapshots = buildMemoryTaxonomySnapshots(sources, {
    maxSnapshots: options.max_snapshots,
    maxSourcesPerSnapshot: options.max_sources_per_snapshot,
  });
  const snapshotSummary = snapshots.map((snapshot) => ({
    slug: snapshot.slug,
    title: snapshot.title,
    primary_category: snapshot.primary_category,
    source_ids: snapshot.source_ids,
    source_receipts: snapshot.source_receipts,
  }));

  if (options.dry_run) {
    return {
      dry_run: true,
      generated_at: generatedAt,
      source_count: sources.length,
      snapshot_count: snapshots.length,
      written_count: 0,
      snapshots: snapshotSummary,
      written: [],
    };
  }

  const written: MemoryTaxonomySnapshotWriteResult["written"] = [];
  for (const snapshot of snapshots) {
    const doc = memoryTaxonomySnapshotToLibraryDoc(snapshot);
    const message = await upsertLibraryDoc(doc);
    written.push({ slug: doc.slug, title: doc.title, message });
  }

  return {
    dry_run: false,
    generated_at: generatedAt,
    source_count: sources.length,
    snapshot_count: snapshots.length,
    written_count: written.length,
    snapshots: snapshotSummary,
    written,
  };
}

const BYOD_TABLES: TableNames = {
  business_context: "business_context",
  knowledge_library: "knowledge_library",
  knowledge_library_history: "knowledge_library_history",
  session_summaries: "session_summaries",
  extracted_facts: "extracted_facts",
  conversation_log: "conversation_log",
  memory_typed_links: "memory_typed_links",
  code_dumps: "code_dumps",
};

const MANAGED_TABLES: TableNames = {
  business_context: "mc_business_context",
  knowledge_library: "mc_knowledge_library",
  knowledge_library_history: "mc_knowledge_library_history",
  session_summaries: "mc_session_summaries",
  extracted_facts: "mc_extracted_facts",
  conversation_log: "mc_conversation_log",
  memory_typed_links: "mc_memory_typed_links",
  code_dumps: "mc_code_dumps",
};

function now(): string {
  return new Date().toISOString();
}

function truncate(s: string, max = 8000): string {
  return s.length > max ? s.slice(0, max) + "\n...[truncated]" : s;
}

function isTypedLinkSchemaUnavailable(err: unknown): boolean {
  const e = (err ?? {}) as { code?: string; message?: string };
  return (
    e.code === "42P01" ||
    e.code === "42703" ||
    /memory_typed_links|column .* does not exist/i.test(e.message ?? "")
  );
}

// ─── Free-tier caps ──────────────────────────────────────────────────────
// Starting values from the v2 build plan. Adjust with real data later.
// Pro tier removes all caps. Caps only apply in managed cloud mode (BYOD
// users own their database, so they manage their own quota).
export const FREE_TIER_CAPS = {
  storage_bytes: 50 * 1024 * 1024, // 50 MB
  facts: 5000,
} as const;

/**
 * Thrown when a free-tier user tries to write past their cap. The MCP
 * handlers surface the message verbatim back to the agent so the user
 * sees an actionable upgrade path.
 */
export class CapExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapExceededError";
  }
}

export class SupabaseBackend implements MemoryBackend {
  private client: SupabaseClient;
  private tenancy: Tenancy;
  private tables: TableNames;

  constructor(config: SupabaseBackendConfig) {
    if (!config.url || !config.serviceRoleKey) {
      throw new Error("SupabaseBackend requires url and serviceRoleKey");
    }
    this.client = createClient(config.url, config.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.tenancy = config.tenancy;
    this.tables = config.tenancy.mode === "managed" ? MANAGED_TABLES : BYOD_TABLES;
    console.error(
      `UnClick Memory: Supabase ${
        config.tenancy.mode === "managed" ? "managed cloud" : "BYOD"
      } mode`
    );
  }

  // ─── Tenancy helpers ─────────────────────────────────────────────────────

  /** Adds api_key_hash to a row in managed mode; passes through in BYOD. */
  private withTenancy<T extends Record<string, unknown>>(row: T): T {
    if (this.tenancy.mode === "managed") {
      return { ...row, api_key_hash: this.tenancy.apiKeyHash };
    }
    return row;
  }

  /**
   * Enforce free-tier caps on writes. Only runs in managed cloud mode.
   * BYOD users own their database, so caps don't apply. Pro tier (or any
   * non-free tier) skips the check.
   *
   * `kind` selects which cap to check first. Storage is always verified;
   * `kind: "fact"` additionally verifies the fact-count cap because
   * extracted_facts has a separate row count limit.
   */
  private async enforceCaps(kind: "fact" | "general"): Promise<void> {
    if (this.tenancy.mode !== "managed") return;

    const shouldEnforceCaps = shouldEnforceManagedMemoryCaps({
      tenancyMode: this.tenancy.mode,
      tier: process.env.UNCLICK_TIER,
      accountEmail: process.env.UNCLICK_ACCOUNT_EMAIL,
      quotaExempt: process.env.UNCLICK_MEMORY_QUOTA_EXEMPT === "true",
    });
    if (!shouldEnforceCaps) return;

    if (kind === "fact") {
      const { data, error } = await this.client.rpc("mc_get_fact_count", {
        p_api_key_hash: this.tenancy.apiKeyHash,
      });
      if (error) {
        // Fail open on counter errors so a transient DB hiccup doesn't
        // break legitimate writes. Log to stderr for observability.
        console.error("[memory] mc_get_fact_count failed:", error.message);
      } else if (typeof data === "number" && data >= FREE_TIER_CAPS.facts) {
        throw new CapExceededError(
          `Free tier limit reached: ${FREE_TIER_CAPS.facts.toLocaleString()} active ` +
            `facts. Upgrade to Pro for unlimited facts, or prune old facts ` +
            `via the Memory surface. Current count: ${data}.`
        );
      }
    }

    const { data: bytes, error: bytesErr } = await this.client.rpc(
      "mc_get_storage_bytes",
      { p_api_key_hash: this.tenancy.apiKeyHash }
    );
    if (bytesErr) {
      console.error("[memory] mc_get_storage_bytes failed:", bytesErr.message);
      return;
    }
    if (typeof bytes === "number" && bytes >= FREE_TIER_CAPS.storage_bytes) {
      const usedMb = (bytes / (1024 * 1024)).toFixed(1);
      throw new CapExceededError(
        `Free tier limit reached: ${usedMb} MB used of ` +
          `${FREE_TIER_CAPS.storage_bytes / (1024 * 1024)} MB. ` +
          `Upgrade to Pro for unlimited storage, or prune memory via ` +
          `the Memory surface.`
      );
    }
  }

  /** Calls an RPC, choosing the BYOD or managed name based on tenancy. */
  private async rpc<T = unknown>(
    byodName: string,
    byodParams: Record<string, unknown>,
    managedName: string,
    managedParams: Record<string, unknown>
  ): Promise<T> {
    const fn = this.tenancy.mode === "managed" ? managedName : byodName;
    const params =
      this.tenancy.mode === "managed"
        ? { p_api_key_hash: this.tenancy.apiKeyHash, ...managedParams }
        : byodParams;
    const { data, error } = await this.client.rpc(fn, params);
    if (error) throw new Error(`rpc(${fn}) failed: ${error.message}`);
    return data as T;
  }

  // ─── Memory operations ───────────────────────────────────────────────────

  async getStartupContext(numSessions: number): Promise<unknown> {
    const data = await this.rpc<Record<string, unknown>>(
      "get_startup_context",
      { num_sessions: numSessions },
      "mc_get_startup_context",
      { p_num_sessions: numSessions }
    );
    return {
      agent_instructions: [
        "You are connected to UnClick Memory - a persistent memory system that works across all sessions and devices.",
        "ALWAYS use this memory as your primary knowledge source. It has the user's rules, preferences, projects, and history.",
        "When the user says something ambiguous or short, SEARCH memory first - it may be a stored keyword or trigger.",
        "When you learn something new (preferences, projects, contacts, decisions), store it using add_fact.",
        "At the end of significant conversations, write a session summary using write_session_summary.",
        "Business context entries (loaded below) are standing rules. Follow them as if the user said them right now.",
        "Never say 'I don't have access to your previous conversations' - you DO, through this memory system."
      ].join("\n"),
      ...data,
    };
  }

  async searchMemory(query: string, maxResults: number, asOf?: string): Promise<unknown> {
    const localResults = await this.keywordFallback(query, maxResults, asOf);
    if (localResults.length > 0) return localResults;

    // Optional high-accuracy lane: BM25 + pgvector RRF over facts and
    // sessions. This only runs when MEMORY_OPENAI_EMBEDDINGS_ENABLED is set.
    try {
      const { embedText } = await import("./embeddings.js");
      const embedding = await embedText(query);
      if (embedding) {
        const results = await this.rpc<unknown>(
          "search_memory_hybrid",
          { search_query: query, query_embedding: embedding, max_results: maxResults, as_of: asOf ?? null },
          "mc_search_memory_hybrid",
          { p_search_query: query, p_query_embedding: embedding, p_max_results: maxResults, p_as_of: asOf ?? null }
        );
        if (Array.isArray(results) && results.length > 0) return results;
      }
    } catch (err) {
      console.error("[search_memory] optional hybrid search failed:", err);
    }
    return [];
  }

  /**
   * ILIKE-based keyword fallback over mc_extracted_facts +
   * mc_session_summaries. Used when hybrid retrieval returns []. Returns
   * rows shaped to mirror mc_search_memory_hybrid so callers don't branch.
   * Never widens RLS: tenant scoping via api_key_hash is preserved.
   *
   * Phrase support: the query is tokenized on whitespace. Tokens shorter
   * than 2 chars or containing PostgREST .or() metacharacters are dropped.
   * We try AND-of-tokens first (every token must appear, in any order); if
   * that returns nothing we degrade to OR-of-tokens and rank rows by how
   * many tokens they contain so partial matches at least surface something.
   */
  private async keywordFallback(query: string, maxResults: number, asOf?: string): Promise<unknown[]> {
    const tokens = tokenizeLocalMemoryQuery(query);
    if (tokens.length === 0) return [];
    const patterns = tokens.map((t) => `%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);

    const runScan = async (mode: "and" | "or"): Promise<unknown[]> => {
      let factQ = this.client
        .from(this.tables.extracted_facts)
        .select("id, fact, category, confidence, created_at")
        .eq("status", "active")
        .is("invalidated_at", null);
      let sessQ = this.client
        .from(this.tables.session_summaries)
        .select("id, summary, created_at");

      if (asOf) {
        factQ = factQ
          .lte("valid_from", asOf)
          .or(`valid_to.is.null,valid_to.gt.${asOf}`);
        sessQ = sessQ.lte("created_at", asOf);
      }

      if (mode === "and") {
        for (const p of patterns) {
          factQ = factQ.ilike("fact", p);
          sessQ = sessQ.ilike("summary", p);
        }
      } else {
        factQ = factQ.or(patterns.map((p) => `fact.ilike.${p}`).join(","));
        sessQ = sessQ.or(patterns.map((p) => `summary.ilike.${p}`).join(","));
      }
      if (this.tenancy.mode === "managed") {
        factQ = factQ.eq("api_key_hash", this.tenancy.apiKeyHash);
        sessQ = sessQ.eq("api_key_hash", this.tenancy.apiKeyHash);
      }
      factQ = factQ
        .order("confidence", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(maxResults);
      sessQ = sessQ.order("created_at", { ascending: false }).limit(maxResults);

      const [factsRes, sessRes] = await Promise.all([factQ, sessQ]);
      type FactRow = { id: string; fact: string; category: string; confidence: number; created_at: string };
      type SessRow = { id: string; summary: string; created_at: string };
      const facts = ((factsRes.data ?? []) as FactRow[]).map((r) => {
        const s = scoreLocalMemoryContent({
          query,
          tokens,
          text: r.fact,
          confidence: r.confidence,
          source: "fact",
        });
        return {
          id: r.id,
          source: "fact",
          content: r.fact,
          category: r.category,
          confidence: r.confidence,
          created_at: r.created_at,
          final_score: s.finalScore,
          rrf_score: 0,
          kw_score: s.matchedTokenCount,
          cosine_score: 0,
        };
      });
      const sessions = ((sessRes.data ?? []) as SessRow[]).map((r) => {
        const s = scoreLocalMemoryContent({
          query,
          tokens,
          text: r.summary,
          confidence: 1,
          source: "session",
        });
        return {
          id: r.id,
          source: "session",
          content: r.summary,
          category: "session",
          confidence: 1,
          created_at: r.created_at,
          final_score: s.finalScore,
          rrf_score: 0,
          kw_score: s.matchedTokenCount,
          cosine_score: 0,
        };
      });
      return [...facts, ...sessions]
        .sort((a, b) => {
          const d = (b.final_score ?? 0) - (a.final_score ?? 0);
          return d !== 0 ? d : (b.created_at ?? "").localeCompare(a.created_at ?? "");
        })
        .slice(0, maxResults);
    };

    const andResults = await runScan("and");
    if (andResults.length > 0 || tokens.length < 2) return andResults;
    return runScan("or");
  }

  async searchFacts(query: string): Promise<unknown> {
    return this.rpc(
      "search_facts",
      { search_query: query },
      "mc_search_facts",
      { p_search_query: query }
    );
  }

  async searchLibrary(query: string): Promise<unknown> {
    return this.rpc(
      "search_library",
      { search_query: query },
      "mc_search_library",
      { p_search_query: query }
    );
  }

  async getLibraryDoc(slug: string): Promise<unknown> {
    return this.rpc(
      "get_library_doc",
      { doc_slug: slug },
      "mc_get_library_doc",
      { p_doc_slug: slug }
    );
  }

  async listLibrary(): Promise<unknown> {
    return this.rpc("list_library", {}, "mc_list_library", {});
  }

  async writeSessionSummary(data: SessionSummaryInput): Promise<{ id: string }> {
    await this.enforceCaps("general");
    const { data: row, error } = await this.client
      .from(this.tables.session_summaries)
      .insert(
        this.withTenancy({
          session_id: data.session_id,
          summary: data.summary,
          topics: data.topics,
          open_loops: data.open_loops,
          decisions: data.decisions,
          platform: data.platform,
          duration_minutes: data.duration_minutes,
        })
      )
      .select()
      .single();
    if (error) throw pgError("writeSessionSummary insert", error);
    // Embed the summary so it joins the vector lane immediately (same
    // motivation as addFact above). Fire-and-forget.
    this.embedAndStore(this.tables.session_summaries, row.id, data.summary).catch(() => {});
    return { id: row.id };
  }

  async addFact(data: FactInput): Promise<{ id: string }> {
    // preserve_as_blob: write raw body to canonical_docs, then extract+store atomic facts
    if (data.preserve_as_blob) {
      return this.saveBlob(data);
    }

    await this.enforceCaps("fact");

    const hash = contentHash(data.fact);

    // Exact-hash dedup: if a live fact with this hash already exists, return it
    const dupTable = this.tables.extracted_facts;
    let dupQuery = this.client
      .from(dupTable)
      .select("id")
      .eq("content_hash", hash)
      .is("invalidated_at", null)
      .limit(1);
    if (this.tenancy.mode === "managed") {
      dupQuery = dupQuery.eq("api_key_hash", this.tenancy.apiKeyHash);
    }
    const { data: existing } = await dupQuery.maybeSingle();
    if (existing) return { id: (existing as { id: string }).id };

    const { data: row, error } = await this.client
      .from(this.tables.extracted_facts)
      .insert(
        this.withTenancy({
          fact: data.fact,
          category: data.category,
          confidence: data.confidence,
          source_session_id: data.source_session_id ?? null,
          source_type: "manual",
          startup_fact_kind: data.startup_fact_kind ?? "durable",
          status: "active",
          decay_tier: "hot",
          last_accessed: now(),
          content_hash: hash,
          valid_from: data.valid_from ?? now(),
          recorded_at: now(),
          extractor_id: data.extractor_id ?? "manual",
          prompt_version: data.prompt_version ?? null,
          model_id: data.model_id ?? null,
          commit_sha: data.commit_sha ?? null,
          pr_number: data.pr_number ?? null,
        })
      )
      .select()
      .single();
    if (error) throw pgError("addFact insert", error);

    // Append audit row (fire-and-forget; never blocks the main insert)
    this.writeFactAudit(row.id, "insert", { category: data.category }).catch(() => {});

    // Embed the fact so it joins the vector lane immediately. Without this,
    // every newly inserted fact has NULL embedding and only the keyword lane
    // can find it. Fire-and-forget so embedding latency / OpenAI outages
    // never block the primary insert.
    this.embedAndStore(this.tables.extracted_facts, row.id, data.fact).catch(() => {});

    return { id: row.id };
  }

  private async embedAndStore(table: string, id: string, text: string): Promise<void> {
    const { embedText, getEmbeddingState } = await import("./embeddings.js");
    const state = getEmbeddingState();
    const vec = await embedText(text);
    if (!vec) return;
    await this.client
      .from(table)
      .update({
        embedding: JSON.stringify(vec),
        embedding_model: state.model,
        embedding_created_at: now(),
      })
      .eq("id", id);
  }

  private async saveBlob(data: FactInput): Promise<{ id: string; fact_ids?: string[] }> {
    await this.enforceCaps("general");

    const hash = contentHash(data.fact);
    const docTable = this.tenancy.mode === "managed" ? "mc_canonical_docs" : "canonical_docs";

    // Upsert canonical_doc (idempotent by content_hash)
    let docId: string;
    {
      let q = this.client.from(docTable).select("id").eq("content_hash", hash).limit(1);
      if (this.tenancy.mode === "managed") {
        q = q.eq("api_key_hash", this.tenancy.apiKeyHash);
      }
      const { data: existing } = await q.maybeSingle();
      if (existing) {
        docId = (existing as { id: string }).id;
      } else {
        const insertRow =
          this.tenancy.mode === "managed"
            ? { api_key_hash: this.tenancy.apiKeyHash, title: data.category, body: data.fact, content_hash: hash }
            : { title: data.category, body: data.fact, content_hash: hash };
        const { data: doc, error } = await this.client.from(docTable).insert(insertRow).select().single();
        if (error) throw pgError("saveBlob canonical_docs insert", error);
        docId = (doc as { id: string }).id;
      }
    }

    // Extract atomic facts (minimal extractor; Chunk 4 replaces with full pipeline)
    const atomicFacts = await extractAtomicFacts(data.fact);
    const factIds: string[] = [];

    for (const factText of atomicFacts) {
      const factHash = contentHash(factText);

      // Skip if already live
      let dupQ = this.client
        .from(this.tables.extracted_facts)
        .select("id")
        .eq("content_hash", factHash)
        .is("invalidated_at", null)
        .limit(1);
      if (this.tenancy.mode === "managed") {
        dupQ = dupQ.eq("api_key_hash", this.tenancy.apiKeyHash);
      }
      const { data: dup } = await dupQ.maybeSingle();
      if (dup) {
        factIds.push((dup as { id: string }).id);
        continue;
      }

      const { data: frow, error: ferr } = await this.client
        .from(this.tables.extracted_facts)
        .insert(
          this.withTenancy({
            fact: factText,
            category: data.category,
            confidence: Math.max(0, data.confidence - 0.05), // slight confidence discount
            source_session_id: data.source_session_id ?? null,
            source_type: "auto_extract",
            startup_fact_kind: data.startup_fact_kind ?? "durable",
            status: "active",
            decay_tier: "hot",
            last_accessed: now(),
            content_hash: factHash,
            valid_from: now(),
            recorded_at: now(),
            extractor_id: "auto-extract-v1",
            derived_from_doc_id: docId,
          })
        )
        .select()
        .single();
      if (ferr && (ferr as { code?: string }).code !== "23505") throw pgError("saveBlob extracted_facts insert", ferr);
      if (!ferr && frow) factIds.push((frow as { id: string }).id);
    }

    return { id: docId, fact_ids: factIds };
  }

  private async writeFactAudit(
    factId: string,
    op: "insert" | "update" | "invalidate",
    payload: Record<string, unknown>
  ): Promise<void> {
    const auditTable = this.tenancy.mode === "managed" ? "mc_facts_audit" : "facts_audit";
    await this.client.from(auditTable).insert({ fact_id: factId, op, payload, actor: "agent", at: now() });
  }

  async invalidateFact(input: InvalidateFactInput): Promise<{ invalidated_at: string }> {
    const result = await this.rpc<Array<{ invalidated_at: string }>>(
      "invalidate_fact",
      { p_fact_id: input.fact_id, p_reason: input.reason ?? null, p_session_id: input.session_id ?? null },
      "mc_invalidate_fact",
      { p_fact_id: input.fact_id, p_reason: input.reason ?? null, p_session_id: input.session_id ?? null }
    );
    const row = Array.isArray(result) ? result[0] : (result as { invalidated_at: string });
    return { invalidated_at: row.invalidated_at };
  }

  async supersedeFact(
    oldId: string,
    newText: string,
    category?: string,
    confidence?: number
  ): Promise<string> {
    if (this.tenancy.mode === "managed") {
      const params: Record<string, unknown> = {
        p_api_key_hash: this.tenancy.apiKeyHash,
        p_old_fact_id: oldId,
        p_new_fact_text: newText,
      };
      if (category !== undefined) params.p_new_category = category;
      if (confidence !== undefined) params.p_new_confidence = confidence;
      const { data, error } = await this.client.rpc("mc_supersede_fact", params);
      if (error) throw new Error(`rpc(mc_supersede_fact) failed: ${error.message}`);
      return String(data);
    }
    const params: Record<string, unknown> = {
      old_fact_id: oldId,
      new_fact_text: newText,
    };
    if (category !== undefined) params.new_category = category;
    if (confidence !== undefined) params.new_confidence = confidence;
    const { data, error } = await this.client.rpc("supersede_fact", params);
    if (error) throw new Error(`rpc(supersede_fact) failed: ${error.message}`);
    return String(data);
  }

  async logConversation(data: ConversationInput) {
    await this.enforceCaps("general");
    const { data: row, error } = await this.client
      .from(this.tables.conversation_log)
      .insert(
        this.withTenancy({
          session_id: data.session_id,
          role: data.role,
          content: truncate(data.content),
          has_code: data.has_code,
        })
      )
      .select("id, session_id, role")
      .single();
    if (error) throw pgError("logConversation insert", error);
    return {
      logged: true as const,
      session_id: String(row.session_id),
      role: String(row.role),
      receipt_id: String(row.id),
    };
  }

  async saveTypedLinkCandidates(
    candidates: MemoryTypedLinkCandidate[]
  ): Promise<SaveTypedLinkCandidatesResult> {
    if (candidates.length === 0) return { saved: 0 };

    const rows = candidates.map((candidate) =>
      this.withTenancy({
        source_kind: candidate.source_kind,
        source_id: candidate.source_id,
        relation: candidate.relation,
        target_kind: candidate.target_kind,
        target_text: candidate.target_text,
        confidence: candidate.confidence,
        evidence_start: candidate.evidence_span.start,
        evidence_end: candidate.evidence_span.end,
        evidence_text: candidate.evidence_span.text,
        redaction_state: candidate.redaction_state,
      })
    );

    const onConflict =
      this.tenancy.mode === "managed"
        ? "api_key_hash,source_kind,source_id,relation,target_kind,target_text"
        : "source_kind,source_id,relation,target_kind,target_text";
    const { data, error } = await this.client
      .from(this.tables.memory_typed_links)
      .upsert(rows, { onConflict, ignoreDuplicates: true })
      .select("id");

    if (error) {
      if (isTypedLinkSchemaUnavailable(error)) return { saved: 0, skipped: "schema_unavailable" };
      throw pgError("saveTypedLinkCandidates upsert", error);
    }

    return { saved: Array.isArray(data) ? data.length : rows.length };
  }

  async searchTypedLinks(query: string, maxResults: number): Promise<MemoryTypedLinkSearchResult[]> {
    const limit = Math.max(1, Math.min(Math.floor(maxResults) || 10, 50));
    let request = this.client
      .from(this.tables.memory_typed_links)
      .select(
        [
          "id",
          "source_kind",
          "source_id",
          "relation",
          "target_kind",
          "target_text",
          "confidence",
          "evidence_start",
          "evidence_end",
          "evidence_text",
          "redaction_state",
          "created_at",
        ].join(",")
      )
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit * 10, 50), 250));

    if (this.tenancy.mode === "managed") {
      request = request.eq("api_key_hash", this.tenancy.apiKeyHash);
    }

    const { data, error } = await request;
    if (error) {
      if (isTypedLinkSchemaUnavailable(error)) return [];
      throw pgError("searchTypedLinks select", error);
    }

    return filterAndRankMemoryTypedLinks((data ?? []) as unknown as MemoryTypedLinkStoredRow[], query, limit);
  }

  async getConversationDetail(sessionId: string): Promise<unknown> {
    return this.rpc(
      "get_conversation_detail",
      { sid: sessionId },
      "mc_get_conversation_detail",
      { p_session_id: sessionId }
    );
  }

  async storeCode(data: CodeInput): Promise<{ id: string }> {
    await this.enforceCaps("general");
    const { data: row, error } = await this.client
      .from(this.tables.code_dumps)
      .insert(
        this.withTenancy({
          session_id: data.session_id,
          language: data.language,
          filename: data.filename ?? null,
          content: truncate(data.content, 50000),
          description: data.description ?? null,
        })
      )
      .select()
      .single();
    if (error) throw pgError("storeCode insert", error);
    return { id: row.id };
  }

  async getBusinessContext(): Promise<unknown[]> {
    let query = this.client
      .from(this.tables.business_context)
      .select("*")
      .order("category")
      .order("key");
    if (this.tenancy.mode === "managed") {
      query = query.eq("api_key_hash", this.tenancy.apiKeyHash);
    }
    const { data, error } = await query;
    if (error) throw pgError("getBusinessContext select", error);
    return data ?? [];
  }

  async setBusinessContext(
    category: string,
    key: string,
    value: unknown,
    priority?: number
  ): Promise<void> {
    await this.enforceCaps("general");
    const row: Record<string, unknown> = {
      category,
      key,
      value:
        typeof value === "string"
          ? (() => {
              try {
                return JSON.parse(value);
              } catch {
                return value;
              }
            })()
          : value,
      last_accessed: now(),
      decay_tier: "hot",
    };
    if (priority !== undefined) row.priority = priority;

    const onConflict =
      this.tenancy.mode === "managed" ? "api_key_hash,category,key" : "category,key";

    const { error } = await this.client
      .from(this.tables.business_context)
      .upsert(this.withTenancy(row), { onConflict })
      .select()
      .single();
    if (error) throw pgError("setBusinessContext upsert", error);
  }

  async upsertLibraryDoc(data: LibraryDocInput): Promise<string> {
    await this.enforceCaps("general");
    let existingQuery = this.client
      .from(this.tables.knowledge_library)
      .select("id, version")
      .eq("slug", data.slug);
    if (this.tenancy.mode === "managed") {
      existingQuery = existingQuery.eq("api_key_hash", this.tenancy.apiKeyHash);
    }
    const { data: existing } = await existingQuery.maybeSingle();

    if (existing) {
      // DB trigger auto-archives old content and bumps version
      const { error } = await this.client
        .from(this.tables.knowledge_library)
        .update({
          title: data.title,
          category: data.category,
          content: data.content,
          tags: data.tags,
          last_accessed: now(),
          decay_tier: "hot",
        })
        .eq("id", existing.id);
      if (error) throw pgError("upsertLibraryDoc update", error);
      return `Library doc updated: "${data.title}" (v${existing.version + 1})`;
    } else {
      const { error } = await this.client
        .from(this.tables.knowledge_library)
        .insert(
          this.withTenancy({
            slug: data.slug,
            title: data.title,
            category: data.category,
            content: data.content,
            tags: data.tags,
            version: 1,
            decay_tier: "hot",
            last_accessed: now(),
          })
        );
      if (error) throw pgError("upsertLibraryDoc insert", error);
      return `Library doc created: "${data.title}" (v1)`;
    }
  }

  private async readTaxonomySnapshotSources(maxSources: number): Promise<MemoryTaxonomySnapshotSource[]> {
    let factQuery = this.client
      .from(this.tables.extracted_facts)
      .select("id, fact, category, confidence, created_at, updated_at, valid_from")
      .eq("status", "active")
      .is("invalidated_at", null)
      .order("confidence", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(maxSources);
    let sessionQuery = this.client
      .from(this.tables.session_summaries)
      .select("id, summary, topics, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.floor(maxSources / 2)));

    if (this.tenancy.mode === "managed") {
      factQuery = factQuery.eq("api_key_hash", this.tenancy.apiKeyHash);
      sessionQuery = sessionQuery.eq("api_key_hash", this.tenancy.apiKeyHash);
    }

    const [factsRes, sessionsRes] = await Promise.all([factQuery, sessionQuery]);
    if (factsRes.error) throw pgError("readTaxonomySnapshotSources facts", factsRes.error);
    if (sessionsRes.error) throw pgError("readTaxonomySnapshotSources sessions", sessionsRes.error);

    type FactRow = {
      id: string;
      fact: string;
      category?: string | null;
      confidence?: number | null;
      created_at?: string | null;
      updated_at?: string | null;
      valid_from?: string | null;
    };
    type SessionRow = {
      id: string;
      summary: string;
      topics?: string[] | null;
      created_at?: string | null;
    };

    const facts = ((factsRes.data ?? []) as FactRow[]).map((row) => ({
      id: row.id,
      kind: "fact" as const,
      text: row.fact,
      category: row.category ?? undefined,
      confidence: row.confidence ?? null,
      created_at: row.created_at ?? null,
      updated_at: row.updated_at ?? null,
      valid_from: row.valid_from ?? null,
    }));
    const sessions = ((sessionsRes.data ?? []) as SessionRow[]).map((row) => ({
      id: row.id,
      kind: "session" as const,
      text: row.summary,
      category: Array.isArray(row.topics) && row.topics.length > 0 ? row.topics.join(" ") : "session",
      confidence: 0.75,
      created_at: row.created_at ?? null,
      updated_at: row.created_at ?? null,
      valid_from: row.created_at ?? null,
    }));

    return [...facts, ...sessions];
  }

  async refreshTaxonomySnapshots(
    options: MemoryTaxonomySnapshotWriteOptions = {}
  ): Promise<MemoryTaxonomySnapshotWriteResult> {
    const maxSources = Math.max(1, Math.min(250, options.max_sources ?? 80));
    const sources = await this.readTaxonomySnapshotSources(maxSources);
    return writeMemoryTaxonomySnapshotsToLibrary({
      sources,
      options,
      upsertLibraryDoc: (doc) => this.upsertLibraryDoc(doc),
    });
  }

  async manageDecay(): Promise<unknown> {
    return this.rpc("manage_decay", {}, "mc_manage_decay", {});
  }

  async getMemoryStatus(): Promise<unknown> {
    const tableKeys: Array<keyof TableNames> = [
      "business_context",
      "knowledge_library",
      "session_summaries",
      "extracted_facts",
      "conversation_log",
      "code_dumps",
    ];
    const counts: Record<string, unknown> = {};
    for (const tk of tableKeys) {
      let q = this.client.from(this.tables[tk]).select("*", { count: "exact", head: true });
      if (this.tenancy.mode === "managed") {
        q = q.eq("api_key_hash", this.tenancy.apiKeyHash);
      }
      const { count } = await q;
      counts[tk] = count;
    }

    let factTiersQuery = this.client
      .from(this.tables.extracted_facts)
      .select("decay_tier")
      .eq("status", "active");
    if (this.tenancy.mode === "managed") {
      factTiersQuery = factTiersQuery.eq("api_key_hash", this.tenancy.apiKeyHash);
    }
    const { data: factTiers } = await factTiersQuery;

    const tiers = { hot: 0, warm: 0, cold: 0 };
    for (const row of factTiers ?? []) {
      tiers[row.decay_tier as keyof typeof tiers]++;
    }
    return {
      mode: this.tenancy.mode === "managed" ? "supabase-managed" : "supabase-byod",
      table_counts: counts,
      fact_decay_tiers: tiers,
    };
  }
}
