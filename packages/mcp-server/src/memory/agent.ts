/**
 * Agent profile resolver for the MCP server.
 *
 * Calls the central UnClick API (admin_agent_resolve) to fetch the active
 * agent's persona, scoped tools, and scoped memory layers. When no agent
 * exists for the user, returns null and the server falls back to default
 * behaviour (all tools, all memory layers).
 */

const MEMORY_API_BASE =
  process.env.UNCLICK_MEMORY_BASE_URL || process.env.UNCLICK_SITE_URL || "https://unclick.world";

export type MemoryLayerKey =
  | "business_context"
  | "extracted_facts"
  | "session_summaries"
  | "knowledge_library"
  | "conversation_log"
  | "code_dumps";

export interface AgentProfile {
  id: string;
  name: string;
  slug: string;
  role: string;
  description: string | null;
  system_prompt: string | null;
  is_default: boolean;
}

export interface ResolvedAgent {
  agent: AgentProfile;
  enabled_tools: string[]; // connector_ids; empty = all allowed
  enabled_memory_layers: MemoryLayerKey[]; // empty = all allowed
}

interface ResolveResponse {
  agent: AgentProfile | null;
  tools: Array<{ connector_id: string; is_enabled: boolean }>;
  memory_scope: Array<{ memory_layer: string; is_enabled: boolean }>;
}

export async function resolveAgent(opts: {
  agent_slug?: string;
  agent_id?: string;
}): Promise<ResolvedAgent | null> {
  const apiKey = process.env.UNCLICK_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams();
  if (opts.agent_slug) params.set("agent_slug", opts.agent_slug);
  if (opts.agent_id) params.set("agent_id", opts.agent_id);
  const qs = params.toString();
  const url = `${MEMORY_API_BASE}/api/memory-admin?action=admin_agent_resolve${
    qs ? `&${qs}` : ""
  }`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ResolveResponse;
    if (!data.agent) return null;

    const enabledTools = (data.tools ?? [])
      .filter((t) => t.is_enabled)
      .map((t) => t.connector_id);

    const enabledLayers = (data.memory_scope ?? [])
      .filter((l) => l.is_enabled)
      .map((l) => l.memory_layer as MemoryLayerKey);

    return {
      agent: data.agent,
      enabled_tools: enabledTools,
      enabled_memory_layers: enabledLayers,
    };
  } catch {
    return null;
  }
}

const ALL_LAYERS: MemoryLayerKey[] = [
  "business_context",
  "extracted_facts",
  "session_summaries",
  "knowledge_library",
  "conversation_log",
  "code_dumps",
];

/**
 * Strip memory layer keys from a startup-context response that the active
 * agent isn't allowed to see. When enabledLayers is empty we treat that as
 * "all layers" (backward compatible default).
 */
export function filterContextByLayers(
  context: unknown,
  enabledLayers: MemoryLayerKey[]
): unknown {
  if (enabledLayers.length === 0 || !context || typeof context !== "object") return context;
  const blocked = ALL_LAYERS.filter((l) => !enabledLayers.includes(l));
  const out: Record<string, unknown> = { ...(context as Record<string, unknown>) };
  for (const layer of blocked) {
    delete out[layer];
  }
  return out;
}
