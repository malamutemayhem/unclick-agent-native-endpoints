#!/usr/bin/env node

import { readFile } from "node:fs/promises";

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function safeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function compactText(value, max = 1000) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

export const RESPONSE_LENGTHS = {
  short: {
    label: "Short",
    instruction: "Keep most answers to one or two short paragraphs unless the user asks for detail.",
  },
  medium: {
    label: "Medium",
    instruction: "Use a concise explanation with enough detail to avoid follow-up confusion.",
  },
  long: {
    label: "Long",
    instruction: "Give a fuller answer with structure, examples, and tradeoffs when useful.",
  },
};

export const COMPLEXITY_LEVELS = {
  very_simple_with_analogies: {
    label: "Very simple with analogies",
    instruction: "Explain in plain language first, then use a concrete analogy for hard ideas.",
  },
  simple: {
    label: "Simple",
    instruction: "Use simple words, short sentences, and avoid unnecessary technical terms.",
  },
  normal: {
    label: "Normal",
    instruction: "Use everyday professional language and define uncommon terms briefly.",
  },
  advanced: {
    label: "Advanced",
    instruction: "Assume a capable operator; include technical detail when it helps decisions.",
  },
  expert: {
    label: "Expert",
    instruction: "Use precise technical language, edge cases, and implementation tradeoffs.",
  },
};

export const EMOJI_LEVELS = {
  none: {
    label: "None",
    instruction: "Do not use emojis.",
    palette: {},
  },
  light: {
    label: "Light",
    instruction: "Use emojis only when they improve scanning, such as status or urgency markers.",
    palette: { pass: "green", watch: "yellow", blocker: "red", working: "blue" },
  },
  medium: {
    label: "Medium",
    instruction: "Use smart status emojis and occasional section markers, but keep business text clean.",
    palette: { pass: "green", watch: "yellow", blocker: "red", working: "blue", proof: "check", build: "tool" },
  },
  heavy: {
    label: "Heavy",
    instruction: "Use expressive emojis for personality and status, while keeping safety/proof text readable.",
    palette: { pass: "green", watch: "yellow", blocker: "red", working: "blue", proof: "check", build: "tool", launch: "rocket" },
  },
};

export const WRITING_STYLE_PRESETS = {
  plain_english_operator: {
    label: "Plain English Operator",
    tone: "calm, direct, practical",
    best_for: "daily operations, status updates, non-technical users",
    instruction: "Lead with the simple answer, then give the next action. Avoid jargon unless it saves time.",
  },
  professional_founder: {
    label: "Professional Founder",
    tone: "clear, ambitious, credible",
    best_for: "LinkedIn, investors, product narrative, team direction",
    instruction: "Sound sharp and commercially grounded without hype. Tie details back to the bigger product direction.",
  },
  friendly_builder: {
    label: "Friendly Builder",
    tone: "warm, capable, collaborative",
    best_for: "product building, troubleshooting, creative iteration",
    instruction: "Be upbeat and useful. Explain what is happening, what changed, and the safest next step.",
  },
  concise_executive: {
    label: "Concise Executive",
    tone: "brief, decisive, outcome-focused",
    best_for: "high-level decisions, priority calls, handoffs",
    instruction: "Summarize the decision, risk, and next move. Keep supporting detail short.",
  },
  technical_expert: {
    label: "Technical Expert",
    tone: "precise, evidence-led, implementation-aware",
    best_for: "engineering, architecture, code review, proofs",
    instruction: "Name assumptions, edge cases, files, tests, and failure modes. Do not hide uncertainty.",
  },
  creative_strategist: {
    label: "Creative Strategist",
    tone: "imaginative, memorable, still practical",
    best_for: "naming, branding, analogies, product positioning",
    instruction: "Offer vivid options that flow naturally. Keep the ideas usable, not theatrical.",
  },
};

export const STATUS_SYMBOL_SETS = {
  plain: {
    pass: "PASS",
    watch: "WATCH",
    blocker: "BLOCKER",
    working: "WORKING",
    idle: "IDLE",
    progress: "[####------] 40%",
  },
  traffic_light: {
    pass: "green light",
    watch: "yellow light",
    blocker: "red light",
    working: "blue dot",
    idle: "grey dot",
    progress: "40%",
  },
  expressive: {
    pass: "green light",
    watch: "yellow light",
    blocker: "red alert",
    working: "blue work marker",
    idle: "quiet marker",
    progress: "four-bar progress",
  },
};

function normalizeEnum(value, allowed, fallback) {
  const key = normalize(value);
  return allowed[key] ? key : fallback;
}

