export interface ContextFileInput {
  agent: "claude-code" | "cursor" | "aider";
  apiKeyPrefix: string;
  mcpUrl: string;
  projectName?: string;
  standingRules?: string[];
  preferences?: string[];
  repoContext?: Record<string, string>;
}

export interface ContextFileOutput {
  content: string;
  filename: string;
}

export function generateContextFile(input: ContextFileInput): ContextFileOutput {
  if (input.agent === "claude-code") {
    return { filename: "CLAUDE.md", content: buildClaudeMd(input) };
  }
  if (input.agent === "cursor") {
    return { filename: ".cursor/rules", content: buildCursorRules(input) };
  }
  return { filename: ".aider.conf.yml", content: buildAiderConf(input) };
}

function buildClaudeMd(input: ContextFileInput): string {
  const lines: string[] = [];
  lines.push(`# ${input.projectName || "My Project"}`);
  lines.push("");
  lines.push("## MCP Connection");
  lines.push("This project uses UnClick for persistent memory.");
  lines.push(`MCP URL: ${input.mcpUrl}`);
  lines.push("");

  if (input.standingRules?.length) {
    lines.push("## Standing Rules");
    for (const rule of input.standingRules) lines.push(`- ${rule}`);
    lines.push("");
  }

  if (input.preferences?.length) {
    lines.push("## Preferences");
    for (const pref of input.preferences) lines.push(`- ${pref}`);
    lines.push("");
  }

  if (input.repoContext && Object.keys(input.repoContext).length > 0) {
    lines.push("## Repository");
    for (const [key, value] of Object.entries(input.repoContext)) {
      if (value) lines.push(`- ${key}: ${value}`);
    }
    lines.push("");
  }

  lines.push("## Memory");
  lines.push("- Always call load_memory at session start");
  lines.push("- Save facts and preferences as you learn them -- don't wait until session end");
  lines.push("- When I correct you, save the correction immediately");
  lines.push("");

  return lines.join("\n");
}

function buildCursorRules(input: ContextFileInput): string {
  const lines = [`# Project: ${input.projectName || "My Project"}`];
  lines.push(`# MCP: ${input.mcpUrl}`);
  lines.push("");
  if (input.standingRules?.length) {
    lines.push("# Rules");
    for (const r of input.standingRules) lines.push(`# - ${r}`);
    lines.push("");
  }
  if (input.repoContext) {
    lines.push("# Repository Context");
    for (const [k, v] of Object.entries(input.repoContext)) {
      if (v) lines.push(`# ${k}: ${v}`);
    }
  }
  return lines.join("\n");
}

function buildAiderConf(input: ContextFileInput): string {
  const lines = ["# Aider configuration"];
  lines.push(`# Project: ${input.projectName || "My Project"}`);
  lines.push(`# MCP: ${input.mcpUrl}`);
  if (input.repoContext) {
    lines.push("# Repository");
    for (const [k, v] of Object.entries(input.repoContext)) {
      if (v) lines.push(`# ${k}: ${v}`);
    }
  }
  return lines.join("\n");
}
