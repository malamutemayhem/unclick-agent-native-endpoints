/**
 * Conflict detection for UnClick Memory.
 *
 * Competing memory servers (Mem0, Zep, Hindsight, etc) running alongside
 * UnClick cause duplicate facts and mixed-up responses. This module:
 *
 *   1. Exposes KNOWN_CONFLICTS - a static list of competing tools + how to
 *      remove them on each major platform
 *   2. detectConflicts(toolNames) - matches a list of tool names against the
 *      known patterns and returns the conflict records that matched
 *   3. buildConflictWarning(conflicts) - renders the friendly amber warning
 *      that gets prepended to load_memory responses
 *   4. reportConflictDetection(tool) - fire-and-forget logging to the admin
 *      API so the admin panel can show conflict history
 *
 * All messaging follows the brand voice: "we noticed" / "we recommend",
 * never "WARNING" or "You must".
 */

type RemoveInstructions = Record<string, string>;

export interface ConflictDef {
  name: string;
  toolPatterns: string[];
  removeInstructions: RemoveInstructions;
}

const GENERIC_REMOVE: RemoveInstructions = {
  "claude-code": "claude mcp remove <tool>",
  cursor: "Settings > Tools & MCP > find the entry > remove",
  windsurf: "Remove the entry from ~/.codeium/windsurf/mcp_config.json",
  copilot: "Remove from VS Code settings.json MCP servers section",
  chatgpt: "Settings > Tools > remove the entry",
};

export const KNOWN_CONFLICTS: ConflictDef[] = [
  {
    name: "Mem0",
    toolPatterns: ["add-memory", "search-memories", "add_memory", "search_memory_mem0"],
    removeInstructions: {
      "claude-code": "claude mcp remove mem0",
      cursor: "Settings > Tools & MCP > find mem0 > remove",
      windsurf: "Remove the mem0 entry from ~/.codeium/windsurf/mcp_config.json",
      copilot: "Remove the mem0 block from VS Code settings.json",
      chatgpt: "Settings > Tools > remove mem0",
    },
  },
  {
    name: "Zep",
    toolPatterns: ["zep_memory", "graphiti_"],
    removeInstructions: {
      "claude-code": "claude mcp remove zep",
      cursor: "Settings > Tools & MCP > find zep > remove",
      windsurf: "Remove the zep entry from ~/.codeium/windsurf/mcp_config.json",
      copilot: "Remove the zep block from VS Code settings.json",
      chatgpt: "Settings > Tools > remove zep",
    },
  },
  {
    name: "Hindsight",
    toolPatterns: ["hindsight_"],
    removeInstructions: {
      ...GENERIC_REMOVE,
      "claude-code": "claude mcp remove hindsight",
    },
  },
  {
    name: "MemPalace",
    toolPatterns: ["mempalace_"],
    removeInstructions: {
      ...GENERIC_REMOVE,
      "claude-code": "claude mcp remove mempalace",
    },
  },
  {
    name: "mcp-memory-service",
    toolPatterns: ["save_memory", "retrieve_memory", "search_memories"],
    removeInstructions: {
      ...GENERIC_REMOVE,
      "claude-code": "claude mcp remove memory-service",
    },
  },
  {
    name: "Basic Memory",
    toolPatterns: ["basic_memory_"],
    removeInstructions: {
      ...GENERIC_REMOVE,
      "claude-code": "claude mcp remove basic-memory",
    },
  },
  {
    name: "LangMem",
    toolPatterns: ["langmem_"],
    removeInstructions: {
      ...GENERIC_REMOVE,
      "claude-code": "claude mcp remove langmem",
    },
  },
];

/**
 * Match a list of tool names from the active MCP session against KNOWN_CONFLICTS.
 * Tool names that don't match any known pattern are ignored silently - non-memory
 * tools like GitHub, Slack, Exa, Playwright etc are safe to run alongside UnClick.
 *
 * UnClick's own tool names (prefixed with unclick_ or memory.) never trigger a
 * match even if they happen to overlap a pattern.
 */
const UNCLICK_OWN_TOOLS = new Set([
  "get_startup_context",
  "write_session_summary",
  "add_fact",
  "search_memory",
  "set_business_context",
  "report_bug",
]);

