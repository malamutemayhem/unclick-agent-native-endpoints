import type { CrewTemplate } from "@/types/crews";

export const CREW_TEMPLATES: CrewTemplate[] = [
  {
    slug: "council",
    name: "Council",
    hook: "Four advisors, one chairman, one answer.",
    description:
      "Fan your question to four advisors in parallel. They peer-review each other anonymously. A chairman synthesises all views into one final answer. Defeats sycophancy by design.",
    use_when: "Use when you need 5 experts to argue a decision then agree.",
    hat_count: 5,
    pattern: "council",
    icon: "users-round",
  },
  {
    slug: "six_modes",
    name: "Six Modes",
    hook: "Six lenses on the same problem.",
    description:
      "Six agents each take one mode: facts, feelings, risks, benefits, creativity, and process. The Blue hat orchestrates the sequence. Named after de Bono's thinking framework, shipped under a neutral name.",
    use_when:
      "Use when you want a balanced view across facts, risks, benefits, creativity, feelings, and process.",
    hat_count: 6,
    pattern: "six_modes",
    icon: "layers",
  },
  {
    slug: "pre_mortem",
    name: "Pre-Mortem",
    hook: "Catch what could go wrong before you commit.",
    description:
      "Agents silently write failure scenarios, then share and group them into a risk register. A facilitator consolidates. Gary Klein's pre-mortem technique applied to any plan.",
    use_when: "Use when you want to catch what could go wrong before you commit.",
    hat_count: 5,
    pattern: "pre_mortem",
    icon: "shield-alert",
  },
  {
    slug: "red_blue",
    name: "Red / Blue",
    hook: "Attackers vs defenders. Score. Synthesise.",
    description:
      "Red team attacks the plan, blue team defends it, a white cell scores each round, and a purple debrief extracts what held and what didn't. Standard security-review and launch-readiness practice.",
    use_when: "Use when you want the plan attacked and defended before shipping.",
    hat_count: 4,
    pattern: "red_blue",
    icon: "swords",
  },
  {
    slug: "editorial",
    name: "Editorial Desk",
    hook: "Draft, edit, verify, stress-test.",
    description:
      "A Writer produces a draft, an Editor shapes it, a Fact-Checker verifies every claim, and a Hostile Reader tries to pick it apart. Journalism's standard sign-off flow.",
    use_when:
      "Use when you want a polished piece of writing that has been fact-checked and stress-tested.",
    hat_count: 4,
    pattern: "editorial",
    icon: "newspaper",
  },
  {
    slug: "debate_circle",
    name: "Debate Circle",
    hook: "Three solvers compete. A judge picks the winner.",
    description:
      "Three agents each propose an answer independently, then cross-critique each other for multiple rounds. A judge scores and extracts the best combined answer. Grounded in Du et al. (2023) multi-agent debate research.",
    use_when:
      "Use when there is one right answer and you want three agents to compete for it.",
    hat_count: 4,
    pattern: "debate_circle",
    icon: "message-square",
  },
];
