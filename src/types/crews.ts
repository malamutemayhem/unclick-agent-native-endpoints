export type AgentCategory =
  | "business"
  | "creative"
  | "technical"
  | "thinking"
  | "domain"
  | "lifestyle"
  | "meta";

export type CrewPattern =
  | "council"
  | "six_modes"
  | "pre_mortem"
  | "red_blue"
  | "editorial"
  | "debate_circle";

export interface MockAgent {
  slug: string;
  name: string;
  category: AgentCategory;
  hook: string;
  description: string;
  tool_tags: string[];
  icon: string;
  colour_token: string;
  is_system: true;
}

export interface Agent {
  id: string;
  slug: string;
  name: string;
  category: AgentCategory;
  hook: string;
  description: string;
  tool_tags: string[];
  icon: string;
  colour_token: string;
  is_system: boolean;
  source_agent_id: string | null;
  api_key_hash: string | null;
}

export interface CrewTemplate {
  slug: string;
  name: string;
  hook: string;
  description: string;
  use_when: string;
  hat_count: number;
  pattern: CrewPattern;
  icon: string;
}

export interface StarterCrew {
  id: string;
  name: string;
  description: string;
  agent_slugs: string[];
  template_slug: string;
  example_prompt: string;
}

export interface ComposedCrew {
  id: string;
  name: string;
  agents: MockAgent[];
  template_slug: string;
  created_at: string;
}
