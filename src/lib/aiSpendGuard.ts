// src/lib/aiSpendGuard.ts
//
// AI spend guardrails: provider inventory, cost labels, default-off paid calls.
//
// Closes UnClick todo "AI spend guardrails: provider inventory, cost labels,
// and default-off paid calls".
//
// What it does:
//   1. Defines a Provider registry. Every external paid call site declares its
//      provider, cost class, and whether it's enabled.
//   2. Wraps actual call sites with `withSpendGuard` which checks the registry,
//      enforces default-off for paid endpoints unless explicit env opt-in,
//      and records spend events for downstream telemetry.
//   3. Provides `summariseSpend` for surfacing in admin UI.
//
// Stateless module. Call sites are responsible for passing in `state` if
// they want spend tracked across requests. Tests use an in-memory state.

export type Provider =
  | "openai"
  | "anthropic"
  | "cohere"
  | "mistral"
  | "groq"
  | "togetherai"
  | "replicate"
  | "stability"
  | "elevenlabs"
  | "assemblyai"
  | "deepl"
  | "perplexity"
  | "local" // self-hosted, no spend
  | "unknown";

export type CostClass =
  | "free"        // genuinely zero cost (e.g., local model, free tier under quota)
  | "metered"     // paid per-token / per-request
  | "subscription" // covered under a flat subscription
  | "unknown";    // not yet classified, treat as paid for safety

export interface ProviderEntry {
  provider: Provider;
  /** Human-readable label for the specific call site (e.g., "openai/gpt-4o-mini chat"). */
  label: string;
  cost_class: CostClass;
  /**
   * Default-on means a call here proceeds without an explicit env flag. Free /
   * local calls default to true. Anything metered defaults to false until the
   * relevant env var is set.
   */
  default_enabled: boolean;
  /**
   * Env var that opts this call site in (when default_enabled is false).
   * Convention: `UNCLICK_AISPEND_<PROVIDER>_<SHORT>=1`.
   */
  enable_env: string | null;
  /** Free-text notes for the inventory doc. */
  notes?: string;
}

export interface SpendEvent {
  call_id: string;
  provider: Provider;
  label: string;
  cost_class: CostClass;
  allowed: boolean;
  blocked_reason: string | null;
  emitted_at: string;
}

export interface SpendState {
  events: SpendEvent[];
  /** Total counts by cost class (allowed only). */
  counts: Record<CostClass, number>;
}

export function createSpendState(): SpendState {
  return {
    events: [],
    counts: { free: 0, metered: 0, subscription: 0, unknown: 0 },
  };
}

// --- Provider registry ---

const DEFAULT_REGISTRY: ProviderEntry[] = [
  {
    provider: "anthropic",
    label: "anthropic/claude messages",
    cost_class: "metered",
    default_enabled: false,
    enable_env: "UNCLICK_AISPEND_ANTHROPIC_MESSAGES",
    notes: "Pay-per-token. Disable for tests by default.",
  },
  {
    provider: "openai",
    label: "openai/chat-completion",
    cost_class: "metered",
    default_enabled: false,
    enable_env: "UNCLICK_AISPEND_OPENAI_CHAT",
  },
  {
    provider: "openai",
    label: "openai/embedding",
    cost_class: "metered",
    default_enabled: false,
    enable_env: "UNCLICK_AISPEND_OPENAI_EMBED",
  },
  {
    provider: "cohere",
    label: "cohere/embed-or-rerank",
    cost_class: "metered",
    default_enabled: false,
    enable_env: "UNCLICK_AISPEND_COHERE",
  },
  {
    provider: "groq",
    label: "groq/chat-completion",
    cost_class: "metered",
    default_enabled: false,
    enable_env: "UNCLICK_AISPEND_GROQ",
    notes: "Often free-tier in practice but classed metered for safety.",
  },
  {
    provider: "replicate",
    label: "replicate/prediction",
    cost_class: "metered",
    default_enabled: false,
    enable_env: "UNCLICK_AISPEND_REPLICATE",
  },
  {
    provider: "stability",
    label: "stability/image-gen",
    cost_class: "metered",
    default_enabled: false,
    enable_env: "UNCLICK_AISPEND_STABILITY",
  },
  {
    provider: "elevenlabs",
    label: "elevenlabs/tts",
    cost_class: "metered",
    default_enabled: false,
    enable_env: "UNCLICK_AISPEND_ELEVENLABS",
  },
  {
    provider: "assemblyai",
    label: "assemblyai/transcribe",
    cost_class: "metered",
    default_enabled: false,
    enable_env: "UNCLICK_AISPEND_ASSEMBLYAI",
  },
  {
    provider: "local",
    label: "local/ollama",
    cost_class: "free",
    default_enabled: true,
    enable_env: null,
    notes: "Self-hosted; no per-call cost.",
  },
];