export function detectConflicts(toolNames: readonly string[]): ConflictDef[] {
  if (!Array.isArray(toolNames) || toolNames.length === 0) return [];
  const names = toolNames
    .map((n) => String(n ?? "").toLowerCase().trim())
    .filter(
      (n) =>
        n.length > 0 &&
        !n.startsWith("unclick_") &&
        !n.startsWith("memory.") &&
        !UNCLICK_OWN_TOOLS.has(n),
    );

  if (names.length === 0) return [];

  const matched: ConflictDef[] = [];
  const seen = new Set<string>();
  for (const conflict of KNOWN_CONFLICTS) {
    const patterns = conflict.toolPatterns.map((p) => p.toLowerCase());
    const hit = names.some((name) =>
      patterns.some((p) => (p.endsWith("_") ? name.startsWith(p) : name === p || name.includes(p)))
    );
    if (hit && !seen.has(conflict.name)) {
      matched.push(conflict);
      seen.add(conflict.name);
    }
  }
  return matched;
}

function formatRemoveInstructions(instr: RemoveInstructions): string {
  const lines: string[] = [];
  if (instr["claude-code"]) lines.push(`  - Claude Code: ${instr["claude-code"]}`);
  if (instr.cursor) lines.push(`  - Cursor: ${instr.cursor}`);
  if (instr.windsurf) lines.push(`  - Windsurf: ${instr.windsurf}`);
  if (instr.copilot) lines.push(`  - Copilot: ${instr.copilot}`);
  if (instr.chatgpt) lines.push(`  - ChatGPT: ${instr.chatgpt}`);
  return lines.join("\n");
}

/**
 * Build the human-readable amber warning shown at the top of a load_memory
 * response when conflicts are detected. Returns null when there are no
 * conflicts.
 *
 * detectionCount lets us escalate tone if the same conflict has been flagged
 * several times already. After 7+ silent detections we stop warning entirely
 * (respect the user's choice).
 */
export function buildConflictWarning(
  conflicts: ConflictDef[],
  detectionCount = 0,
): string | null {
  if (conflicts.length === 0) return null;
  if (detectionCount >= 7) return null;

  const names = conflicts.map((c) => c.name).join(", ");
  const opener =
    detectionCount >= 3
      ? `Heads up: ${names} is still connected alongside UnClick and this is still causing duplicates.`
      : `Heads up: we noticed you also have ${names} connected.`;

  const lines = [
    opener,
    "",
    "Running two memory tools at the same time causes duplicate facts and mixed-up responses.",
    `We recommend turning off ${names} so UnClick can give you the best experience.`,
    "",
    "Your other tools (GitHub, Exa, browser, file system, etc) are fine - they don't overlap with UnClick.",
    "",
  ];

  for (const conflict of conflicts) {
    lines.push(`To remove ${conflict.name}:`);
    lines.push(formatRemoveInstructions(conflict.removeInstructions));
    lines.push("");
  }

  return lines.join("\n").trim();
}

const CONFLICT_API_BASE =
  process.env.UNCLICK_MEMORY_BASE_URL || process.env.UNCLICK_SITE_URL || "https://unclick.world";

interface ConflictReportResult {
  shouldWarn: boolean;
  detectionCount: number;
}

/**
 * Log a conflict detection to the admin API and return whether we should
 * actually surface a warning (throttled to once per 24h per tool per user).
 * Fire-and-forget safe: if the API is unreachable we default to "warn once".
 */
export async function reportConflictDetection(
  tool: string,
  platform?: string,
): Promise<ConflictReportResult> {
  const apiKey = process.env.UNCLICK_API_KEY;
  if (!apiKey) {
    return { shouldWarn: true, detectionCount: 0 };
  }

  try {
    const res = await fetch(`${CONFLICT_API_BASE}/api/memory-admin?action=conflict_detect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ tool, platform }),
    });
    if (!res.ok) return { shouldWarn: true, detectionCount: 0 };
    const data = (await res.json()) as { should_warn?: boolean; detection_count?: number };
    return {
      shouldWarn: data.should_warn !== false,
      detectionCount: typeof data.detection_count === "number" ? data.detection_count : 0,
    };
  } catch {
    return { shouldWarn: true, detectionCount: 0 };
  }
}
