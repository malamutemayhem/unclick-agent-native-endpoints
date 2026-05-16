import type { TestPassScore, Tool } from "./types";

export function testPassKeyForTool(tool: Tool): string {
  return tool.name.toLowerCase();
}

export function targetMatchesTool(target: string, tool: Tool): boolean {
  const normalizedTarget = target.toLowerCase();
  const endpoint = tool.endpoint.toLowerCase();
  const slug = endpoint.split("/").filter(Boolean).pop() ?? tool.name.toLowerCase();
  const name = tool.name.toLowerCase();
  return normalizedTarget.includes(endpoint) || normalizedTarget.includes(slug) || normalizedTarget.includes(name);
}

export function scoreFromSummary(summary: Record<string, unknown> | null | undefined): TestPassScore | null {
  if (!summary) return null;
  const pass = Number(summary.check ?? 0);
  const fail = Number(summary.fail ?? 0);
  const na = Number(summary.na ?? 0);
  const other = Number(summary.other ?? 0);
  const pending = Number(summary.pending ?? 0);
  const total = pass + fail + na + other + pending;
  if (total <= 0) return null;
  return {
    score: Math.round(((pass + na) / total) * 100),
    pass,
    fail,
    total,
  };
}