function buildStylePrompt({
  identity,
  audience,
  memoryNotes,
  preset,
  responseLength,
  complexity,
  emojiLevel,
  customInstructions,
}) {
  const style = WRITING_STYLE_PRESETS[preset];
  const length = RESPONSE_LENGTHS[responseLength];
  const complexityConfig = COMPLEXITY_LEVELS[complexity];
  const emoji = EMOJI_LEVELS[emojiLevel];

  return [
    `Identity: ${identity}`,
    audience ? `Audience: ${audience}` : "",
    memoryNotes.length ? `Useful context: ${memoryNotes.join("; ")}` : "",
    `Writing style: ${style.label} (${style.tone}). ${style.instruction}`,
    `Response length: ${length.label}. ${length.instruction}`,
    `Complexity: ${complexityConfig.label}. ${complexityConfig.instruction}`,
    `Emoji level: ${emoji.label}. ${emoji.instruction}`,
    customInstructions ? `Custom instructions: ${customInstructions}` : "",
  ].filter(Boolean).join("\n");
}

export function evaluatePersonalityRoom({
  identity = "",
  audience = "",
  memoryNotes = [],
  writingStyle = "plain_english_operator",
  responseLength = "medium",
  complexity = "simple",
  emojiLevel = "light",
  statusSymbols = "traffic_light",
  customInstructions = "",
} = {}) {
  const normalizedIdentity = compactText(identity, 500);
  const normalizedAudience = compactText(audience, 260);
  const normalizedMemory = uniq(safeList(memoryNotes).map((note) => compactText(note, 220)));
  const preset = normalizeEnum(writingStyle, WRITING_STYLE_PRESETS, "plain_english_operator");
  const length = normalizeEnum(responseLength, RESPONSE_LENGTHS, "medium");
  const complexityKey = normalizeEnum(complexity, COMPLEXITY_LEVELS, "simple");
  const emoji = normalizeEnum(emojiLevel, EMOJI_LEVELS, "light");
  const symbols = normalizeEnum(statusSymbols, STATUS_SYMBOL_SETS, emoji === "none" ? "plain" : "traffic_light");
  const custom = compactText(customInstructions, 500);
  const setup = [];

  if (!normalizedIdentity) {
    setup.push({ kind: "add_identity", detail: "Add the assistant/company identity before using Launchpad broadly.", priority: 100 });
  }

  if (normalizedMemory.length === 0) {
    setup.push({ kind: "add_memory_context", detail: "Add durable memory notes: who the user is, what UnClick is, and what matters.", priority: 70 });
  }

  if (emoji === "heavy" && length === "short") {
    setup.push({ kind: "watch_style_conflict", detail: "Heavy emoji with short replies can crowd the answer; keep status markers purposeful.", priority: 35 });
  }

  return {
    ok: true,
    action: "personality_room",
    result: setup.some((step) => step.priority >= 75) ? "setup_needed" : "ready",
    identity: normalizedIdentity,
    audience: normalizedAudience,
    memory_notes: normalizedMemory,
    writing_style: { key: preset, ...WRITING_STYLE_PRESETS[preset] },
    controls: {
      response_length: length,
      complexity: complexityKey,
      emoji_level: emoji,
      status_symbols: symbols,
    },
    emoji_palette: EMOJI_LEVELS[emoji].palette,
    status_symbols: STATUS_SYMBOL_SETS[symbols],
    style_prompt: buildStylePrompt({
      identity: normalizedIdentity || "UnClick assistant identity not set",
      audience: normalizedAudience,
      memoryNotes: normalizedMemory,
      preset,
      responseLength: length,
      complexity: complexityKey,
      emojiLevel: emoji,
      customInstructions: custom,
    }),
    setup_steps: setup.sort((a, b) => b.priority - a.priority || a.kind.localeCompare(b.kind)),
    admin_fields: [
      "identity",
      "audience",
      "memoryNotes",
      "writingStyle",
      "responseLength",
      "complexity",
      "emojiLevel",
      "statusSymbols",
      "customInstructions",
    ],
    safety: {
      advisory_only: true,
      no_execution: true,
      no_repo_changes: true,
      no_secret_storage: true,
    },
  };
}

export async function readPersonalityRoomInput(filePath) {
  if (!filePath) return { ok: false, reason: "missing_input_path" };
  return JSON.parse(await readFile(filePath, "utf8"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  readPersonalityRoomInput(getArg("input", process.env.PINBALLWAKE_PERSONALITY_ROOM_INPUT || ""))
    .then((input) => evaluatePersonalityRoom(input))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
