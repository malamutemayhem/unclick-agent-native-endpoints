import type { StarterCrew } from "@/types/crews";

export const STARTER_CREWS: StarterCrew[] = [
  {
    id: "business-council",
    name: "Business Council",
    description:
      "CEO, CFO, CMO, CTO, and Creative Director deliberate your business decision together. Each brings their own lens. The Chairman synthesises.",
    agent_slugs: ["ceo", "cfo", "cmo", "cto", "cco-creative"],
    template_slug: "council",
    example_prompt:
      "Should I take on a retainer client at 50 percent of my usual rate to fill a slow quarter?",
  },
  {
    id: "launch-stress-test",
    name: "Launch Stress Test",
    description:
      "A Contrarian, Security Engineer, Growth Hacker, and Customer Success Manager attack and defend your launch plan. Red attacks, blue defends, white scores.",
    agent_slugs: ["contrarian", "security-engineer", "growth-hacker", "csm"],
    template_slug: "red_blue",
    example_prompt:
      "Stress test my TestPass public launch plan for June.",
  },
  {
    id: "creative-studio",
    name: "Creative Studio",
    description:
      "Creative Director, Copywriter, Art Director, and Brand Strategist collaborate on your brief. Draft, shape, verify, stress-test.",
    agent_slugs: ["creative-director", "copywriter", "art-director", "brand-strategist"],
    template_slug: "editorial",
    example_prompt:
      "Draft the homepage headline for unclick.world.",
  },
  {
    id: "decision-desk",
    name: "Decision Desk",
    description:
      "First Principles Thinker, Pragmatist, Outsider, Executor, and Chairman reason through your decision from five independent angles.",
    agent_slugs: ["first-principles", "pragmatist", "outsider", "executor", "chairman"],
    template_slug: "council",
    example_prompt:
      "Should UnClick Pro be priced at 19, 29, or 39 AUD per month?",
  },
];
