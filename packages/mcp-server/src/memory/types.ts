/**
 * Shared types for UnClick Memory backends (local + Supabase).
 */

export interface SessionSummaryInput {
  session_id: string;
  summary: string;
  topics: string[];
  open_loops: string[];
  decisions: string[];
  platform: string;
  duration_minutes?: number;
}

export interface FactInput {
  fact: string;
  category: string;
  confidence: number;
  source_session_id?: string;
  startup_fact_kind?: StartupFactKind;
  // Bi-temporal + provenance (Chunk 2)
  valid_from?: string;
  extractor_id?: string;
  prompt_version?: string;
  model_id?: string;
  preserve_as_blob?: boolean;
  // Git linkage (Anti-Stomp)
  commit_sha?: string;
  pr_number?: number;
}

export type StartupFactKind = "durable" | "operational" | "excluded" | "legacy_unspecified";

export type MemoryProfileCardSourceKind = "business_context" | "fact" | "session_summary";
export type MemoryReceiptRedactionState = "clean" | "redacted" | "sensitive-hidden" | "blocked";

export interface MemoryProfileCardReceipt {
  memory_id: string;
  source_kind: MemoryProfileCardSourceKind;
  source_uri: string;
  confidence?: number;
  redaction_state: MemoryReceiptRedactionState;
  last_verified_at?: string | null;
}

export interface MemoryProfileCard {
  profile_summary: string[];
  working_now: string[];
  do_not_repeat: string[];
  timezone_context?: string;
  memory_health: string[];
  source_receipts: MemoryProfileCardReceipt[];
}

export interface MemoryRetrievalPlanStep {
  step: number;
  layer: string;
  use: string;
}

export interface MemoryRetrievalPlan {
  mode: "cheap_first";
  startup_order: string[];
  steps: MemoryRetrievalPlanStep[];
  source_lookup: string;
  semantic_lookup: string;
}

export interface InvalidateFactInput {
  fact_id: string;
  reason?: string;
  session_id?: string;
}

export interface ConversationInput {
  session_id: string;
  role: string;
  content: string;
  has_code: boolean;
}

export interface ConversationReceipt {
  logged: true;
  session_id: string;
  role: string;
  receipt_id: string;
}

export interface CodeInput {
  session_id: string;
  language: string;
  filename?: string;
  content: string;
  description?: string;
}

export interface LibraryDocInput {
  slug: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
}

export type MemoryTaxonomySourceKind = "fact" | "session";

export interface MemoryTaxonomySnapshotSource {
  id: string;
  kind: MemoryTaxonomySourceKind;
  text: string;
  category?: string;
  confidence?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  valid_from?: string | null;
}

export interface MemoryTaxonomySnapshotSourceReceipt {
  memory_id: string;
  source_kind: MemoryTaxonomySourceKind;
  source_uri: string;
  confidence?: number | null;
  redaction_state: MemoryReceiptRedactionState;
  last_verified_at?: string | null;
}

export interface MemoryTaxonomySnapshot {
  slug: string;
  title: string;
  primary_category: string;
  secondary_categories: string[];
  sub_tags: string[];
  summary: string;
  content: string;
  source_ids: string[];
  sources: Array<{ id: string; kind: MemoryTaxonomySourceKind }>;
  source_receipts: MemoryTaxonomySnapshotSourceReceipt[];
  confidence: number;
  weight: number;
  last_confirmed_at: string | null;
}

export interface MemoryTaxonomySnapshotWriteOptions {
  dry_run?: boolean;
  max_sources?: number;
  max_snapshots?: number;
  max_sources_per_snapshot?: number;
}

export interface MemoryTaxonomySnapshotWriteResult {
  dry_run: boolean;
  generated_at: string;
  source_count: number;
  snapshot_count: number;
  written_count: number;
  snapshots: Array<{
    slug: string;
    title: string;
    primary_category: string;
    source_ids: string[];
    source_receipts: MemoryTaxonomySnapshotSourceReceipt[];
  }>;
  written: Array<{
    slug: string;
    title: string;
    message: string;
  }>;
}

export interface MemoryBackend {
  /** Load startup context (business context + recent sessions + hot facts). */
  getStartupContext(numSessions: number): Promise<unknown>;

  /** Full-text / hybrid search across facts and session summaries. */
  searchMemory(query: string, maxResults: number, asOf?: string): Promise<unknown>;

  /** Search extracted facts. */
  searchFacts(query: string): Promise<unknown>;

  /** Search knowledge library. */
  searchLibrary(query: string): Promise<unknown>;

  /** Get a specific library doc by slug. */
  getLibraryDoc(slug: string): Promise<unknown>;

  /** List all library documents. */
  listLibrary(): Promise<unknown>;

  /** Write end-of-session summary. */
  writeSessionSummary(data: SessionSummaryInput): Promise<{ id: string }>;

  /** Add an extracted fact. */
  addFact(data: FactInput): Promise<{ id: string }>;

  /** Replace a fact with a new version. */
  supersedeFact(oldId: string, newText: string, category?: string, confidence?: number): Promise<string>;

  /** Log a conversation message. */
  logConversation(data: ConversationInput): Promise<ConversationReceipt>;

  /** Get full conversation log for a session. */
  getConversationDetail(sessionId: string): Promise<unknown>;

  /** Store a code block. */
  storeCode(data: CodeInput): Promise<{ id: string }>;

  /** Get all business context entries. */
  getBusinessContext(): Promise<unknown[]>;

  /** Set or update a business context entry. */
  setBusinessContext(category: string, key: string, value: unknown, priority?: number): Promise<void>;

  /** Create or update a knowledge library doc. */
  upsertLibraryDoc(data: LibraryDocInput): Promise<string>;

  /** Build and store source-linked taxonomy snapshots in the Library. */
  refreshTaxonomySnapshots(options?: MemoryTaxonomySnapshotWriteOptions): Promise<MemoryTaxonomySnapshotWriteResult>;

  /** Run memory decay management. */
  manageDecay(): Promise<unknown>;

  /** Get memory usage stats. */
  getMemoryStatus(): Promise<unknown>;

  /** Mark a fact as invalidated (does not delete it). Writes an audit row. */
  invalidateFact(input: InvalidateFactInput): Promise<{ invalidated_at: string }>;
}
