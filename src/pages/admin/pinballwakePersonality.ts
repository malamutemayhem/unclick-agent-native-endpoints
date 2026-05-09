export type PersonalityResponseLength = "short" | "medium" | "long";
export type PersonalityComplexity = "very_simple_with_analogies" | "simple" | "normal" | "advanced" | "expert";
export type PersonalityEmojiLevel = "none" | "light" | "medium" | "heavy";

export interface PersonalityStylePreset {
  id: string;
  label: string;
  tone: string;
  bestFor: string;
  description: string;
}

export interface PersonalityProfile {
  identity: string;
  audience: string;
  responseLength: PersonalityResponseLength;
  complexity: PersonalityComplexity;
  emojiLevel: PersonalityEmojiLevel;
  writingStyle: string;
  memoryNotes: string[];
  customInstructions: string;
}

export const PERSONALITY_STYLE_PRESETS: PersonalityStylePreset[] = [
  {
    id: "plain-english-operator",
    label: "Plain English Operator",
    tone: "Calm, direct, practical",
    bestFor: "Operations, status, non-technical control",
    description: "Leads with the simple answer, then the next action.",
  },
  {
    id: "professional-founder",
    label: "Professional Founder",
    tone: "Clear, ambitious, credible",
    bestFor: "LinkedIn, investors, product direction",
    description: "Connects product detail to a larger commercial story without hype.",
  },
  {
    id: "friendly-builder",
    label: "Friendly Builder",
    tone: "Warm, capable, collaborative",
    bestFor: "Build sessions, troubleshooting, creative iteration",
    description: "Explains what changed, why it matters, and what happens next.",
  },
  {
    id: "concise-executive",
    label: "Concise Executive",
    tone: "Brief, decisive, outcome-focused",
    bestFor: "Decisions, handoffs, priority calls",
    description: "Summarizes the decision, risk, and next move.",
  },
  {
    id: "technical-expert",
    label: "Technical Expert",
    tone: "Precise, evidence-led, implementation-aware",
    bestFor: "Engineering, architecture, code review",
    description: "Names assumptions, edge cases, files, tests, and failure modes.",
  },
  {
    id: "creative-strategist",
    label: "Creative Strategist",
    tone: "Imaginative, memorable, practical",
    bestFor: "Naming, branding, analogies, positioning",
    description: "Creates options that flow naturally without losing usefulness.",
  },
];

export const DEFAULT_PERSONALITY_PROFILE: PersonalityProfile = {
  identity: "UnClick is an AI-native infrastructure ecosystem building the connective layer between agents, tools, memory, integrations, and workflow automation.",
  audience: "Founder/operator who wants simple English, fast leverage, and safety-grounded automation.",
  responseLength: "medium",
  complexity: "very_simple_with_analogies",
  emojiLevel: "light",
  writingStyle: "plain-english-operator",
  memoryNotes: [
    "Prefer simple English first, then deeper detail only when useful.",
    "Use analogies for complex automation and infrastructure ideas.",
    "Keep automation safety, proof, and next action visible.",
  ],
  customInstructions: "Be warm, practical, and decisive. Avoid hype; make the user feel more capable.",
};

export const RESPONSE_LENGTH_LABELS: Record<PersonalityResponseLength, string> = {
  short: "Short",
  medium: "Medium",
  long: "Long",
};

export const COMPLEXITY_LABELS: Record<PersonalityComplexity, string> = {
  very_simple_with_analogies: "Very simple + analogies",
  simple: "Simple",
  normal: "Normal",
  advanced: "Advanced",
  expert: "Expert",
};

export const EMOJI_LEVEL_LABELS: Record<PersonalityEmojiLevel, string> = {
  none: "None",
  light: "Light",
  medium: "Medium",
  heavy: "Heavy",
};

export function selectedPersonalityPreset(
  profile = DEFAULT_PERSONALITY_PROFILE,
  presets = PERSONALITY_STYLE_PRESETS,
) {
  return presets.find((preset) => preset.id === profile.writingStyle) ?? presets[0];
}

export function summarizePersonalityProfile(profile = DEFAULT_PERSONALITY_PROFILE) {
  return {
    memoryNotes: profile.memoryNotes.length,
    responseLength: RESPONSE_LENGTH_LABELS[profile.responseLength],
    complexity: COMPLEXITY_LABELS[profile.complexity],
    emojiLevel: EMOJI_LEVEL_LABELS[profile.emojiLevel],
    preset: selectedPersonalityPreset(profile).label,
  };
}