export function getDefaultRegistry(): ProviderEntry[] {
  return DEFAULT_REGISTRY.map((e) => ({ ...e }));
}

export function findRegistryEntry(
  registry: ReadonlyArray<ProviderEntry>,
  predicate: { provider?: Provider; label?: string },
): ProviderEntry | null {
  for (const e of registry) {
    if (predicate.label && e.label === predicate.label) return e;
    if (predicate.provider && !predicate.label && e.provider === predicate.provider) return e;
  }
  return null;
}

// --- Guard ---

export interface GuardOptions {
  /** Override the default registry. Useful for tests. */
  registry?: ReadonlyArray<ProviderEntry>;
  /** Override env lookup. Useful for tests; defaults to process.env. */
  env?: Record<string, string | undefined>;
  /** State to record spend events into. If omitted, no recording. */
  state?: SpendState;
  /** Forced override. Caller asserts the call is allowed, such as an explicit user-greenlit one-shot. */
  force_allow?: boolean;
}

export interface GuardDecision {
  allowed: boolean;
  reason: string;
  entry: ProviderEntry | null;
}

export function evaluateGuard(
  call: { provider?: Provider; label?: string; call_id?: string },
  options: GuardOptions = {},
): GuardDecision {
  const registry = options.registry ?? DEFAULT_REGISTRY;
  const env = options.env ?? process.env;
  const entry = findRegistryEntry(registry, call);

  if (options.force_allow) {
    return { allowed: true, reason: "force_allow", entry };
  }

  if (!entry) {
    // Default-deny unknown call sites, safer to fail loud.
    return {
      allowed: false,
      reason: "no_registry_entry",
      entry: null,
    };
  }

  if (entry.cost_class === "free" || entry.cost_class === "subscription") {
    return { allowed: entry.default_enabled, reason: entry.default_enabled ? "default_enabled" : "explicit_disabled", entry };
  }

  // Metered / unknown, require env opt-in.
  if (entry.default_enabled) {
    return { allowed: true, reason: "registry_default_enabled", entry };
  }
  if (entry.enable_env && env[entry.enable_env] === "1") {
    return { allowed: true, reason: "env_opt_in", entry };
  }
  return {
    allowed: false,
    reason: entry.enable_env ? `requires_env_${entry.enable_env}=1` : "metered_no_opt_in_env",
    entry,
  };
}

/**
 * Wrap a call site. When `evaluateGuard` returns allowed:false, `fn` is NOT
 * invoked and the returned promise rejects with a `SpendGuardError`.
 */
export async function withSpendGuard<T>(
  call: { provider?: Provider; label?: string; call_id?: string },
  fn: () => Promise<T>,
  options: GuardOptions = {},
): Promise<T> {
  const decision = evaluateGuard(call, options);
  const event: SpendEvent = {
    call_id: call.call_id ?? `${decision.entry?.provider ?? call.provider ?? "unknown"}-${Date.now()}`,
    provider: decision.entry?.provider ?? call.provider ?? "unknown",
    label: decision.entry?.label ?? call.label ?? "unlabelled",
    cost_class: decision.entry?.cost_class ?? "unknown",
    allowed: decision.allowed,
    blocked_reason: decision.allowed ? null : decision.reason,
    emitted_at: new Date().toISOString(),
  };
  if (options.state) {
    options.state.events.push(event);
    if (decision.allowed) {
      options.state.counts[event.cost_class] = (options.state.counts[event.cost_class] ?? 0) + 1;
    }
  }
  if (!decision.allowed) {
    throw new SpendGuardError(`AI spend guard blocked ${event.label}: ${decision.reason}`, decision.reason, event);
  }
  return await fn();
}

export class SpendGuardError extends Error {
  code: string;
  event: SpendEvent;
  constructor(message: string, code: string, event: SpendEvent) {
    super(message);
    this.name = "SpendGuardError";
    this.code = code;
    this.event = event;
  }
}

// --- Reporting ---

export interface SpendSummary {
  total_calls: number;
  allowed: number;
  blocked: number;
  by_cost_class: Record<CostClass, number>;
  by_provider: Record<string, number>;
  recent_blocked: SpendEvent[];
}

export function summariseSpend(state: SpendState, recentBlockedLimit = 10): SpendSummary {
  const total_calls = state.events.length;
  const allowed = state.events.filter((e) => e.allowed).length;
  const blocked = total_calls - allowed;
  const by_provider: Record<string, number> = {};
  for (const e of state.events) {
    if (!e.allowed) continue;
    by_provider[e.provider] = (by_provider[e.provider] ?? 0) + 1;
  }
  const recent_blocked = state.events.filter((e) => !e.allowed).slice(-recentBlockedLimit);
  return {
    total_calls,
    allowed,
    blocked,
    by_cost_class: { ...state.counts },
    by_provider,
    recent_blocked,
  };
}

export const __testing__ = { DEFAULT_REGISTRY };
