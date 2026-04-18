/**
 * Starter agent templates and the canonical list of memory layers.
 *
 * tool_slugs map to platform_connectors.id values. Connectors that don't exist
 * in the catalogue are silently skipped at create time.
 */

export type MemoryLayerKey =
  | "business_context"
  | "extracted_facts"
  | "session_summaries"
  | "knowledge_library"
  | "conversation_log"
  | "code_dumps";

export const MEMORY_LAYERS: { key: MemoryLayerKey; label: string; hint: string }[] = [
  {
    key: "business_context",
    label: "Identity",
    hint: "Who you are, business context, standing rules.",
  },
  {
    key: "extracted_facts",
    label: "Facts",
    hint: "Things you've told the AI before.",
  },
  {
    key: "session_summaries",
    label: "Sessions",
    hint: "Past conversation summaries.",
  },
  {
    key: "knowledge_library",
    label: "Library",
    hint: "Uploaded documents and reference material.",
  },
  {
    key: "conversation_log",
    label: "Logs",
    hint: "Full conversation history (heavy).",
  },
  {
    key: "code_dumps",
    label: "Code",
    hint: "Stored code snippets from past sessions.",
  },
];

interface AgentTemplate {
  name: string;
  role: string;
  description: string;
  system_prompt: string;
  tool_slugs: string[];
  memory_layers: MemoryLayerKey[];
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    name: "Researcher",
    role: "researcher",
    description: "Finds info, summarises, cites sources.",
    system_prompt:
      "You are a research assistant. Find accurate information, summarise clearly, and always cite sources. Ask clarifying questions before starting a search. Prefer recent sources over old ones.",
    tool_slugs: [
      "google",
      "guardian",
      "newsapi",
      "wikipedia",
      "reddit",
      "arxiv",
      "pubmed",
    ],
    memory_layers: [
      "business_context",
      "extracted_facts",
      "session_summaries",
      "knowledge_library",
      "conversation_log",
      "code_dumps",
    ],
  },
  {
    name: "Developer",
    role: "developer",
    description: "Reviews code, suggests fixes, runs tests.",
    system_prompt:
      "You are a code assistant. Write clean, well-commented code. Follow the project's existing style. Run tests before saying you're done. Explain your changes clearly.",
    tool_slugs: ["github", "vercel", "supabase", "cloudflare", "circleci", "datadog"],
    memory_layers: [
      "business_context",
      "extracted_facts",
      "session_summaries",
      "knowledge_library",
      "conversation_log",
      "code_dumps",
    ],
  },
  {
    name: "Writer",
    role: "writer",
    description: "Writes content, matches tone, proofreads.",
    system_prompt:
      "You are a writing assistant. Match the user's voice and tone. Keep things clear and concise. No jargon unless the audience expects it. Always proofread before delivering.",
    tool_slugs: ["guardian", "newsapi", "wikipedia", "convertkit", "anthropic", "cohere"],
    memory_layers: [
      "business_context",
      "extracted_facts",
      "session_summaries",
      "knowledge_library",
      "conversation_log",
      "code_dumps",
    ],
  },
  {
    name: "Organiser",
    role: "organiser",
    description: "Tracks tasks, deadlines, status.",
    system_prompt:
      "You are a task organiser. Help prioritise work, track deadlines, and keep projects moving. Summarise status clearly. Flag blockers early.",
    tool_slugs: [
      "calendly",
      "clickup",
      "asana",
      "clockify",
      "discord",
      "slack",
      "telegram",
    ],
    memory_layers: [
      "business_context",
      "extracted_facts",
      "session_summaries",
      "knowledge_library",
      "conversation_log",
      "code_dumps",
    ],
  },
];
